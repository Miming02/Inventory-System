import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { useDistinctLocations } from "../../lib/useDistinctLocations";

const COUNT_PAGE_SIZE = 14;

function formatMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function statusLabel(status) {
  return String(status || "not_started")
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function StatusBadge({ status }) {
  if (status === "reconciled") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
        <span className="material-symbols-outlined text-[14px]">verified</span>
        Reconciled
      </div>
    );
  }
  if (status === "completed") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
        <span className="material-symbols-outlined text-[14px]">task_alt</span>
        Completed
      </div>
    );
  }
  if (status === "in_progress") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-fixed-variant text-xs font-bold">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        In Progress
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
      Not Started
    </div>
  );
}

function RenderSafeSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  wrapperClassName = "",
  inputClassName = "",
  disabled = false,
}) {
  const normalizedOptions = Array.isArray(options) ? options : [];
  const selectedLabel =
    normalizedOptions.find((opt) => String(opt.value) === String(value))?.label ??
    (value ? String(value) : "");

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        readOnly
        value={selectedLabel}
        placeholder={placeholder}
        className={`pointer-events-none w-full ${inputClassName}`}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">
        <span className="material-symbols-outlined text-[16px]">expand_more</span>
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {value && !normalizedOptions.some((opt) => String(opt.value) === String(value)) ? (
          <option value={value}>{value}</option>
        ) : null}
        {normalizedOptions.map((opt) => (
          <option key={`${opt.value}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function CountInventory() {
  const { profile } = useAuth();
  const locations = useDistinctLocations(true);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [itemOptions, setItemOptions] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [lineDraft, setLineDraft] = useState({ itemId: "", countedQuantity: "" });
  const [countDate, setCountDate] = useState(todayYmd());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [countSessionStatus, setCountSessionStatus] = useState("not_started");
  const [countSessionId, setCountSessionId] = useState(null);
  const [countNumber, setCountNumber] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isApproved, setIsApproved] = useState(false);

  const countedByLabel = useMemo(() => {
    const fn = (profile?.first_name || "").trim();
    const ln = (profile?.last_name || "").trim();
    if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
    return profile?.email || "—";
  }, [profile]);

  const selectedItem =
    itemOptions.find((item) => String(item.id) === String(lineDraft.itemId)) ?? null;

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let q = supabase
        .from("inventory_items")
        .select("id,sku,name,current_stock,unit_cost,location")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(500);
      if (selectedLocation) {
        q = q.eq("location", selectedLocation);
      }
      const { data, error: e } = await q;
      if (e) throw e;
      setItemOptions(data ?? []);
      setLineItems([]);
      setLineDraft({ itemId: "", countedQuantity: "" });
      setCountSessionId(null);
      setCountSessionStatus("not_started");
      setCountNumber("");
      setSaveMessage("");
      setIsApproved(false);
    } catch (err) {
      setError(getErrorMessage(err));
      setItemOptions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const totals = useMemo(() => {
    return lineItems.reduce(
      (acc, row) => {
        acc.totalVariance += Number(row.variance || 0);
        acc.totalAdjustmentValue += Number(row.adjustmentValue || 0);
        return acc;
      },
      { totalVariance: 0, totalAdjustmentValue: 0 }
    );
  }, [lineItems]);

  const pagedLineItems = lineItems.slice(0, COUNT_PAGE_SIZE);

  const addLineItem = (event) => {
    if (event?.preventDefault) event.preventDefault();
    setError("");
    const item =
      selectedItem ??
      itemOptions.find((row) => String(row.id) === String(lineDraft.itemId)) ??
      null;
    if (!item?.id) {
      setError("SKU is required.");
      return;
    }
    const countedQuantity = Number(lineDraft.countedQuantity);
    if (!Number.isFinite(countedQuantity) || countedQuantity < 0) {
      setError("Counted Quantity must be zero or greater.");
      return;
    }
    const currentQuantity = Number(item.current_stock ?? 0);
    const variance = countedQuantity - currentQuantity;
    const unitCost = Number(item.unit_cost ?? 0);
    const adjustmentValue = variance * (Number.isFinite(unitCost) ? unitCost : 0);

    setLineItems((prev) => {
      const existingIndex = prev.findIndex((row) => String(row.itemId) === String(item.id));
      if (existingIndex >= 0) {
        return prev.map((row, index) =>
          index === existingIndex
            ? {
                ...row,
                countedQuantity,
                variance,
                adjustmentValue,
              }
            : row
        );
      }
      return [
        ...prev,
        {
          id: `${item.id}-${Date.now()}`,
          itemId: item.id,
          sku: item.sku || "—",
          itemName: item.name || "—",
          currentQuantity,
          countedQuantity,
          variance,
          adjustmentValue,
        },
      ];
    });
    setLineDraft({ itemId: "", countedQuantity: "" });
  };

  const handleDraftKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addLineItem();
  };

  const updateCountedQuantity = (rowId, rawValue) => {
    const qty = Number(rawValue);
    if (!Number.isFinite(qty) || qty < 0) return;
    setLineItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const variance = qty - Number(row.currentQuantity || 0);
        const unitCost = Number(row.variance) !== 0 ? Number(row.adjustmentValue) / Number(row.variance) : 0;
        return {
          ...row,
          countedQuantity: qty,
          variance,
          adjustmentValue: variance * (Number.isFinite(unitCost) ? unitCost : 0),
        };
      })
    );
  };

  const ensureCountSession = useCallback(async () => {
    if (countSessionId) return countSessionId;
    if (!selectedLocation) {
      throw new Error("Location is required.");
    }
    if (!countDate) {
      throw new Error("Count Date is required.");
    }
    const now = new Date();
    const nextCountNumber = `CNT-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`;
    const { data, error: createError } = await supabase
      .from("stock_counts")
      .insert({
        count_number: nextCountNumber,
        location: selectedLocation,
        status: "not_started",
        created_by: profile?.id ?? null,
        start_date: countDate,
        notes: "Inventory count session created.",
      })
      .select("id,count_number,status")
      .single();
    if (createError) throw createError;
    setCountSessionId(data.id);
    setCountNumber(data.count_number || nextCountNumber);
    setCountSessionStatus(data.status || "not_started");
    return data.id;
  }, [countDate, countSessionId, profile?.id, selectedLocation]);

  const persistCount = useCallback(
    async (nextStatus) => {
      setSaving(true);
      setError("");
      setSaveMessage("");
      try {
        if (!selectedLocation) {
          throw new Error("Location is required.");
        }
        if (!countDate) {
          throw new Error("Count Date is required.");
        }
        if (!countedByLabel || countedByLabel === "—") {
          throw new Error("Counted By is required.");
        }
        if (lineItems.length === 0) {
          throw new Error("Add at least one line item.");
        }

        const activeSessionId = await ensureCountSession();

        if (nextStatus === "reconciled") {
          const { error: rpcError } = await supabase.rpc("process_stock_count_review", {
            p_count_id: activeSessionId,
            p_action: "approve",
            p_review_notes: `Finalized from Count page by ${countedByLabel} on ${countDate}`,
          });
          if (rpcError) throw rpcError;
          setCountSessionStatus("reconciled");
          setSaveMessage("Count reconciled and inventory stock updated.");
          return;
        }

        const { error: deleteError } = await supabase
          .from("stock_count_items")
          .delete()
          .eq("count_id", activeSessionId);
        if (deleteError) throw deleteError;

        const payload = lineItems.map((line) => ({
          count_id: activeSessionId,
          item_id: line.itemId,
          system_quantity: Number(line.currentQuantity || 0),
          counted_quantity: Number(line.countedQuantity || 0),
          notes: `Variance: ${Number(line.variance || 0)}`,
        }));
        const { error: insertError } = await supabase.from("stock_count_items").insert(payload);
        if (insertError) throw insertError;

        const updatePatch = {
          status: nextStatus,
          location: selectedLocation,
          updated_at: new Date().toISOString(),
          notes: `Counted by ${countedByLabel} on ${countDate}`,
        };
        if (nextStatus === "in_progress") updatePatch.start_date = countDate;
        if (nextStatus === "reconciled") updatePatch.end_date = countDate;

        const { error: updateError } = await supabase
          .from("stock_counts")
          .update(updatePatch)
          .eq("id", activeSessionId);
        if (updateError) throw updateError;

        setCountSessionStatus(nextStatus);
        setSaveMessage(`Count ${statusLabel(nextStatus).toLowerCase()}.`);
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setSaving(false);
      }
    },
    [countDate, countedByLabel, ensureCountSession, lineItems, selectedLocation]
  );

  const approveCount = () => {
    setError("");
    setSaveMessage("");
    if (countSessionStatus !== "completed") {
      setError("Submit the count first before approving.");
      return;
    }
    setIsApproved(true);
    setSaveMessage("Count approved. You may finalize now.");
  };

  return (
    <div className="min-h-dvh bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed pb-24 md:pb-0">
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-2 pb-4 pt-[4.2rem] sm:px-3 lg:px-4">
        <section className="py-1">
          <div className="relative mx-auto w-full overflow-hidden rounded-[1.4rem] border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest to-surface shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            <div className="min-h-[calc(100dvh-5.2rem)]">
              <div className="relative h-[calc(100dvh-6.3rem)] min-h-0 overflow-hidden bg-transparent p-1 sm:p-1.5 lg:p-2 flex flex-col">
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.15rem] border border-slate-200/70 bg-white/90 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                  <div className="flex items-start justify-between rounded-t-[1.15rem] bg-primary px-3 py-2.5 text-white">
                    <h2 className="font-headline text-sm font-extrabold tracking-tight text-white">Inventory Count</h2>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={countSessionStatus} />
                      <Link
                        to="/dashboard"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/35 bg-white/15 text-white transition-all hover:border-white/70 hover:bg-white/25"
                        aria-label="Close count page"
                        title="Close"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </Link>
                    </div>
                  </div>

                  <div className="flex h-full min-h-0 flex-col space-y-1 p-2 pt-0 overflow-hidden">
                    {error ? <p className="text-sm font-medium text-error">{error}</p> : null}
                    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <h3 className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary/60">
                          Manual Input Preview Table
                        </h3>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {lineItems.length} items
                        </span>
                      </div>

                      <div className="mb-1.5 grid grid-cols-1 gap-1 md:grid-cols-4">
                        <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                          <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                            Location *
                          </label>
                          <RenderSafeSelect
                            value={selectedLocation}
                            onChange={setSelectedLocation}
                            placeholder="Select location..."
                            options={locations.map((location) => ({ value: location, label: location }))}
                            inputClassName="h-5 rounded-md border border-slate-200 bg-white px-1.5 text-[10px] text-slate-900"
                            disabled={saving}
                          />
                        </div>
                        <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                          <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                            Counted By *
                          </label>
                          <input value={countedByLabel} readOnly className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                        </div>
                        <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                          <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                            Count Date *
                          </label>
                          <input
                            type="date"
                            value={countDate}
                            onChange={(e) => setCountDate(e.target.value)}
                            disabled={saving}
                            className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]"
                          />
                        </div>
                        <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                          <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                            Count No.
                          </label>
                          <input
                            value={countNumber || "Auto"}
                            readOnly
                            className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]"
                          />
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-slate-200">
                        <div className="h-full min-h-[180px] overflow-x-auto overflow-y-hidden">
                          <table className="w-full min-w-[980px] table-fixed text-left text-[10px]">
                            <thead className="sticky top-0 z-10 bg-slate-100">
                              <tr>
                                <th className="w-[16%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">SKU</th>
                                <th className="w-[22%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Item Name</th>
                                <th className="w-[13%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">
                                  Current Quantity
                                </th>
                                <th className="w-[13%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">
                                  Counted Quantity
                                </th>
                                <th className="w-[12%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">
                                  Variance
                                </th>
                                <th className="w-[14%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Adjustment Value</th>
                                <th className="w-[10%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80 bg-white">
                              {pagedLineItems.map((line) => (
                                <tr key={line.id}>
                                  <td className="truncate px-2 py-1 font-medium">{line.sku}</td>
                                  <td className="truncate px-2 py-1">{line.itemName}</td>
                                  <td className="px-2 py-1 text-center font-semibold">{line.currentQuantity}</td>
                                  <td className="px-2 py-1 text-center">
                                    <input
                                      type="number"
                                      min="0"
                                      value={line.countedQuantity}
                                      onChange={(e) => updateCountedQuantity(line.id, e.target.value)}
                                      className="h-6 w-full rounded-md border-none bg-slate-50 px-1.5 text-center text-[10px]"
                                      disabled={saving || countSessionStatus === "reconciled"}
                                    />
                                  </td>
                                  <td className="px-2 py-1 text-center font-semibold">
                                    {line.variance > 0 ? `+${line.variance}` : line.variance}
                                  </td>
                                  <td className="truncate px-2 py-1">{formatMoney(line.adjustmentValue)}</td>
                                  <td className="px-2 py-1 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setLineItems((prev) => prev.filter((row) => row.id !== line.id))}
                                      className="rounded-full p-0.5 hover:bg-slate-100"
                                      disabled={saving || countSessionStatus === "reconciled"}
                                      aria-label={`Remove ${line.sku}`}
                                    >
                                      <span className="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}

                              <tr className="bg-slate-50/70">
                                <td className="px-1.5 py-1">
                                  <RenderSafeSelect
                                    value={lineDraft.itemId}
                                    onChange={(nextItemId) => setLineDraft((prev) => ({ ...prev, itemId: nextItemId }))}
                                    placeholder={loading ? "Loading..." : "Select SKU..."}
                                    options={itemOptions.map((item) => ({
                                      value: item.id,
                                      label: `${item.sku} - ${item.name || "Item"}`,
                                    }))}
                                    inputClassName="h-6 rounded-md border border-slate-200 bg-white px-1.5 text-[10px] text-slate-900"
                                    disabled={loading || saving || !selectedLocation || countSessionStatus === "reconciled"}
                                  />
                                </td>
                                <td className="px-1.5 py-1">
                                  <input
                                    value={selectedItem?.name || ""}
                                    readOnly
                                    className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px]"
                                  />
                                </td>
                                <td className="px-1.5 py-1 text-center text-[10px]">{selectedItem?.current_stock ?? "Auto"}</td>
                                <td className="px-1.5 py-1">
                                  <input
                                    value={lineDraft.countedQuantity}
                                    onChange={(e) => setLineDraft((prev) => ({ ...prev, countedQuantity: e.target.value }))}
                                    onKeyDown={handleDraftKeyDown}
                                    type="number"
                                    min="0"
                                    className="h-6 w-full rounded-md border-none bg-white px-1.5 text-center text-[10px]"
                                    disabled={saving || countSessionStatus === "reconciled"}
                                  />
                                </td>
                                <td className="px-1.5 py-1 text-center text-[9px] text-on-surface-variant">Auto</td>
                                <td className="px-1.5 py-1 text-[9px] text-on-surface-variant">Auto</td>
                                <td className="px-1.5 py-1 text-center">
                                  <button
                                    type="button"
                                    onClick={addLineItem}
                                    disabled={saving || loading || countSessionStatus === "reconciled"}
                                    className="text-[9px] font-semibold text-primary/80 disabled:opacity-50"
                                  >
                                    Add
                                  </button>
                                </td>
                              </tr>

                              {Array.from({ length: Math.max(0, COUNT_PAGE_SIZE - pagedLineItems.length - 1) }).map((_, idx) => (
                                <tr key={`count-empty-row-${idx}`} className="bg-white">
                                  <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                                  <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                                  <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>
                                  <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>
                                  <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>
                                  <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                                  <td className="px-2 py-1"></td>
                                </tr>
                              ))}
                            </tbody>
                            {lineItems.length > 0 ? (
                              <tfoot>
                                <tr className="sticky bottom-0 z-10 bg-slate-700 text-white">
                                  <td className="px-2 py-1.5 text-[10px] font-semibold" colSpan={3}>
                                    Totals
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-semibold">{lineItems.length} lines</td>
                                  <td className="px-2 py-1.5 text-center font-semibold">
                                    {totals.totalVariance > 0 ? `+${totals.totalVariance}` : totals.totalVariance}
                                  </td>
                                  <td className="px-2 py-1.5 font-semibold">{formatMoney(totals.totalAdjustmentValue)}</td>
                                  <td className="px-2 py-1.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setLineItems([])}
                                      className="rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-white/25"
                                      disabled={saving || countSessionStatus === "reconciled"}
                                    >
                                      Clear
                                    </button>
                                  </td>
                                </tr>
                              </tfoot>
                            ) : null}
                          </table>
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-on-surface-variant">
                            Total Variance:{" "}
                            <span className="font-semibold text-on-surface">
                              {totals.totalVariance > 0 ? `+${totals.totalVariance}` : totals.totalVariance}
                            </span>
                          </span>
                          <span className="text-[10px] text-on-surface-variant">
                            Total Adjustment Value:{" "}
                            <span className="font-semibold text-on-surface">{formatMoney(totals.totalAdjustmentValue)}</span>
                          </span>
                          <span className="text-[10px] text-on-surface-variant">
                            Status: <span className="font-semibold text-on-surface">{statusLabel(countSessionStatus)}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void persistCount("in_progress")}
                            disabled={saving || countSessionStatus === "reconciled"}
                            className="h-6 rounded-full bg-surface-container px-2.5 text-[9px] font-bold text-on-surface disabled:opacity-60"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void persistCount("completed")}
                            disabled={saving || countSessionStatus === "reconciled"}
                            className="h-6 rounded-full bg-primary px-2.5 text-[9px] font-bold text-white disabled:opacity-45"
                          >
                            Submit
                          </button>
                          <button
                            type="button"
                            onClick={approveCount}
                            disabled={saving || countSessionStatus !== "completed" || isApproved}
                            className="h-6 rounded-full bg-blue-600 px-2.5 text-[9px] font-bold text-white disabled:opacity-45"
                          >
                            {isApproved ? "Approved" : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void persistCount("reconciled")}
                            disabled={saving || countSessionStatus !== "completed" || !isApproved}
                            className="h-6 rounded-full bg-emerald-600 px-2.5 text-[9px] font-bold text-white disabled:opacity-45"
                          >
                            Finalize
                          </button>
                        </div>
                      </div>

                      {saveMessage ? <p className="text-[10px] font-medium text-primary">{saveMessage}</p> : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
