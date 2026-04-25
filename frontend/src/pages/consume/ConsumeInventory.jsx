import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { convertItemQuantity } from "../../lib/unitConversion";
import { useDistinctLocations } from "../../lib/useDistinctLocations";
import { NotificationBell } from "../../components/NotificationBell";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";

function normText(v) {
  return String(v || "").trim();
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function itemLabel(it) {
  if (!it) return "—";
  const sku = normText(it.sku);
  const name = normText(it.name);
  if (sku && name) return `${sku} - ${name}`;
  return sku || name || "—";
}

function formatInt(n) {
  const num = Number(n ?? 0);
  if (!Number.isFinite(num)) return String(n ?? "");
  return new Intl.NumberFormat().format(Math.round(num));
}

export default function ConsumeInventory() {
  const { profile, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [activeRun, setActiveRun] = useState(null);

  const [boms, setBoms] = useState([]);
  const [selectedBomId, setSelectedBomId] = useState("");
  const [bomItems, setBomItems] = useState([]);
  const [produceQty, setProduceQty] = useState("1");
  const [addFinishedGoods, setAddFinishedGoods] = useState(true);

  const locations = useDistinctLocations(true);
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (!location && locations.length > 0) {
      setLocation(locations[0]);
    }
  }, [location, locations]);

  const loadBoms = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: e } = await supabase
      .from("boms")
      .select(
        "id,name,code,finished_good_item_id,output_quantity,output_unit,status,version,updated_at,created_at,inventory_items(name,sku,unit_of_measure,item_type,is_active)"
      )
      .in("status", ["active", "draft"])
      .order("updated_at", { ascending: false })
      .limit(400);

    if (e) {
      setError(getErrorMessage(e));
      setBoms([]);
      setSelectedBomId("");
      setLoading(false);
      return;
    }

    const list = (data ?? []).filter((b) => {
      const inv = b.inventory_items;
      const fg = Array.isArray(inv) ? inv[0] : inv;
      return fg && fg.is_active !== false && fg.item_type === "finished_good";
    });

    setBoms(list);
    setLoading(false);

    if (!selectedBomId && list.length > 0) {
      setSelectedBomId(list[0].id);
    } else if (selectedBomId && !list.some((b) => b.id === selectedBomId)) {
      setSelectedBomId(list[0]?.id ?? "");
    }
  }, [selectedBomId]);

  const loadBomItems = useCallback(async (bomId) => {
    if (!bomId) {
      setBomItems([]);
      return;
    }
    setError("");
    const { data, error: e } = await supabase
      .from("bom_items")
      .select(
        "id,bom_id,component_item_id,quantity,unit,waste_percent,sort_order,notes,inventory_items(name,sku,unit_of_measure,item_type,is_active)"
      )
      .eq("bom_id", bomId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(2500);
    if (e) {
      setError(getErrorMessage(e));
      setBomItems([]);
      return;
    }
    setBomItems(data ?? []);
  }, []);

  useEffect(() => {
    void loadBoms();
  }, [loadBoms]);

  useEffect(() => {
    void loadBomItems(selectedBomId);
  }, [loadBomItems, selectedBomId]);

  useEffect(() => {
    if (!success) return undefined;
    const t = window.setTimeout(() => setSuccess(null), 5000);
    return () => window.clearTimeout(t);
  }, [success]);

  const selectedBom = useMemo(() => boms.find((b) => b.id === selectedBomId) || null, [boms, selectedBomId]);
  const selectedFinishedGood = useMemo(() => {
    const inv = selectedBom?.inventory_items;
    return inv ? (Array.isArray(inv) ? inv[0] : inv) : null;
  }, [selectedBom?.inventory_items]);

  const [stockByItemId, setStockByItemId] = useState(new Map());
  const [hasInventoryItemLocationsTable, setHasInventoryItemLocationsTable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const itemIds = [...new Set((bomItems ?? []).map((ln) => ln.component_item_id).filter(Boolean))];
      const loc = normText(location);
      if (!loc || itemIds.length === 0) {
        if (!cancelled) setStockByItemId(new Map());
        return;
      }
      const locRes = hasInventoryItemLocationsTable
        ? await supabase
            .from("inventory_item_locations")
            .select("item_id,quantity")
            .in("item_id", itemIds)
            .eq("location", loc)
            .limit(5000)
        : { data: [], error: null };
      if (cancelled) return;
      if (locRes.error) {
        const msg = getErrorMessage(locRes.error);
        const isMissingPerLocationTable =
          msg.includes("inventory_item_locations") &&
          (msg.toLowerCase().includes("schema cache") || msg.toLowerCase().includes("does not exist"));

        if (!isMissingPerLocationTable) {
          setError((prev) => prev || msg);
          setStockByItemId(new Map());
          return;
        }

        setHasInventoryItemLocationsTable(false);

        // Fallback for environments where per-location table/migration is not yet applied.
        const { data: itemData, error: itemErr } = await supabase
          .from("inventory_items")
          .select("id,current_stock,location")
          .in("id", itemIds)
          .eq("location", loc)
          .limit(5000);

        if (cancelled) return;
        if (itemErr) {
          setError((prev) => prev || getErrorMessage(itemErr));
          setStockByItemId(new Map());
          return;
        }

        const fallbackMap = new Map();
        for (const row of itemData ?? []) {
          if (!row?.id) continue;
          fallbackMap.set(row.id, toNumber(row.current_stock, 0));
        }
        setStockByItemId(fallbackMap);
        return;
      }
      const map = new Map();
      for (const row of locRes.data ?? []) {
        if (!row?.item_id) continue;
        map.set(row.item_id, toNumber(row.quantity, 0));
      }
      setStockByItemId(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [bomItems, hasInventoryItemLocationsTable, location]);

  const explode = useMemo(() => {
    const bom = selectedBom;
    const fg = selectedFinishedGood;
    const qty = toNumber(produceQty, NaN);
    if (!bom || !fg || !Number.isFinite(qty) || qty <= 0 || !(bomItems?.length > 0)) return [];

    const bomOutputQty = toNumber(bom.output_quantity, 1);
    const multiplier = qty / Math.max(0.000001, bomOutputQty);

    return (bomItems ?? [])
      .map((ln) => {
        const inv = ln.inventory_items;
        const comp = inv ? (Array.isArray(inv) ? inv[0] : inv) : null;
        const perBatchQty = toNumber(ln.quantity, 0);
        const requiredInLineUnit = perBatchQty * multiplier;
        const fromUnit = normText(ln.unit) || "unit";
        const baseUnit = normText(comp?.unit_of_measure) || fromUnit || "unit";
        const stock = Math.max(0, toNumber(stockByItemId.get(ln.component_item_id), 0));
        return {
          id: ln.id,
          component_item_id: ln.component_item_id,
          component: comp,
          required_qty: requiredInLineUnit,
          required_unit: fromUnit,
          base_unit: baseUnit,
          stock_qty: stock,
        };
      })
      .filter((r) => r.component && r.component.is_active !== false);
  }, [bomItems, produceQty, selectedBom, selectedFinishedGood, stockByItemId]);

  const [computedRows, setComputedRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (explode.length === 0) {
        if (!cancelled) setComputedRows([]);
        return;
      }
      const out = [];
      for (const row of explode) {
        let requiredBase = toNumber(row.required_qty, 0);
        let usedFallback = false;
        try {
          requiredBase = await convertItemQuantity({
            itemId: row.component_item_id,
            qty: row.required_qty,
            fromUnit: row.required_unit,
            toUnit: row.base_unit,
          });
        } catch {
          usedFallback = true;
          requiredBase = toNumber(row.required_qty, 0);
        }
        out.push({
          ...row,
          required_base_qty: requiredBase,
          insufficient: requiredBase > row.stock_qty + 1e-9,
          _conversionFallback: usedFallback,
        });
      }
      if (cancelled) return;
      setComputedRows(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [explode]);

  const firstInsufficient = useMemo(() => computedRows.find((c) => c.insufficient) ?? null, [computedRows]);
  const hasInsufficient = Boolean(firstInsufficient);

  const canProceed = useMemo(() => {
    const qty = toNumber(produceQty, NaN);
    if (!selectedBomId) return false;
    if (!Number.isFinite(qty) || qty <= 0) return false;
    if (!normText(location)) return false;
    if (!computedRows.length) return false;
    if (hasInsufficient) return false;
    if (saving) return false;
    return true;
  }, [computedRows.length, hasInsufficient, location, produceQty, saving, selectedBomId]);

  const runStatusLabel = useMemo(() => {
    const status = String(activeRun?.status || "").toLowerCase();
    if (status === "completed") return "Completed";
    if (status === "failed") return "Failed";
    if (status === "in_progress") return "In Progress";
    return "Not Started";
  }, [activeRun?.status]);

  const loadActiveRun = useCallback(async () => {
    if (!profile?.id) {
      setActiveRun(null);
      return;
    }
    const { data, error: runErr } = await supabase
      .from("production_runs")
      .select("id,production_number,status,bom_id,location,target_quantity,output_unit,add_finished_goods,started_at,created_by")
      .eq("status", "in_progress")
      .eq("created_by", profile.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (runErr) {
      setActiveRun(null);
      return;
    }
    setActiveRun(data ?? null);
  }, [profile?.id]);

  const startProduction = useCallback(async () => {
    setError("");
    setSuccess(null);
    const bom = selectedBom;
    const fg = selectedFinishedGood;
    const loc = normText(location);
    const qty = toNumber(produceQty, NaN);
    if (activeRun && String(activeRun.status || "").toLowerCase() === "in_progress") {
      return setError("Complete or fail the active production run before starting another one.");
    }
    if (!bom || !fg) return setError("Select a finished product.");
    if (!loc) return setError("Select a location.");
    if (!Number.isFinite(qty) || qty <= 0) return setError("Quantity to produce must be > 0.");
    if (!computedRows.length) return setError("This BOM has no components yet.");
    if (computedRows.some((r) => r.insufficient)) return setError("Insufficient stock for one or more components.");

    setSaving(true);
    try {
      const createdBy = profile?.id ?? null;
      const finishedGoodBaseUnit = normText(fg.unit_of_measure) || normText(bom.output_unit) || "unit";
      const bomOutputUnit = normText(bom.output_unit) || finishedGoodBaseUnit;

      const fgBaseQty = await convertItemQuantity({
        itemId: bom.finished_good_item_id,
        qty,
        fromUnit: bomOutputUnit,
        toUnit: finishedGoodBaseUnit,
      });

      const requiredComponents = computedRows.map((row) => ({
        item_id: row.component_item_id,
        name: row.component?.name || null,
        sku: row.component?.sku || null,
        required_base_qty: row.required_base_qty,
        base_unit: row.base_unit,
      }));
      const productionNumber = `PRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { data: createdRun, error: e } = await supabase
        .from("production_runs")
        .insert({
          production_number: productionNumber,
          bom_id: bom.id,
          finished_good_item_id: bom.finished_good_item_id,
          location: loc,
          target_quantity: qty,
          output_unit: bomOutputUnit,
          finished_good_base_qty: fgBaseQty,
          add_finished_goods: addFinishedGoods,
          required_components: requiredComponents,
          status: "in_progress",
          created_by: createdBy,
        })
        .select("id,production_number,status,bom_id,location,target_quantity,output_unit,add_finished_goods,started_at,created_by")
        .single();
      if (e) throw e;
      setActiveRun(createdRun);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [
    activeRun,
    addFinishedGoods,
    computedRows,
    location,
    produceQty,
    profile?.id,
    selectedBom,
    selectedFinishedGood,
  ]);

  const completeProduction = useCallback(async () => {
    if (!activeRun?.id) return;
    setSaving(true);
    setError("");
    setSuccess(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("process_production_run", {
        p_run_id: activeRun.id,
        p_action: "complete",
        p_failure_reason: null,
      });
      if (rpcErr) throw rpcErr;
      setActiveRun(data ?? null);
      setSuccess({
        fg: itemLabel(selectedFinishedGood),
        qty: toNumber(activeRun.target_quantity, toNumber(produceQty, 0)),
        unit: normText(activeRun.output_unit) || normText(selectedBom?.output_unit) || "unit",
        lineCount: computedRows.length,
      });
      await loadBomItems(selectedBomId);
      await loadActiveRun();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [activeRun, computedRows.length, loadActiveRun, loadBomItems, produceQty, selectedBom?.output_unit, selectedBomId, selectedFinishedGood]);

  const failProduction = useCallback(async () => {
    if (!activeRun?.id) return;
    const reason = window.prompt("Reason for failure (optional):", "");
    if (reason == null) return;
    setSaving(true);
    setError("");
    try {
      const { data, error: rpcErr } = await supabase.rpc("process_production_run", {
        p_run_id: activeRun.id,
        p_action: "fail",
        p_failure_reason: String(reason || "").trim() || null,
      });
      if (rpcErr) throw rpcErr;
      setActiveRun(data ?? null);
      await loadActiveRun();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [activeRun?.id, loadActiveRun]);

  useEffect(() => {
    void loadActiveRun();
  }, [loadActiveRun]);

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
              <UserAvatarOrIcon src={profile?.avatar_url} alt={itemLabel(profile)} size="md" />
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-center px-2 pb-20 pt-[4.4rem] sm:px-3 lg:px-4 md:pb-2">
        <section className="px-1 py-2 sm:px-2">
          <div className="relative mx-auto w-full overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest to-surface shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            <Link
              to="/dashboard"
              className="absolute right-5 top-5 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-white/90 text-on-surface-variant shadow-sm transition-all hover:border-error/20 hover:bg-white hover:text-error"
              aria-label="Close"
              title="Close"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </Link>
            <div className="min-h-[calc(100dvh-7.2rem)] p-1.5 sm:p-2 lg:p-2.5">
              <section className="relative h-full overflow-auto bg-transparent p-1 sm:p-1.5 lg:p-2">
                <div className="mx-auto mb-2 max-w-[1200px] rounded-[1.35rem] border border-slate-200/70 bg-white/90 px-4 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                  <h2 className="text-lg font-extrabold tracking-tight text-on-surface font-headline">Produce Inventory</h2>
                  <p className="text-xs text-on-surface-variant">
                    Flow: Not Started -&gt; In Progress -&gt; Completed or Failed. Inventory updates happen when production is completed.
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1 text-[11px] font-bold text-on-surface">
                    <span className="material-symbols-outlined text-[14px]">timelapse</span>
                    Status: {runStatusLabel}
                    {activeRun?.production_number ? ` (${activeRun.production_number})` : ""}
                  </div>
                </div>
                <div className="mx-auto max-w-[1200px] space-y-4">
                  {error ? (
                    <div className="rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-on-surface">{error}</div>
                  ) : null}
                  {hasInsufficient ? (
                    <div className="rounded-xl border border-tertiary/20 bg-tertiary-fixed px-4 py-3 text-sm text-on-tertiary-fixed-variant">
                      <p className="font-bold">Not enough stock for some components</p>
                      <p className="mt-1 text-xs">
                        Location <span className="font-semibold">&quot;{location || "—"}&quot;</span> is missing{" "}
                        {formatInt(Math.max(0, (firstInsufficient?.required_base_qty ?? 0) - (firstInsufficient?.stock_qty ?? 0)))}{" "}
                        {firstInsufficient?.base_unit ?? "units"} of {firstInsufficient?.component?.name ?? "a component"}.
                      </p>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
                    <section className="rounded-[1.35rem] border border-slate-200/70 bg-white/90 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Finished Product (BOM)</label>
                          <select
                            value={selectedBomId}
                            onChange={(e) => setSelectedBomId(e.target.value)}
                            className="h-10 w-full appearance-none rounded-lg border-none bg-surface-container-highest px-3 text-sm focus:ring-2 focus:ring-primary/20"
                            disabled={loading}
                          >
                            {boms.length === 0 ? <option value="">No BOMs found…</option> : null}
                            {boms.map((b) => {
                              const inv = b.inventory_items;
                              const fg = inv ? (Array.isArray(inv) ? inv[0] : inv) : null;
                              const label = fg ? itemLabel(fg) : b.name;
                              return (
                                <option key={b.id} value={b.id}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                          {selectedBom && selectedFinishedGood ? (
                            <p className="text-[10px] text-on-surface-variant">
                              Output:{" "}
                              <span className="font-semibold">
                                {selectedBom.output_quantity} {selectedBom.output_unit}
                              </span>{" "}
                              · FG base: <span className="font-semibold">{selectedFinishedGood.unit_of_measure || "unit"}</span>
                            </p>
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Produce From</label>
                          <select
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="h-10 w-full appearance-none rounded-lg border-none bg-surface-container-highest px-3 text-sm focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">Select location…</option>
                            {locations.map((l) => (
                              <option key={l} value={l}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Quantity to Produce</label>
                          <div className="relative">
                            <input
                              className="h-10 w-full rounded-lg border-none bg-surface-container-highest px-3 pr-16 text-sm font-semibold focus:ring-2 focus:ring-primary/20"
                              type="number"
                              inputMode="decimal"
                              min={0.000001}
                              step={0.000001}
                              value={produceQty}
                              onChange={(e) => setProduceQty(e.target.value)}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-on-surface-variant">
                              {normText(selectedBom?.output_unit) || "Units"}
                            </div>
                          </div>
                        </div>

                        <label className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface">
                          <input
                            checked={addFinishedGoods}
                            onChange={(e) => setAddFinishedGoods(e.target.checked)}
                            className="h-4 w-4 rounded border-outline-variant"
                            type="checkbox"
                          />
                          Add finished goods to inventory
                        </label>
                      </div>

                      <div className="mt-3 border-t border-outline-variant/15 pt-3">
                        <button
                          type="button"
                          onClick={() => void startProduction()}
                          disabled={!canProceed || (activeRun && String(activeRun.status || "").toLowerCase() === "in_progress")}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-container px-4 text-sm font-semibold text-on-primary shadow-lg shadow-primary/10 transition-all disabled:opacity-50"
                        >
                          {saving ? "Starting..." : "Start Production"}
                          <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </button>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => void completeProduction()}
                            disabled={!activeRun?.id || String(activeRun?.status || "").toLowerCase() !== "in_progress" || saving}
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            onClick={() => void failProduction()}
                            disabled={!activeRun?.id || String(activeRun?.status || "").toLowerCase() !== "in_progress" || saving}
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Fail
                          </button>
                        </div>
                        <p className="mt-2 text-[10px] leading-snug text-on-surface-variant">
                          {loading
                            ? "Loading BOMs…"
                            : !selectedBomId
                              ? "No BOM selected. Create a BOM first under BOM management."
                              : computedRows.length === 0
                                ? "This BOM has no components yet. Add BOM items under BOM management."
                                : !normText(location)
                                  ? "Select a location to produce from."
                                  : hasInsufficient
                                    ? "Insufficient stock for one or more components."
                                    : activeRun && String(activeRun.status || "").toLowerCase() === "in_progress"
                                      ? "Production is in progress. Click Complete to apply stock changes or Fail to cancel."
                                    : addFinishedGoods
                                      ? "Will deduct components and add finished goods on completion."
                                      : "Will deduct components only on completion."}
                        </p>
                        <div className="mt-2">
                          <Link to="/bom" className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1.5 text-[11px] font-bold text-primary">
                            <span className="material-symbols-outlined text-sm">account_tree</span>
                            Manage BOMs
                          </Link>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <div className="overflow-hidden rounded-[1.35rem] border border-slate-200/70 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="bg-surface-container-low/60 text-on-surface-variant">
                              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider">Component Item</th>
                              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Required</th>
                              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Stock</th>
                              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-right">Unit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/10">
                            {loading ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-8 text-sm text-on-surface-variant">
                                  Loading…
                                </td>
                              </tr>
                            ) : computedRows.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-8 text-sm text-on-surface-variant">
                                  No BOM components to display.
                                </td>
                              </tr>
                            ) : (
                              computedRows.map((c) => (
                                <tr key={c.id} className="hover:bg-surface-container/30">
                                  <td className="px-4 py-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-semibold text-on-surface">{c.component?.name ?? "Component"}</div>
                                      <div className="text-[11px] text-on-surface-variant">SKU: {c.component?.sku ?? "—"}</div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right text-xs font-semibold text-on-surface">{formatInt(c.required_base_qty)}</td>
                                  <td className="px-4 py-3 text-right">
                                    <span
                                      className={[
                                        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold",
                                        c.insufficient ? "bg-tertiary-fixed text-on-tertiary-fixed-variant" : "bg-green-100 text-green-700",
                                      ].join(" ")}
                                    >
                                      {formatInt(c.stock_qty)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right text-xs text-on-surface-variant">{c.base_unit}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Total Weight</div>
                          <div className="text-2xl font-extrabold tracking-tight text-on-surface">—</div>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">BOM Integrity</div>
                          <div className="text-2xl font-extrabold tracking-tight text-on-surface">
                            {!selectedBomId ? "—" : computedRows.length === 0 ? "Missing lines" : hasInsufficient ? "Stock blocked" : "Ready"}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-primary p-4 text-on-primary">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-on-primary-container">Est. Completion</div>
                          <div className="text-2xl font-extrabold tracking-tight">—</div>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>

      {success ? (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] w-[min(100%-2rem,420px)] pointer-events-auto"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-green-200/80 dark:border-green-800/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_12px_40px_-8px_rgba(0,0,0,0.2)] p-4 pr-3">
            <div className="p-2 rounded-xl bg-green-50 dark:bg-green-950/50 shrink-0">
              <span className="material-symbols-outlined text-green-700 dark:text-green-400 text-2xl">check_circle</span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-bold text-sm text-on-surface font-headline">Production completed successfully</p>
              <p className="text-xs text-on-surface-variant mt-1">
                {success.fg} · {success.qty} {success.unit} · {success.lineCount} component line
                {success.lineCount === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSuccess(null)}
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

