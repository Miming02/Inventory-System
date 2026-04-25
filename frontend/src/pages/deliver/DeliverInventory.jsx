import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { DeliverScanModal, DeliverManualModal, DeliverBatchModal } from "./DeliverModals";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { convertItemQuantity } from "../../lib/unitConversion";
import { NotificationBell } from "../../components/NotificationBell";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";

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
    const location = normalizeLocationValue(row?.shipFrom);
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

export default function DeliverInventory() {
  const { profile, role } = useAuth();
  const [entryStep, setEntryStep] = useState("select");
  const [activeEntryMode, setActiveEntryMode] = useState("scan");
  const [deliverSuccess, setDeliverSuccess] = useState(null);

  const onDeliverManualReviewDone = useCallback(
    async ({ lineCount, unitCount, queue, submitForApproval }) => {
      const itemIds = [...new Set(queue.map((row) => row.itemId).filter(Boolean))];
      const requiredLocations = new Set(queue.map((row) => normalizeLocationValue(row.shipFrom)).filter(Boolean));
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
          const [itemId, shipFrom] = key.split("::");
          const line = normalizedQueue.find((row) => row.itemId === itemId && row.shipFrom === shipFrom);
          const itemLabel = line?.sku ? `${line.sku} (${line.itemName || "Item"})` : "item";
          throw new Error(
            `Insufficient stock at "${shipFrom}" for ${itemLabel}. Available: ${availableQty}, requested: ${requestedQty}.`
          );
        }
      }

      const groups = new Map();
      for (const row of normalizedQueue) {
        const key = `${row.referenceNo}::${row.customerName}::${row.deliveryDate}`;
        if (!groups.has(key)) {
          groups.set(key, {
            header: row,
            lines: [],
          });
        }
        groups.get(key).lines.push(row);
      }

      for (const [, group] of groups) {
        const headerRow = group.header;
        const { data: createdRequest, error: deliveryErr } = await supabase
          .from("delivery_requests")
          .insert({
            reference_no: headerRow.referenceNo,
            customer_name: headerRow.customerName,
            delivery_date: headerRow.deliveryDate,
            attachment_path: headerRow.attachmentPath || null,
            status: submitForApproval ? "pending_approval" : "draft",
            submitted_by: submitForApproval ? profile?.id ?? null : null,
            created_by: profile?.id ?? null,
          })
          .select("id")
          .single();
        if (deliveryErr) throw deliveryErr;

        const itemsPayload = group.lines.map((row) => ({
          delivery_request_id: createdRequest.id,
          item_id: row.itemId,
          sku: row.sku,
          item_name: row.itemName || row.sku || "Item",
          quantity: row.quantity,
          unit_of_measure: row._fromUnit || row.unit || "unit",
          from_location: row.shipFrom || null,
          to_location: row.shipTo || null,
        }));
        if (itemsPayload.length > 0) {
          const { error: itemErr } = await supabase.from("delivery_request_items").insert(itemsPayload);
          if (itemErr) throw itemErr;
        }
      }
      setDeliverSuccess({ lineCount, unitCount, submitted: !!submitForApproval });
    },
    [profile?.id]
  );

  useEffect(() => {
    if (!deliverSuccess) return undefined;
    const t = window.setTimeout(() => setDeliverSuccess(null), 5000);
    return () => window.clearTimeout(t);
  }, [deliverSuccess]);

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
    <div className="min-h-dvh overflow-hidden bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed">
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
                      aria-label="Close deliver page"
                      title="Close"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </Link>
                    <h2 className="text-3xl font-black font-headline tracking-tight">Deliver Inventory</h2>
                    <p className="mt-2 text-sm text-white/90">Select a method to deliver items</p>
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
                      {entryActions.find((a) => a.key === activeEntryMode)?.title || "Deliver"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEntryStep("select")}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                        activeEntryMode === "manual"
                          ? "border border-white/25 bg-white/10 text-white hover:bg-white/20"
                          : "border border-outline-variant/20 bg-white text-on-surface-variant hover:border-error/20 hover:text-error"
                      }`}
                      aria-label="Back to deliver methods"
                      title="Close to deliver methods"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                  {activeEntryMode === "scan" ? (
                    <div className="flex-1 min-h-0">
                      <DeliverScanModal open inline onClose={() => {}} onReviewDone={onDeliverManualReviewDone} />
                    </div>
                  ) : null}
                  {activeEntryMode === "manual" ? (
                    <div className="flex-1 min-h-0">
                      <DeliverManualModal open inline onClose={() => {}} onReviewDone={onDeliverManualReviewDone} />
                    </div>
                  ) : null}
                  {activeEntryMode === "batch" ? (
                    <div className="flex-1 min-h-0">
                      <DeliverBatchModal open inline onClose={() => {}} onReviewDone={onDeliverManualReviewDone} />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {deliverSuccess ? (
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
                {deliverSuccess.submitted ? "Delivery submitted for approval" : "Delivery saved as draft"}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                {deliverSuccess.lineCount} line{deliverSuccess.lineCount === 1 ? "" : "s"} · {deliverSuccess.unitCount} unit
                {deliverSuccess.unitCount === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeliverSuccess(null)}
              className="shrink-0 p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
}
