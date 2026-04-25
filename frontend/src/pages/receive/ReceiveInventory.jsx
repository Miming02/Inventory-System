import { useState, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ScanItemsModal, ManualEntryModal, BatchUploadModal } from "./ReceiveModals";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { convertItemQuantity } from "../../lib/unitConversion";
import { NotificationBell } from "../../components/NotificationBell";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";

function normalizeLocationValue(raw) {
  const trimmed = String(raw || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function profileDisplayName(profile) {
  if (!profile) return "Inventory user";
  const firstName = String(profile.first_name || "").trim();
  const lastName = String(profile.last_name || "").trim();
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
  return profile.email || "Inventory user";
}

export default function ReceiveInventory() {
  const [searchParams] = useSearchParams();
  const { profile, role } = useAuth();
  const [entryStep, setEntryStep] = useState("select");
  const [activeEntryMode, setActiveEntryMode] = useState("scan");
  const [receiveSuccess, setReceiveSuccess] = useState(null);
  const selectedPoId = String(searchParams.get("po") || "").trim();

  const onReceiveManualReviewDone = useCallback(
    async ({ sourceType, submitIntent, header, lineCount, unitCount, totalCost, queue, workflowStatus }) => {
      const itemIds = [...new Set(queue.map((row) => row.itemId).filter(Boolean))];
      if (itemIds.length === 0) {
        throw new Error("No valid receive lines found.");
      }

      const { data: items, error: itemErr } = await supabase
        .from("inventory_items")
        .select("id,is_active,unit_of_measure")
        .in("id", itemIds);
      if (itemErr) throw itemErr;

      const activeItemIds = new Set((items ?? []).filter((row) => row.is_active !== false).map((row) => row.id));
      const baseUnitById = new Map((items ?? []).map((row) => [row.id, String(row.unit_of_measure || "").trim() || "unit"]));
      for (const row of queue) {
        const qty = Number(row.quantity ?? 0);
        const location = normalizeLocationValue(row.location);
        const fromUnit = String(row.unit || "").trim();
        if (!row.itemId || !activeItemIds.has(row.itemId)) {
          throw new Error(`Cannot receive SKU ${row.sku || ""}: item is missing or inactive.`);
        }
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error(`Invalid quantity for SKU ${row.sku || ""}.`);
        }
        if (!fromUnit) {
          throw new Error(`Unit is required for SKU ${row.sku || ""}.`);
        }
        if (!location) {
          throw new Error(`Location is required for SKU ${row.sku || ""}.`);
        }
      }

      const payloadItems = [];
      for (const row of queue) {
        const baseUnit = baseUnitById.get(row.itemId) || "unit";
        const fromUnit = String(row.unit || "").trim();
        const baseQty = await convertItemQuantity({
          itemId: row.itemId,
          qty: row.quantity,
          fromUnit,
          toUnit: baseUnit,
        });
        const issueQtyRaw = Number(row.issueQuantity ?? 0);
        const baseIssueQty = issueQtyRaw > 0
          ? await convertItemQuantity({
              itemId: row.itemId,
              qty: issueQtyRaw,
              fromUnit,
              toUnit: baseUnit,
            })
          : 0;
        payloadItems.push({
          receive_transaction_id: null,
          item_id: row.itemId,
          po_id: row.poId || null,
          po_line_id: row.poLineId || null,
          sku: String(row.sku || ""),
          item_name: String(row.itemName || row.sku || ""),
          description: String(row.description || ""),
          unit_of_measure: baseUnit,
          quantity: Number(baseQty),
          unit_cost: Number(row.unitCost || 0),
          line_cost: Number(row.lineCost || 0),
          condition_tag: String(row.conditionTag || "received"),
          issue_quantity: Number(baseIssueQty || 0),
          issue_reason: String(row.issueReason || ""),
          issue_notes: String(row.issueNotes || row.remarks || ""),
          location: normalizeLocationValue(row.location),
        });
      }
      const transactionNumber = `RCV-${Date.now()}`;
      const status = submitIntent === "draft" ? "draft" : "pending_approval";
      const { data: txnRow, error: txnErr } = await supabase
        .from("receive_transactions")
        .insert({
          transaction_number: transactionNumber,
          source_type: sourceType || "manual",
          supplier_name: String(header?.supplier || ""),
          received_by_text: String(header?.receivedBy || ""),
          received_date: header?.receivedDate || null,
          location: normalizeLocationValue(header?.location) || normalizeLocationValue(queue[0]?.location),
          attachment_path: String(header?.attachmentPath || ""),
          remarks: String(header?.remarks || ""),
          status,
          submitted_by: profile?.id ?? null,
          created_by: profile?.id ?? null,
        })
        .select("id,status,transaction_number")
        .single();
      if (txnErr) throw txnErr;

      const txnItems = payloadItems.map((row) => ({ ...row, receive_transaction_id: txnRow.id }));
      const { error: itemInsertErr } = await supabase.from("receive_transaction_items").insert(txnItems);
      if (itemInsertErr) throw itemInsertErr;

      setReceiveSuccess({
        lineCount,
        unitCount,
        totalCost: Number(totalCost || 0),
        workflowStatus: txnRow.status,
        transactionNumber: txnRow.transaction_number,
      });
    },
    [profile?.id]
  );

  useEffect(() => {
    if (!selectedPoId) return;
    setEntryStep("entry");
    setActiveEntryMode("manual");
  }, [selectedPoId]);

  useEffect(() => {
    if (!receiveSuccess) return undefined;
    const t = window.setTimeout(() => setReceiveSuccess(null), 5000);
    return () => window.clearTimeout(t);
  }, [receiveSuccess]);

  const entryActions = [
    {
      key: "scan",
      title: "Scan SKU or Code",
      icon: "qr_code_scanner",
      onClick: () => {
        setEntryStep("entry");
        setActiveEntryMode("scan");
      },
    },
    {
      key: "manual",
      title: "Manual Input",
      icon: "edit_note",
      onClick: () => {
        setEntryStep("entry");
        setActiveEntryMode("manual");
      },
    },
    {
      key: "batch",
      title: "Batch Upload",
      icon: "upload_file",
      onClick: () => {
        setEntryStep("entry");
        setActiveEntryMode("batch");
      },
    },
  ];

  return (
    <div className="min-h-dvh bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed pb-20 md:pb-0">
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-white/80 shadow-sm shadow-blue-900/5 backdrop-blur-xl dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8 max-w-[1440px]">
          <div className="flex items-center gap-6 min-w-0">
            <Link
              to="/dashboard"
              className="text-xl font-bold tracking-tighter text-slate-900 transition-opacity hover:opacity-90 dark:text-white font-headline"
            >
              Inventory
            </Link>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 min-w-0">
            <NotificationBell />
            {role ? (
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {role}
              </span>
            ) : null}
            <span className="shrink-0 rounded-full border-2 border-surface-bright bg-surface-container-high p-0">
              <UserAvatarOrIcon src={profile?.avatar_url} alt={profileDisplayName(profile)} size="md" />
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-2 pb-4 pt-[4.2rem] sm:px-3 lg:px-4">
        <section className={`${entryStep === "select" ? "min-h-[calc(100dvh-4.8rem)] flex items-center justify-center" : "py-1"}`}>
          <div className={`relative mx-auto overflow-hidden rounded-[1.4rem] border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest to-surface shadow-[0_20px_60px_rgba(15,23,42,0.05)] ${entryStep === "select" ? "w-full max-w-[1040px]" : "w-full"}`}>
            <div className={entryStep === "select" ? "min-h-[calc(100dvh-14rem)]" : "min-h-[calc(100dvh-8rem)]"}>
              {entryStep === "select" ? (
                <div className="flex h-full flex-col">
                  <div className="relative bg-primary px-6 py-6 text-center text-white">
                    <Link
                      to="/dashboard"
                      className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-all hover:bg-white/20"
                      aria-label="Close receive page"
                      title="Close"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </Link>
                    <h2 className="text-3xl font-black font-headline tracking-tight">Receive Inventory</h2>
                    <p className="mt-2 text-sm text-white/90">Select a method to receive items</p>
                  </div>
                  <div className="flex-1 min-h-0 p-5 sm:p-6 grid place-items-center">
                    <div className="mx-auto grid w-full max-w-5xl translate-y-8 md:translate-y-10 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {entryActions.map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          onClick={action.onClick}
                          className="group rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_14px_30px_rgba(59,130,246,0.12)]"
                        >
                          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <span className="material-symbols-outlined text-[22px]">{action.icon}</span>
                          </span>
                          <span className="block text-lg font-bold text-on-surface">{action.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative h-[calc(100dvh-6.3rem)] min-h-0 overflow-hidden bg-transparent p-1 sm:p-1.5 lg:p-2 flex flex-col">
                  <div
                    className={`mb-1.5 flex items-center justify-between rounded-xl px-3 py-1.5 ${
                      activeEntryMode === "manual"
                        ? "bg-primary text-white"
                        : "border border-outline-variant/20 bg-white/80"
                    }`}
                  >
                    <span className={`text-xs font-semibold uppercase tracking-wider ${activeEntryMode === "manual" ? "text-white" : "text-primary/70"}`}>
                      {entryActions.find((a) => a.key === activeEntryMode)?.title || "Receive"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEntryStep("select")}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                        activeEntryMode === "manual"
                          ? "border border-white/25 bg-white/10 text-white hover:bg-white/20"
                          : "border border-outline-variant/20 bg-white text-on-surface-variant hover:border-error/20 hover:text-error"
                      }`}
                      aria-label="Back to receive methods"
                      title="Close to receive methods"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                  {activeEntryMode === "scan" ? (
                    <div className="flex-1 min-h-0">
                      <ScanItemsModal open inline onClose={() => {}} onReviewDone={onReceiveManualReviewDone} />
                    </div>
                  ) : null}
                  {activeEntryMode === "manual" ? (
                    <div className="flex-1 min-h-0">
                      <ManualEntryModal
                        open
                        inline
                        onClose={() => {}}
                        onReviewDone={onReceiveManualReviewDone}
                        initialPoId={selectedPoId}
                      />
                    </div>
                  ) : null}
                  {activeEntryMode === "batch" ? (
                    <div className="flex-1 min-h-0">
                      <BatchUploadModal open inline onClose={() => {}} onReviewDone={onReceiveManualReviewDone} />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
        </div>
        </section>
      </main>

      {receiveSuccess ? (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] w-[min(100%-2rem,400px)] pointer-events-auto"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-green-200/80 dark:border-green-800/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_12px_40px_-8px_rgba(0,0,0,0.2)] p-4 pr-3">
            <div className="p-2 rounded-xl bg-green-50 dark:bg-green-950/50 shrink-0">
              <span className="material-symbols-outlined text-green-700 dark:text-green-400 text-2xl">check_circle</span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-bold text-sm text-on-surface font-headline">Receive completed successfully</p>
              <p className="text-xs text-on-surface-variant mt-1">
                {receiveSuccess.lineCount} line{receiveSuccess.lineCount === 1 ? "" : "s"} · {receiveSuccess.unitCount} unit
                {receiveSuccess.unitCount === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                Status: {receiveSuccess.workflowStatus} · Total Cost: {Number(receiveSuccess.totalCost || 0).toFixed(2)}
              </p>
              {receiveSuccess.transactionNumber ? (
                <p className="text-xs text-on-surface-variant mt-1">Transaction: {receiveSuccess.transactionNumber}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setReceiveSuccess(null)}
              className="shrink-0 p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      ) : null}

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe pt-2 bg-white/80 backdrop-blur-lg rounded-t-2xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)] border-t border-slate-100">
        <div className="flex flex-col items-center justify-center bg-blue-50 text-blue-700 rounded-xl px-4 py-1">
          <span className="material-symbols-outlined text-primary">input</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Receive</span>
        </div>
        <Link to="/transfer" className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined">sync_alt</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Transfer</span>
        </Link>
        <Link to="/inventory" className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined">inventory_2</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Stock</span>
        </Link>
        <Link to="/deliver" className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined">local_shipping</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Deliver</span>
        </Link>
        <Link to="/count" className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined">fact_check</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Count</span>
        </Link>
      </nav>
    </div>
  );
}
