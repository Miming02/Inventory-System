import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { TransferScanModal, TransferManualModal, TransferBatchModal } from "./TransferModals";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { convertItemQuantity } from "../../lib/unitConversion";
import { NotificationBell } from "../../components/NotificationBell";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";

function transferStatusBadge(status) {
  const s = (status || "").toLowerCase();
  if (s === "completed") {
    return (
      <span className="px-2 py-0.5 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 rounded-full text-[10px] font-semibold whitespace-nowrap">
        Completed
      </span>
    );
  }
  if (s === "in_transit") {
    return (
      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 rounded-full text-[10px] font-semibold whitespace-nowrap">
        In transit
      </span>
    );
  }
  if (s === "cancelled") {
    return (
      <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant rounded-full text-[10px] font-semibold whitespace-nowrap">
        Cancelled
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 rounded-full text-[10px] font-semibold whitespace-nowrap">
      {s || "Pending"}
    </span>
  );
}

function normalizeLocationValue(raw) {
  const trimmed = String(raw || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function makeAvailabilityKey(itemId, location) {
  return `${itemId}::${location}`;
}

function aggregateRequestedBySource(queue) {
  const requested = new Map();
  for (const row of queue) {
    const itemId = row?.itemId;
    const location = normalizeLocationValue(row?.fromLocation);
    const qty = Number(row?.quantity ?? 0);
    if (!itemId || !location || !Number.isFinite(qty) || qty <= 0) continue;
    const key = makeAvailabilityKey(itemId, location);
    requested.set(key, (requested.get(key) ?? 0) + qty);
  }
  return requested;
}

function profileDisplayName(profile) {
  if (!profile) return "Inventory user";
  const firstName = String(profile.first_name || "").trim();
  const lastName = String(profile.last_name || "").trim();
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
  return profile.email || "Inventory user";
}

export default function TransferInventory() {
  const { profile, role } = useAuth();
  const [entryStep, setEntryStep] = useState("select");
  const [activeEntryMode, setActiveEntryMode] = useState("scan");
  const [transferSuccess, setTransferSuccess] = useState(null);

  const onManualTransferReviewDone = useCallback(
    async ({ lineCount, unitCount, queue, submitIntent = "submit" }) => {
      const itemIds = [...new Set(queue.map((row) => row.itemId).filter(Boolean))];
      const requiredLocations = new Set(queue.map((row) => normalizeLocationValue(row.fromLocation)).filter(Boolean));
      const availableBySource = new Map();

      const { data: itemRows, error: itemErr } = await supabase
        .from("inventory_items")
        .select("id,unit_of_measure")
        .in("id", itemIds);
      if (itemErr) throw itemErr;
      const baseUnitById = new Map((itemRows ?? []).map((r) => [r.id, String(r.unit_of_measure || "").trim() || "unit"]));

      const normalizedQueue = [];
      for (const row of queue) {
        const baseUnit = baseUnitById.get(row.itemId) || "unit";
        const fromUnit = String(row.unit || "").trim();
        if (!fromUnit) throw new Error(`Unit is required for SKU ${row.sku || ""}.`);
        const baseQty = await convertItemQuantity({
          itemId: row.itemId,
          qty: row.quantity,
          fromUnit,
          toUnit: baseUnit,
        });
        normalizedQueue.push({
          ...row,
          _baseQty: baseQty,
          _baseUnit: baseUnit,
          _fromUnit: fromUnit,
        });
      }

      const requestedBySource = aggregateRequestedBySource(
        normalizedQueue.map((r) => ({ ...r, quantity: r._baseQty }))
      );

      // Primary source of truth for per-location balances.
      const { data: balances, error: balErr } = await supabase
        .from("inventory_item_locations")
        .select("item_id,location,quantity")
        .in("item_id", itemIds);

      if (!balErr) {
        for (const bal of balances ?? []) {
          const location = normalizeLocationValue(bal.location);
          if (!location || !requiredLocations.has(location)) continue;
          const key = makeAvailabilityKey(bal.item_id, location);
          availableBySource.set(key, Number(bal.quantity ?? 0));
        }
      } else {
        // Fallback: derive balances from stock movements in environments without per-location table.
        const { data: movements, error: moveLoadErr } = await supabase
          .from("stock_movements")
          .select("item_id,movement_type,quantity,from_location,to_location")
          .in("item_id", itemIds)
          .order("created_at", { ascending: true })
          .limit(10000);
        if (moveLoadErr) throw moveLoadErr;

        for (const move of movements ?? []) {
          const qty = Number(move.quantity ?? 0);
          if (!Number.isFinite(qty) || qty <= 0) continue;
          const type = String(move.movement_type || "").toLowerCase();
          const src = normalizeLocationValue(move.from_location);
          const dst = normalizeLocationValue(move.to_location);
          if (type === "in" && dst && requiredLocations.has(dst)) {
            const key = makeAvailabilityKey(move.item_id, dst);
            availableBySource.set(key, (availableBySource.get(key) ?? 0) + qty);
          } else if (type === "out" && src && requiredLocations.has(src)) {
            const key = makeAvailabilityKey(move.item_id, src);
            availableBySource.set(key, (availableBySource.get(key) ?? 0) - qty);
          } else if (type === "transfer") {
            if (src && requiredLocations.has(src)) {
              const srcKey = makeAvailabilityKey(move.item_id, src);
              availableBySource.set(srcKey, (availableBySource.get(srcKey) ?? 0) - qty);
            }
            if (dst && requiredLocations.has(dst)) {
              const dstKey = makeAvailabilityKey(move.item_id, dst);
              availableBySource.set(dstKey, (availableBySource.get(dstKey) ?? 0) + qty);
            }
          }
        }
      }

      for (const [key, requestedQty] of requestedBySource.entries()) {
        const availableQty = Math.max(0, Number(availableBySource.get(key) ?? 0));
        if (availableQty < requestedQty) {
          const [itemId, fromLocation] = key.split("::");
          const line = normalizedQueue.find((row) => row.itemId === itemId && row.fromLocation === fromLocation);
          const itemLabel = line?.sku ? `${line.sku} (${line.itemName || "Item"})` : "item";
          throw new Error(
            `Insufficient stock at "${fromLocation}" for ${itemLabel}. Available: ${availableQty}, requested: ${requestedQty}.`
          );
        }
      }

      const targetStatus = submitIntent === "draft" ? "draft" : "pending";

      for (const row of normalizedQueue) {
        const transferNumber = String(row.referenceNo || "").trim() || `TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const { data: transferRow, error: transferErr } = await supabase
          .from("stock_transfers")
          .insert({
            transfer_number: transferNumber,
            from_location: row.fromLocation,
            to_location: row.toLocation,
            status: targetStatus,
            notes: [
              row.transferDate ? `Transfer date: ${row.transferDate}` : "",
              row.transferBy ? `Transfer by: ${row.transferBy}` : "",
              row.requestedBy ? `Requested by: ${row.requestedBy}` : "",
              row.attachmentPath ? `Attachment: ${row.attachmentPath}` : "",
            ]
              .filter(Boolean)
              .join(" • ") || null,
            created_by: profile?.id ?? null,
          })
          .select("id")
          .single();
        if (transferErr) throw transferErr;

        const transferId = transferRow?.id;
        const { error: itemErr } = await supabase.from("stock_transfer_items").insert({
          transfer_id: transferId,
          item_id: row.itemId,
          quantity: row._baseQty,
        });
        if (itemErr) throw itemErr;
      }

      setTransferSuccess({ lineCount, unitCount, workflowStatus: targetStatus });
    },
    [profile?.id]
  );

  useEffect(() => {
    if (!transferSuccess) return undefined;
    const t = window.setTimeout(() => setTransferSuccess(null), 5000);
    return () => window.clearTimeout(t);
  }, [transferSuccess]);


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
            <div className={entryStep === "select" ? "min-h-[calc(100dvh-14rem)]" : "min-h-[calc(100dvh-5.2rem)]"}>
              {entryStep === "select" ? (
                <div className="flex h-full flex-col">
                  <div className="relative bg-primary px-6 py-6 text-center text-white">
                    <Link
                      to="/dashboard"
                      className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-all hover:bg-white/20"
                      aria-label="Close transfer page"
                      title="Close"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </Link>
                    <h2 className="text-3xl font-black font-headline tracking-tight">Transfer Inventory</h2>
                    <p className="mt-2 text-sm text-white/90">Select a method to transfer items</p>
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
                      {entryActions.find((a) => a.key === activeEntryMode)?.title || "Transfer"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEntryStep("select")}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                        activeEntryMode === "manual"
                          ? "border border-white/25 bg-white/10 text-white hover:bg-white/20"
                          : "border border-outline-variant/20 bg-white text-on-surface-variant hover:border-error/20 hover:text-error"
                      }`}
                      aria-label="Back to transfer methods"
                      title="Close to transfer methods"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                  {activeEntryMode === "scan" ? (
                    <div className="flex-1 min-h-0">
                      <TransferScanModal open inline onClose={() => {}} onReviewDone={onManualTransferReviewDone} />
                    </div>
                  ) : null}
                  {activeEntryMode === "manual" ? (
                    <div className="flex-1 min-h-0">
                      <TransferManualModal open inline onClose={() => {}} onReviewDone={onManualTransferReviewDone} />
                    </div>
                  ) : null}
                  {activeEntryMode === "batch" ? (
                    <div className="flex-1 min-h-0">
                      <TransferBatchModal open inline onClose={() => {}} onReviewDone={onManualTransferReviewDone} />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {transferSuccess ? (
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
              <p className="font-bold text-sm text-on-surface font-headline">
                {transferSuccess.workflowStatus === "draft" ? "Transfer saved as draft" : "Transfer submitted for approval"}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                {transferSuccess.lineCount} line{transferSuccess.lineCount === 1 ? "" : "s"} · {transferSuccess.unitCount} unit
                {transferSuccess.unitCount === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTransferSuccess(null)}
              className="shrink-0 p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      ) : null}

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe pt-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg rounded-t-2xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)] border-t border-slate-100 dark:border-slate-800">
        <Link to="/receive" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">
          <span className="material-symbols-outlined">input</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Receive</span>
        </Link>
        <div className="flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-xl px-4 py-1">
          <span className="material-symbols-outlined text-primary">sync_alt</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Transfer</span>
        </div>
        <button type="button" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">
          <span className="material-symbols-outlined">precision_manufacturing</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Work</span>
        </button>
        <Link to="/deliver" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">
          <span className="material-symbols-outlined">local_shipping</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Deliver</span>
        </Link>
        <button type="button" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">
          <span className="material-symbols-outlined">fact_check</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Audit</span>
        </button>
      </nav>
    </div>
  );
}
