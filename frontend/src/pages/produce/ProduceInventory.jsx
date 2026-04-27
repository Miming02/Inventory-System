import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { convertItemQuantity } from "../../lib/unitConversion";
import { useDistinctLocations } from "../../lib/useDistinctLocations";

function normText(v) {
  return String(v || "").trim();
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function todayYmd() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusLabel(status) {
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Not Started";
}

function getFinishedGoodId(bom) {
  return (
    bom?.finished_good_item_id ??
    bom?.finished_item_id ??
    bom?.finished_product_item_id ??
    bom?.product_item_id ??
    null
  );
}

function isMissingColumnError(err, columnName) {
  const msg = String(getErrorMessage(err) || "").toLowerCase();
  return msg.includes(`column "${String(columnName || "").toLowerCase()}"`) && msg.includes("does not exist");
}

function StatusBadge({ status }) {
  if (status === "completed") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
        <span className="material-symbols-outlined text-[14px]">check_circle</span>
        Completed
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
        <span className="material-symbols-outlined text-[14px]">cancel</span>
        Failed
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

export default function ProduceInventory() {
  const { profile } = useAuth();
  const locations = useDistinctLocations(true);
  const [boms, setBoms] = useState([]);
  const [selectedBomId, setSelectedBomId] = useState("");
  const [bomItems, setBomItems] = useState([]);
  const [location, setLocation] = useState("");
  const [productionDate, setProductionDate] = useState(todayYmd());
  const [produceQty, setProduceQty] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeRun, setActiveRun] = useState(null);
  const [stockByItemId, setStockByItemId] = useState(new Map());
  const [hasInventoryItemLocationsTable, setHasInventoryItemLocationsTable] = useState(true);
  const [finishedGoodById, setFinishedGoodById] = useState(new Map());

  useEffect(() => {
    if (!location && locations.length > 0) setLocation(locations[0]);
  }, [location, locations]);

  const producedByLabel = useMemo(() => {
    const fn = normText(profile?.first_name);
    const ln = normText(profile?.last_name);
    if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
    return normText(profile?.email) || "—";
  }, [profile?.email, profile?.first_name, profile?.last_name]);

  const loadBoms = useCallback(async () => {
    setLoading(true);
    setError("");
    let result = await supabase
      .from("boms")
      .select("*")
      .in("status", ["active", "draft"])
      .order("updated_at", { ascending: false })
      .limit(400);
    if (result.error && isMissingColumnError(result.error, "status")) {
      result = await supabase.from("boms").select("*").order("updated_at", { ascending: false }).limit(400);
    }
    if (result.error) {
      setLoading(false);
      setError(getErrorMessage(result.error));
      return;
    }

    const sourceRows = result.data ?? [];
    const list = sourceRows
      .filter((row) => {
        // When `status` exists, keep active/draft only. If missing, keep all.
        if (!Object.prototype.hasOwnProperty.call(row, "status")) return true;
        const s = String(row.status || "").toLowerCase();
        return s === "active" || s === "draft";
      })
      .map((row) => ({
      ...row,
      _finishedGoodItemId: getFinishedGoodId(row),
    }));
    const fgIds = [...new Set(list.map((row) => row._finishedGoodItemId).filter(Boolean))];
    let fgMap = new Map();
    if (fgIds.length > 0) {
      const fgRes = await supabase
        .from("inventory_items")
        .select("id,name,sku,unit_cost,unit_of_measure,item_type,is_active")
        .in("id", fgIds)
        .limit(1000);
      if (!fgRes.error) {
        for (const row of fgRes.data ?? []) fgMap.set(row.id, row);
      }
    }
    setFinishedGoodById(fgMap);

    const valid = list.filter((row) => {
      const fg = fgMap.get(row._finishedGoodItemId);
      if (!row._finishedGoodItemId) return false;
      if (!fg) return true;
      return fg.is_active !== false;
    });

    setBoms(valid);
    setLoading(false);
    if (!selectedBomId && valid.length > 0) setSelectedBomId(valid[0].id);
  }, [selectedBomId]);

  const loadBomItems = useCallback(async (bomId) => {
    if (!bomId) {
      setBomItems([]);
      return;
    }
    const { data, error: e } = await supabase
      .from("bom_items")
      .select("id,bom_id,component_item_id,quantity,unit,inventory_items(id,name,sku,unit_cost,unit_of_measure,is_active)")
      .eq("bom_id", bomId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(5000);
    if (e) {
      setError(getErrorMessage(e));
      setBomItems([]);
      return;
    }
    setBomItems(data ?? []);
  }, []);

  const loadActiveRun = useCallback(async () => {
    if (!profile?.id) {
      setActiveRun(null);
      return;
    }
    let result = await supabase
      .from("production_runs")
      .select("id,production_number,status,bom_id,location,target_quantity,output_unit,created_by")
      .eq("created_by", profile.id)
      .in("status", ["not_started", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error && isMissingColumnError(result.error, "status")) {
      result = await supabase
        .from("production_runs")
        .select("id,production_number,status,bom_id,location,target_quantity,output_unit,created_by")
        .eq("created_by", profile.id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (!result.error) {
        const rows = result.data ?? [];
        const picked =
          rows.find((row) => {
            const s = String(row?.status || "").toLowerCase();
            return s === "not_started" || s === "in_progress";
          }) ?? null;
        setActiveRun(picked);
        return;
      }
    }
    if (result.error) {
      setError(getErrorMessage(result.error));
      setActiveRun(null);
      return;
    }
    setActiveRun(result.data ?? null);
  }, [profile?.id]);

  useEffect(() => {
    void loadBoms();
    void loadActiveRun();
  }, [loadActiveRun, loadBoms]);

  useEffect(() => {
    void loadBomItems(selectedBomId);
  }, [loadBomItems, selectedBomId]);

  const selectedBom = useMemo(() => boms.find((row) => row.id === selectedBomId) ?? null, [boms, selectedBomId]);
  const selectedFinishedGood = useMemo(() => {
    const fgId = selectedBom?._finishedGoodItemId;
    if (!fgId) return null;
    return finishedGoodById.get(fgId) ?? null;
  }, [finishedGoodById, selectedBom]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const itemIds = [...new Set((bomItems ?? []).map((row) => row.component_item_id).filter(Boolean))];
      const loc = normText(location);
      if (!itemIds.length || !loc) {
        if (!cancelled) setStockByItemId(new Map());
        return;
      }
      const locationRes = hasInventoryItemLocationsTable
        ? await supabase.from("inventory_item_locations").select("item_id,quantity").in("item_id", itemIds).eq("location", loc).limit(5000)
        : { data: [], error: null };
      if (cancelled) return;
      if (locationRes.error) {
        const msg = getErrorMessage(locationRes.error);
        const missingTable = msg.includes("inventory_item_locations") && (msg.includes("does not exist") || msg.includes("schema cache"));
        if (!missingTable) {
          setError(msg);
          return;
        }
        setHasInventoryItemLocationsTable(false);
        const fallback = await supabase.from("inventory_items").select("id,current_stock,location").in("id", itemIds).eq("location", loc).limit(5000);
        if (fallback.error) {
          setError(getErrorMessage(fallback.error));
          return;
        }
        const map = new Map();
        for (const row of fallback.data ?? []) map.set(row.id, toNumber(row.current_stock, 0));
        setStockByItemId(map);
        return;
      }
      const map = new Map();
      for (const row of locationRes.data ?? []) map.set(row.item_id, toNumber(row.quantity, 0));
      setStockByItemId(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [bomItems, hasInventoryItemLocationsTable, location]);

  const rawMaterialRows = useMemo(() => {
    const qty = toNumber(produceQty, NaN);
    if (!selectedBom || !Number.isFinite(qty) || qty <= 0) return [];
    const outputQty = Math.max(toNumber(selectedBom.output_quantity, 1), 0.000001);
    const multiplier = qty / outputQty;
    return (bomItems ?? []).map((line) => {
      const comp = Array.isArray(line.inventory_items) ? line.inventory_items[0] : line.inventory_items;
      const fromUnit = normText(line.unit) || "unit";
      const baseUnit = normText(comp?.unit_of_measure) || fromUnit;
      const requiredSourceQty = toNumber(line.quantity, 0) * multiplier;
      const unitCost = toNumber(comp?.unit_cost, 0);
      return {
        id: line.id,
        itemId: line.component_item_id,
        sku: comp?.sku || "—",
        name: comp?.name || "Component",
        sourceQty: requiredSourceQty,
        sourceUnit: fromUnit,
        baseUnit,
        stockQty: toNumber(stockByItemId.get(line.component_item_id), 0),
        unitCost,
      };
    });
  }, [bomItems, produceQty, selectedBom, stockByItemId]);

  const [computedRawRows, setComputedRawRows] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = [];
      for (const row of rawMaterialRows) {
        let baseConsumed = toNumber(row.sourceQty, 0);
        try {
          baseConsumed = await convertItemQuantity({
            itemId: row.itemId,
            qty: row.sourceQty,
            fromUnit: row.sourceUnit,
            toUnit: row.baseUnit,
          });
        } catch {
          // Keep fallback source quantity as base when conversion setup is missing.
        }
        const insufficient = baseConsumed > row.stockQty + 1e-9;
        next.push({
          ...row,
          quantityConsumed: baseConsumed,
          cost: baseConsumed * row.unitCost,
          insufficient,
        });
      }
      if (!cancelled) setComputedRawRows(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [rawMaterialRows]);

  const finishedGoodRows = useMemo(() => {
    if (!selectedFinishedGood) return [];
    const qty = toNumber(produceQty, 0);
    const unitCost = toNumber(selectedFinishedGood.unit_cost, 0);
    return [
      {
        id: selectedFinishedGood.id,
        sku: selectedFinishedGood.sku || "—",
        name: selectedFinishedGood.name || "Finished Good",
        quantityProduced: qty,
        value: qty * unitCost,
      },
    ];
  }, [produceQty, selectedFinishedGood]);

  const totals = useMemo(() => {
    const totalRawCost = computedRawRows.reduce((sum, row) => sum + toNumber(row.cost, 0), 0);
    const totalProducedValue = finishedGoodRows.reduce((sum, row) => sum + toNumber(row.value, 0), 0);
    return { totalRawCost, totalProducedValue };
  }, [computedRawRows, finishedGoodRows]);

  const hasInsufficientStock = computedRawRows.some((row) => row.insufficient);
  const runStatus = String(activeRun?.status || "not_started").toLowerCase();

  const validateBeforeRun = () => {
    if (!selectedBomId) {
      setError("Select a BOM.");
      return false;
    }
    if (!selectedBom?._finishedGoodItemId) {
      setError("Selected BOM has no finished good item reference.");
      return false;
    }
    if (!productionDate) {
      setError("Production Date is required.");
      return false;
    }
    if (!producedByLabel || producedByLabel === "—") {
      setError("Produced By is required.");
      return false;
    }
    if (!normText(location)) {
      setError("Location is required.");
      return false;
    }
    if (!computedRawRows.length) {
      setError("BOM has no raw materials.");
      return false;
    }
    if (hasInsufficientStock) {
      setError("Validate stock failed. Insufficient stock for one or more raw materials.");
      return false;
    }
    return true;
  };

  const buildRequiredComponents = () =>
    computedRawRows.map((row) => ({
      item_id: row.itemId,
      sku: row.sku,
      name: row.name,
      required_base_qty: row.quantityConsumed,
      base_unit: row.baseUnit,
    }));

  const saveProduction = async () => {
    setError("");
    setNotice("");
    if (!validateBeforeRun()) return;
    setSaving(true);
    try {
      const qty = toNumber(produceQty, 0);
      const outputUnit = normText(selectedBom?.output_unit) || normText(selectedFinishedGood?.unit_of_measure) || "unit";
      const productionNumber = `PRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const payload = {
        production_number: productionNumber,
        bom_id: selectedBom.id,
        location,
        target_quantity: qty,
        output_unit: outputUnit,
        finished_good_base_qty: qty,
        add_finished_goods: true,
        required_components: buildRequiredComponents(),
        status: "not_started",
        created_by: profile?.id ?? null,
        notes: `Produced by ${producedByLabel} on ${productionDate}`,
      };

      const fgId = selectedBom._finishedGoodItemId;
      payload.finished_good_item_id = fgId;
      let insert = await supabase
        .from("production_runs")
        .insert(payload)
        .select("id,production_number,status,bom_id,location,target_quantity,output_unit,created_by")
        .single();

      if (insert.error && String(getErrorMessage(insert.error)).includes("finished_good_item_id")) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.finished_good_item_id;
        fallbackPayload.finished_item_id = fgId;
        insert = await supabase
          .from("production_runs")
          .insert(fallbackPayload)
          .select("id,production_number,status,bom_id,location,target_quantity,output_unit,created_by")
          .single();
      }
      if (insert.error && isMissingColumnError(insert.error, "status")) {
        const noStatusPayload = { ...payload };
        delete noStatusPayload.status;
        noStatusPayload.finished_good_item_id = fgId;
        insert = await supabase
          .from("production_runs")
          .insert(noStatusPayload)
          .select("id,production_number,status,bom_id,location,target_quantity,output_unit,created_by")
          .single();
      }

      if (insert.error) throw insert.error;
      setActiveRun(insert.data);
      setNotice("Production saved as Not Started.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const startProduction = async () => {
    setError("");
    setNotice("");
    if (!validateBeforeRun()) return;
    if (!activeRun?.id) {
      await saveProduction();
      return;
    }
    setSaving(true);
    try {
      let update = await supabase
        .from("production_runs")
        .update({ status: "in_progress", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", activeRun.id);
      if (update.error && isMissingColumnError(update.error, "status")) {
        update = await supabase
          .from("production_runs")
          .update({ started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", activeRun.id);
      }
      if (update.error) throw update.error;
      await loadActiveRun();
      setNotice("Production started.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const completeProduction = async () => {
    if (!activeRun?.id) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: rpcErr } = await supabase.rpc("process_production_run", {
        p_run_id: activeRun.id,
        p_action: "complete",
        p_failure_reason: null,
      });
      if (rpcErr) throw rpcErr;
      await loadActiveRun();
      setNotice("Production completed.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const failProduction = async () => {
    if (!activeRun?.id) return;
    const reason = window.prompt("Reason for failure (optional):", "");
    if (reason == null) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: rpcErr } = await supabase.rpc("process_production_run", {
        p_run_id: activeRun.id,
        p_action: "fail",
        p_failure_reason: String(reason || "").trim() || null,
      });
      if (rpcErr) throw rpcErr;
      await loadActiveRun();
      setNotice("Production marked as failed.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed pb-24 md:pb-0">
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-white/80 shadow-sm shadow-blue-900/5 backdrop-blur-xl dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8 max-w-[1440px]">
          <Link to="/dashboard" className="text-xl font-bold tracking-tighter text-slate-900 transition-opacity hover:opacity-90 dark:text-white font-headline">
            Inventory
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1500px] px-2 pb-4 pt-[4.2rem] sm:px-3 lg:px-4">
        <section className="py-1">
          <div className="relative mx-auto w-full overflow-hidden rounded-[1.4rem] border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest to-surface shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            <div className="min-h-[calc(100dvh-5.2rem)]">
              <div className="relative h-[calc(100dvh-6.3rem)] min-h-0 overflow-hidden bg-transparent p-1 sm:p-1.5 lg:p-2 flex flex-col">
                <Link to="/dashboard" className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-outline-variant/20 bg-white text-on-surface-variant transition-all hover:border-error/20 hover:text-error" aria-label="Close produce page" title="Close">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </Link>
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.15rem] border border-slate-200/70 bg-white/90 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                  <div className="flex items-start justify-between rounded-t-[1.15rem] bg-primary px-3 py-2.5 text-white">
                    <h2 className="font-headline text-sm font-extrabold tracking-tight text-white">Produce Inventory (BOM)</h2>
                    <StatusBadge status={runStatus} />
                  </div>
                  <div className="flex h-full min-h-0 flex-col space-y-1 p-2 pt-0 overflow-hidden">
                    {error ? <p className="text-sm font-medium text-error">{error}</p> : null}
                    <div className="mb-1.5 grid grid-cols-1 gap-1 md:grid-cols-4">
                      <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                        <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Production Date *</label>
                        <input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} disabled={saving} className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                      </div>
                      <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                        <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Produced By *</label>
                        <input value={producedByLabel} readOnly className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                      </div>
                      <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                        <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Location *</label>
                        <select value={location} onChange={(e) => setLocation(e.target.value)} disabled={saving} className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]">
                          <option value="">Select location...</option>
                          {locations.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                        <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">BOM / Qty</label>
                        <div className="grid grid-cols-[1fr_64px] gap-1">
                          <select value={selectedBomId} onChange={(e) => setSelectedBomId(e.target.value)} disabled={loading || saving} className="h-5 rounded-md border-none bg-white px-1.5 text-[10px]">
                            <option value="">{loading ? "Loading..." : "Select BOM..."}</option>
                            {boms.map((bom) => {
                              const fg = finishedGoodById.get(bom._finishedGoodItemId);
                              return (
                                <option key={bom.id} value={bom.id}>
                                  {(fg?.sku || "—") + " - " + (fg?.name || bom.name || "BOM")}
                                </option>
                              );
                            })}
                          </select>
                          <input value={produceQty} onChange={(e) => setProduceQty(e.target.value)} type="number" min="0.000001" step="0.000001" className="h-5 rounded-md border-none bg-white px-1.5 text-[10px] text-center" />
                        </div>
                      </div>
                    </div>

                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-1.5 lg:grid-cols-2">
                      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200">
                        <div className="bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-on-surface-variant">Raw Materials Table</div>
                        <div className="h-full min-h-[180px] overflow-x-auto">
                          <table className="w-full min-w-[560px] table-fixed text-left text-[10px]">
                            <thead className="sticky top-0 z-10 bg-slate-100">
                              <tr>
                                <th className="w-[26%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">SKU</th>
                                <th className="w-[32%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Item Name</th>
                                <th className="w-[20%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Quantity Consumed</th>
                                <th className="w-[22%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Cost</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80 bg-white">
                              {computedRawRows.map((row) => (
                                <tr key={row.id} className={row.insufficient ? "bg-red-50/40" : ""}>
                                  <td className="truncate px-2 py-1 font-medium">{row.sku}</td>
                                  <td className="truncate px-2 py-1">{row.name}</td>
                                  <td className="px-2 py-1 text-center">{toNumber(row.quantityConsumed, 0).toFixed(2)}</td>
                                  <td className="px-2 py-1">{formatMoney(row.cost)}</td>
                                </tr>
                              ))}
                              {computedRawRows.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-2 py-3 text-center text-[10px] text-slate-400">
                                    No BOM materials
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200">
                        <div className="bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-on-surface-variant">Finished Goods Table</div>
                        <div className="h-full min-h-[180px] overflow-x-auto">
                          <table className="w-full min-w-[560px] table-fixed text-left text-[10px]">
                            <thead className="sticky top-0 z-10 bg-slate-100">
                              <tr>
                                <th className="w-[26%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">SKU</th>
                                <th className="w-[32%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Item Name</th>
                                <th className="w-[20%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Quantity Produced</th>
                                <th className="w-[22%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80 bg-white">
                              {finishedGoodRows.map((row) => (
                                <tr key={row.id}>
                                  <td className="truncate px-2 py-1 font-medium">{row.sku}</td>
                                  <td className="truncate px-2 py-1">{row.name}</td>
                                  <td className="px-2 py-1 text-center">{toNumber(row.quantityProduced, 0).toFixed(2)}</td>
                                  <td className="px-2 py-1">{formatMoney(row.value)}</td>
                                </tr>
                              ))}
                              {finishedGoodRows.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-2 py-3 text-center text-[10px] text-slate-400">
                                    Select BOM to preview output
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-on-surface-variant">Total Raw Cost: <span className="font-semibold text-on-surface">{formatMoney(totals.totalRawCost)}</span></span>
                        <span className="text-[10px] text-on-surface-variant">Total Produced Value: <span className="font-semibold text-on-surface">{formatMoney(totals.totalProducedValue)}</span></span>
                        <span className="text-[10px] text-on-surface-variant">Status: <span className="font-semibold text-on-surface">{statusLabel(runStatus)}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => void saveProduction()} disabled={saving || runStatus === "in_progress"} className="h-6 rounded-full bg-surface-container px-2.5 text-[9px] font-bold text-on-surface disabled:opacity-60">Save</button>
                        <button type="button" onClick={() => void startProduction()} disabled={saving || runStatus === "in_progress"} className="h-6 rounded-full bg-primary px-2.5 text-[9px] font-bold text-white disabled:opacity-45">Start</button>
                        <button type="button" onClick={() => void completeProduction()} disabled={saving || runStatus !== "in_progress"} className="h-6 rounded-full bg-emerald-600 px-2.5 text-[9px] font-bold text-white disabled:opacity-45">Complete</button>
                        <button type="button" onClick={() => void failProduction()} disabled={saving || runStatus !== "in_progress"} className="h-6 rounded-full bg-red-600 px-2.5 text-[9px] font-bold text-white disabled:opacity-45">Fail</button>
                      </div>
                    </div>

                    <div className="mt-1 grid grid-cols-1 gap-1 md:grid-cols-3">
                      <p className={`rounded-md border px-2 py-1 text-[9px] ${computedRawRows.length > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                        Rule: Auto explode BOM {computedRawRows.length > 0 ? "OK" : "Pending"}
                      </p>
                      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] text-emerald-700">
                        Rule: Deduct all levels on Complete
                      </p>
                      <p className={`rounded-md border px-2 py-1 text-[9px] ${hasInsufficientStock ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                        Rule: Validate stock {hasInsufficientStock ? "Failed" : "Passed"}
                      </p>
                    </div>

                    {notice ? <p className="text-[10px] font-medium text-primary">{notice}</p> : null}
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
