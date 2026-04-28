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

function formatQuantity(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

async function loadEffectiveStockByItemIds(itemIds, locationName) {
  const ids = [...new Set((itemIds ?? []).filter(Boolean))];
  if (!ids.length) return new Map();

  const stockMap = new Map();
  const normalizedLocation = normText(locationName);

  if (normalizedLocation) {
    const locationRes = await supabase
      .from("inventory_item_locations")
      .select("item_id,quantity")
      .in("item_id", ids)
      .eq("location", normalizedLocation)
      .limit(5000);

    if (!locationRes.error) {
      for (const row of locationRes.data ?? []) {
        stockMap.set(row.item_id, toNumber(row.quantity, 0));
      }
    }
  }

  const globalRes = await supabase
    .from("inventory_items")
    .select("id,current_stock")
    .in("id", ids)
    .limit(5000);
  if (globalRes.error) throw globalRes.error;

  for (const row of globalRes.data ?? []) {
    const itemId = row?.id;
    if (!itemId) continue;
    const globalQty = toNumber(row.current_stock, 0);
    const localQty = toNumber(stockMap.get(itemId), 0);
    stockMap.set(itemId, Math.max(localQty, globalQty));
  }

  return stockMap;
}

async function loadLocationBalancesByItemIds(itemIds) {
  const ids = [...new Set((itemIds ?? []).filter(Boolean))];
  const balances = new Map();
  if (!ids.length) return balances;

  const locationRes = await supabase
    .from("inventory_item_locations")
    .select("item_id,location,quantity")
    .in("item_id", ids)
    .limit(10000);

  if (!locationRes.error) {
    for (const row of locationRes.data ?? []) {
      const itemId = row?.item_id;
      if (!itemId) continue;
      if (!balances.has(itemId)) balances.set(itemId, []);
      balances.get(itemId).push({
        location: normText(row.location) || "—",
        qty: toNumber(row.quantity, 0),
      });
    }
  }

  const globalRes = await supabase
    .from("inventory_items")
    .select("id,current_stock,location")
    .in("id", ids)
    .limit(5000);
  if (globalRes.error) throw globalRes.error;

  for (const row of globalRes.data ?? []) {
    const itemId = row?.id;
    if (!itemId) continue;
    const globalQty = toNumber(row.current_stock, 0);
    const current = balances.get(itemId) ?? [];
    const totalLocations = current.reduce((sum, entry) => sum + toNumber(entry.qty, 0), 0);
    if (current.length === 0 && globalQty > 0) {
      balances.set(itemId, [{
        location: normText(row.location) || "—",
        qty: globalQty,
      }]);
      continue;
    }
    if (globalQty > totalLocations + 1e-9) {
      balances.set(itemId, [
        ...current,
        {
          location: "Unassigned",
          qty: globalQty - totalLocations,
        },
      ]);
    }
  }

  return balances;
}

async function loadLatestInboundCostByItemLocation(itemIds) {
  const ids = [...new Set((itemIds ?? []).filter(Boolean))];
  const costByItemLocation = new Map();
  if (!ids.length) return costByItemLocation;

  const movementRes = await supabase
    .from("stock_movements")
    .select("item_id,to_location,unit_cost,created_at")
    .in("item_id", ids)
    .not("to_location", "is", null)
    .not("unit_cost", "is", null)
    .order("created_at", { ascending: false })
    .limit(15000);
  if (movementRes.error) return costByItemLocation;

  for (const row of movementRes.data ?? []) {
    const itemId = row?.item_id;
    const location = normText(row?.to_location);
    if (!itemId || !location) continue;
    const key = `${itemId}::${location.toLowerCase()}`;
    if (!costByItemLocation.has(key)) {
      costByItemLocation.set(key, toNumber(row.unit_cost, 0));
    }
  }

  return costByItemLocation;
}

function buildConsumptionAllocations(balances, requiredQty, preferredLocation, costByItemLocation, itemId, fallbackUnitCost) {
  const ordered = [...(balances ?? [])]
    .filter((entry) => toNumber(entry.qty, 0) > 0)
    .sort((a, b) => {
      const qtyDiff = toNumber(a.qty, 0) - toNumber(b.qty, 0);
      if (Math.abs(qtyDiff) > 1e-9) return qtyDiff;
      return normText(a.location).localeCompare(normText(b.location));
    });

  let remaining = Math.max(toNumber(requiredQty, 0), 0);
  const allocations = [];
  for (const entry of ordered) {
    if (remaining <= 1e-9) break;
    const available = toNumber(entry.qty, 0);
    if (available <= 0) continue;
    const takenQty = Math.min(available, remaining);
    const costKey = `${itemId}::${normText(entry.location).toLowerCase()}`;
    allocations.push({
      location: entry.location,
      qty: takenQty,
      unitCost: costByItemLocation.has(costKey)
        ? toNumber(costByItemLocation.get(costKey), 0)
        : toNumber(fallbackUnitCost, 0),
    });
    remaining -= takenQty;
  }
  return allocations;
}

function statusLabel(status) {
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Not Started";
}

function getFinishedGoodId(bom) {
  const description = String(bom?.description || "");
  const markerMatch = description.match(/\[FG_ID:([0-9a-fA-F-]{36})\]/);
  if (markerMatch?.[1]) return markerMatch[1];
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

function getMissingColumnName(err) {
  const msg = String(getErrorMessage(err) || "");
  const quoted = msg.match(/column "([^"]+)"/i);
  if (quoted?.[1]) return String(quoted[1]).trim();
  const singleQuoted = msg.match(/column '([^']+)'/i);
  if (singleQuoted?.[1]) return String(singleQuoted[1]).trim();
  const bare = msg.match(/column\s+([a-zA-Z0-9_]+)\s+/i);
  return bare?.[1] ? String(bare[1]).trim() : "";
}

function isInvalidJsonInputError(err) {
  const msg = String(getErrorMessage(err) || "").toLowerCase();
  return msg.includes("invalid input syntax for type json");
}

function isMissingTableError(err, tableName) {
  const msg = String(getErrorMessage(err) || "").toLowerCase();
  const t = String(tableName || "").toLowerCase();
  return msg.includes(t) && (msg.includes("does not exist") || msg.includes("schema cache"));
}

function getNotNullColumnName(err) {
  const msg = String(getErrorMessage(err) || "");
  const quoted = msg.match(/null value in column "([^"]+)"/i);
  if (quoted?.[1]) return String(quoted[1]).trim();
  const singleQuoted = msg.match(/null value in column '([^']+)'/i);
  if (singleQuoted?.[1]) return String(singleQuoted[1]).trim();
  return "";
}

async function resolveCostBasis(itemId, baseUnitCost) {
  const direct = Number(baseUnitCost ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  if (!itemId) return 0;

  const [poItemRes, receiveItemRes] = await Promise.all([
    supabase
      .from("purchase_order_items")
      .select("unit_price,created_at")
      .eq("item_id", itemId)
      .not("unit_price", "is", null)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("receive_transaction_items")
      .select("unit_cost,created_at")
      .eq("item_id", itemId)
      .not("unit_cost", "is", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const poCost = Number(poItemRes.data?.[0]?.unit_price ?? 0);
  if (Number.isFinite(poCost) && poCost > 0) return poCost;

  const receiveCost = Number(receiveItemRes.data?.[0]?.unit_cost ?? 0);
  if (Number.isFinite(receiveCost) && receiveCost > 0) return receiveCost;

  return 0;
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
  const [productionSuccess, setProductionSuccess] = useState(null);
  const [stockByItemId, setStockByItemId] = useState(new Map());
  const [stockCheckFailed, setStockCheckFailed] = useState(false);
  const [hasInventoryItemLocationsTable, setHasInventoryItemLocationsTable] = useState(true);
  const [finishedGoodById, setFinishedGoodById] = useState(new Map());
  const [resolvedFinishedGoodUnitCost, setResolvedFinishedGoodUnitCost] = useState(0);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [bomQuery, setBomQuery] = useState("");
  const [bomMenuOpen, setBomMenuOpen] = useState(false);
  const locationOptions = useMemo(() => {
    const byKey = new Map();
    for (const loc of locations) {
      const v = normText(loc);
      if (!v) continue;
      const key = v.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, v);
    }
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }, [locations]);

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
      // Keep BOMs with no linked finished-good id so legacy records can still be selected.
      if (!row._finishedGoodItemId) return true;
      if (!fg) return true;
      return fg.is_active !== false;
    });

    const deduped = [];
    const seen = new Set();
    for (const row of valid) {
      const fgKey = normText(row._finishedGoodItemId);
      const key = fgKey ? `fg:${fgKey}` : `bom:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
    }
    setBoms(deduped);
    setLoading(false);
  }, [selectedBomId]);

  const loadBomItems = useCallback(async (bomId) => {
    if (!bomId) {
      setBomItems([]);
      return;
    }
    const modern = await supabase
      .from("bom_items")
      .select("id,bom_id,component_item_id,quantity,unit,inventory_items(id,name,sku,unit_cost,unit_of_measure,is_active)")
      .eq("bom_id", bomId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(5000);
    if (!modern.error) {
      setBomItems(modern.data ?? []);
      return;
    }
    if (!isMissingColumnError(modern.error, "component_item_id")) {
      setError(getErrorMessage(modern.error));
      setBomItems([]);
      return;
    }
    const legacy = await supabase
      .from("bom_items")
      .select("id,bom_id,item_id,quantity,unit,required_base_qty,created_at")
      .eq("bom_id", bomId)
      .order("created_at", { ascending: true })
      .limit(5000);
    if (legacy.error) {
      setError(getErrorMessage(legacy.error));
      setBomItems([]);
      return;
    }
    const itemIds = [...new Set((legacy.data ?? []).map((row) => row.item_id).filter(Boolean))];
    const inventoryMap = new Map();
    if (itemIds.length > 0) {
      const invRes = await supabase
        .from("inventory_items")
        .select("id,name,sku,unit_cost,unit_of_measure,is_active")
        .in("id", itemIds)
        .limit(5000);
      if (!invRes.error) {
        for (const it of invRes.data ?? []) inventoryMap.set(it.id, it);
      }
    }
    const normalized = (legacy.data ?? []).map((row) => ({
      ...row,
      component_item_id: row.item_id,
      inventory_items: inventoryMap.get(row.item_id) ?? null,
    }));
    setBomItems(normalized);
  }, []);

  const loadActiveRun = useCallback(async () => {
    if (!profile?.id) {
      setActiveRun(null);
      return;
    }
    if (!selectedBomId) {
      setActiveRun(null);
      return;
    }
    let result = await supabase
      .from("production_runs")
      .select("id,production_number,status,bom_id,location,target_quantity,output_unit,created_by")
      .eq("created_by", profile.id)
      .eq("bom_id", selectedBomId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (result.error && isMissingColumnError(result.error, "status")) {
      result = await supabase
        .from("production_runs")
        .select("id,production_number,status,bom_id,location,target_quantity,output_unit,created_by")
        .eq("created_by", profile.id)
        .eq("bom_id", selectedBomId)
        .order("created_at", { ascending: false })
        .limit(25);
    }
    if (result.error) {
      setError(getErrorMessage(result.error));
      setActiveRun(null);
      return;
    }
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    const normalizedLocation = normText(location).toLowerCase();
    const nextRun =
      rows.find((row) => {
        const status = String(row?.status || "").toLowerCase();
        if (!["not_started", "in_progress", "draft"].includes(status)) return false;
        if (!normalizedLocation) return true;
        return normText(row?.location).toLowerCase() === normalizedLocation;
      }) || null;
    setActiveRun(nextRun);
  }, [location, profile?.id, selectedBomId]);

  useEffect(() => {
    void loadBoms();
    void loadActiveRun();
  }, [loadActiveRun, loadBoms]);

  useEffect(() => {
    if (!productionSuccess) return undefined;
    const timer = window.setTimeout(() => setProductionSuccess(null), 5000);
    return () => window.clearTimeout(timer);
  }, [productionSuccess]);

  useEffect(() => {
    void loadBomItems(selectedBomId);
  }, [loadBomItems, selectedBomId]);

  const selectedBom = useMemo(() => boms.find((row) => row.id === selectedBomId) ?? null, [boms, selectedBomId]);
  const selectedFinishedGood = useMemo(() => {
    const fgId = selectedBom?._finishedGoodItemId;
    if (!fgId) return null;
    return finishedGoodById.get(fgId) ?? null;
  }, [finishedGoodById, selectedBom]);
  const bomOptionLabel = useCallback(
    (bom) => {
      const fg = finishedGoodById.get(bom?._finishedGoodItemId);
      const sku = normText(fg?.sku);
      const name = normText(fg?.name || bom?.name);
      if (sku && name) return `${sku} - ${name}`;
      if (name) return name;
      if (sku) return sku;
      return "BOM";
    },
    [finishedGoodById]
  );
  const filteredBoms = useMemo(() => {
    const q = normText(bomQuery).toLowerCase();
    if (!q) return boms;
    return boms.filter((bom) => {
      const label = bomOptionLabel(bom).toLowerCase();
      const bomName = normText(bom?.name).toLowerCase();
      const fg = finishedGoodById.get(bom?._finishedGoodItemId);
      const fgSku = normText(fg?.sku).toLowerCase();
      return label.includes(q) || bomName.includes(q) || fgSku.includes(q);
    });
  }, [bomOptionLabel, bomQuery, boms, finishedGoodById]);
  const filteredLocations = useMemo(() => {
    const q = normText(locationQuery).toLowerCase();
    if (!q) return locationOptions;
    return locationOptions.filter((loc) => loc.toLowerCase().includes(q));
  }, [locationOptions, locationQuery]);

  useEffect(() => {
    const selected = boms.find((row) => row.id === selectedBomId) ?? null;
    setBomQuery(selected ? bomOptionLabel(selected) : "");
  }, [bomOptionLabel, boms, selectedBomId]);
  useEffect(() => {
    setLocationQuery(normText(location));
  }, [location]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const itemIds = [...new Set((bomItems ?? []).map((row) => row.component_item_id || row.item_id).filter(Boolean))];
      const loc = normText(location);
      if (!itemIds.length || !loc) {
        if (!cancelled) setStockByItemId(new Map());
        return;
      }
      const allBalances = await loadLocationBalancesByItemIds(itemIds);
      if (cancelled) return;
      const map = new Map();
      for (const [itemId, entries] of allBalances.entries()) {
        map.set(itemId, entries.reduce((sum, entry) => sum + toNumber(entry.qty, 0), 0));
      }
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
      const resolvedItemId = line.component_item_id || line.item_id || comp?.id || "";
      const fromUnit = normText(line.unit) || "unit";
      const baseUnit = normText(comp?.unit_of_measure) || fromUnit;
      const requiredSourceQty = toNumber(line.quantity, 0) * multiplier;
      const unitCost = toNumber(comp?.unit_cost, 0);
      return {
        id: line.id,
        itemId: resolvedItemId,
        sku: comp?.sku || "—",
        name: comp?.name || "Component",
        sourceQty: requiredSourceQty,
        sourceUnit: fromUnit,
        baseUnit,
        stockQty: toNumber(stockByItemId.get(line.component_item_id || line.item_id), 0),
        unitCost,
      };
    });
  }, [bomItems, produceQty, selectedBom, stockByItemId]);

  const [computedRawRows, setComputedRawRows] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = [];
      const itemIds = [...new Set(rawMaterialRows.map((row) => row.itemId).filter(Boolean))];
      const [balancesByItem, costByItemLocation] = await Promise.all([
        loadLocationBalancesByItemIds(itemIds),
        loadLatestInboundCostByItemLocation(itemIds),
      ]);
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
        const resolvedUnitCost = await resolveCostBasis(row.itemId, row.unitCost);
        const balances = balancesByItem.get(row.itemId) ?? [];
        const totalAvailable = balances.reduce((sum, entry) => sum + toNumber(entry.qty, 0), 0);
        const allocations = buildConsumptionAllocations(
          balances,
          baseConsumed,
          location,
          costByItemLocation,
          row.itemId,
          resolvedUnitCost
        );
        const allocatedCost = allocations.reduce((sum, entry) => sum + toNumber(entry.qty, 0) * toNumber(entry.unitCost, 0), 0);
        const insufficient = baseConsumed > totalAvailable + 1e-9;
        next.push({
          ...row,
          unitCost: allocations.length > 0 && baseConsumed > 1e-9 ? allocatedCost / baseConsumed : resolvedUnitCost,
          quantityConsumed: baseConsumed,
          totalAvailable,
          allocations,
          cost: allocations.length > 0 ? allocatedCost : baseConsumed * resolvedUnitCost,
          insufficient,
        });
      }
      if (!cancelled) setComputedRawRows(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [rawMaterialRows]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const itemId = selectedFinishedGood?.id;
      if (!itemId) {
        if (!cancelled) setResolvedFinishedGoodUnitCost(0);
        return;
      }
      const cost = await resolveCostBasis(itemId, selectedFinishedGood?.unit_cost);
      if (!cancelled) setResolvedFinishedGoodUnitCost(cost);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedFinishedGood?.id, selectedFinishedGood?.unit_cost]);

  const finishedGoodRows = useMemo(() => {
    if (!selectedFinishedGood) return [];
    const qty = toNumber(produceQty, 0);
    const rawCostTotal = computedRawRows.reduce((sum, row) => sum + toNumber(row.cost, 0), 0);
    const fallbackUnitCost = qty > 0 ? rawCostTotal / qty : 0;
    const unitCost = toNumber(resolvedFinishedGoodUnitCost, 0) > 0
      ? toNumber(resolvedFinishedGoodUnitCost, 0)
      : fallbackUnitCost;
    return [
      {
        id: selectedFinishedGood.id,
        sku: selectedFinishedGood.sku || "—",
        name: selectedFinishedGood.name || "Finished Good",
        quantityProduced: qty,
        value: qty * unitCost,
      },
    ];
  }, [computedRawRows, produceQty, resolvedFinishedGoodUnitCost, selectedFinishedGood]);

  const totals = useMemo(() => {
    const totalRawCost = computedRawRows.reduce((sum, row) => sum + toNumber(row.cost, 0), 0);
    const totalProducedValue = finishedGoodRows.reduce((sum, row) => sum + toNumber(row.value, 0), 0);
    return { totalRawCost, totalProducedValue };
  }, [computedRawRows, finishedGoodRows]);

  const hasInsufficientStock = computedRawRows.some((row) => row.insufficient);
  const runStatus = String(activeRun?.status || "not_started").toLowerCase();
  const validateStockNow = useCallback(async () => {
    const knownItemIds = [...new Set(computedRawRows.map((row) => row.itemId).filter(Boolean))];
    const unresolvedSkus = [...new Set(
      computedRawRows
        .filter((row) => !row.itemId && normText(row.sku) && row.sku !== "—")
        .map((row) => normText(row.sku))
    )];
    let itemIds = [...knownItemIds];
    const resolvedIdBySku = new Map();
    if (unresolvedSkus.length > 0) {
      const skuRes = await supabase
        .from("inventory_items")
        .select("id,sku")
        .in("sku", unresolvedSkus)
        .limit(5000);
      if (!skuRes.error) {
        for (const row of skuRes.data ?? []) {
          const key = normText(row.sku).toLowerCase();
          if (!key) continue;
          resolvedIdBySku.set(key, row.id);
          itemIds.push(row.id);
        }
        itemIds = [...new Set(itemIds.filter(Boolean))];
      }
    }
    if (itemIds.length === 0) {
      setStockCheckFailed(false);
      return { ok: true, shortItems: [] };
    }
    const shortItems = [];
    for (const row of computedRawRows) {
      const effectiveItemId = row.itemId || resolvedIdBySku.get(normText(row.sku).toLowerCase()) || "";
      const required = toNumber(row.quantityConsumed, 0);
      const liveRow = computedRawRows.find((entry) => (entry.itemId || resolvedIdBySku.get(normText(entry.sku).toLowerCase()) || "") === effectiveItemId);
      const available = toNumber(liveRow?.totalAvailable, 0);
      if (required > available + 1e-9) {
        shortItems.push(`${row.sku || row.name || "Item"} (need ${required.toFixed(2)}, have ${available.toFixed(2)})`);
      }
    }
    const ok = shortItems.length === 0;
    setStockCheckFailed(!ok);
    return { ok, shortItems };
  }, [computedRawRows, location]);

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
    if (!validateBeforeRun()) return null;
    setSaving(true);
    try {
      const stockCheck = await validateStockNow();
      if (!stockCheck.ok) {
        setError(`Validate stock failed. Insufficient stock: ${stockCheck.shortItems.join("; ")}`);
        return null;
      }
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
      const tryInsertWithMissingColumnFallback = async (initialPayload) => {
        let nextPayload = { ...initialPayload };
        const removedColumns = new Set();
        let triedStringifiedRequiredComponents = false;
        let triedRemovingRequiredComponents = false;
        for (let i = 0; i < 20; i += 1) {
          const res = await supabase
            .from("production_runs")
            .insert(nextPayload)
            .select("id,production_number,status,bom_id,location,target_quantity,output_unit,created_by")
            .single();
          if (!res.error) return res;
          if (isInvalidJsonInputError(res.error) && Object.prototype.hasOwnProperty.call(nextPayload, "required_components")) {
            if (!triedStringifiedRequiredComponents) {
              triedStringifiedRequiredComponents = true;
              nextPayload = {
                ...nextPayload,
                required_components: JSON.stringify(nextPayload.required_components ?? []),
              };
              continue;
            }
            if (!triedRemovingRequiredComponents) {
              triedRemovingRequiredComponents = true;
              const { required_components: _requiredComponents, ...withoutRequiredComponents } = nextPayload;
              nextPayload = withoutRequiredComponents;
              continue;
            }
          }
          const missingColumn = getMissingColumnName(res.error);
          if (!missingColumn || !Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) return res;
          if (removedColumns.has(missingColumn)) return res;
          removedColumns.add(missingColumn);
          const { [missingColumn]: _removed, ...trimmed } = nextPayload;
          nextPayload = trimmed;
        }
        return await supabase
          .from("production_runs")
          .insert(nextPayload)
          .select("id,production_number,status,bom_id,location,target_quantity,output_unit,created_by")
          .single();
      };

      let insert = await tryInsertWithMissingColumnFallback({
        ...payload,
        finished_good_item_id: fgId,
      });

      if (insert.error && isMissingColumnError(insert.error, "finished_good_item_id")) {
        insert = await tryInsertWithMissingColumnFallback({
          ...payload,
          finished_item_id: fgId,
        });
      }

      if (insert.error) throw insert.error;
      setActiveRun(insert.data);
      setNotice(`Production saved as Not Started (${insert.data?.production_number || "run created"}).`);
      setProductionSuccess({
        title: "Production saved",
        message: `${insert.data?.production_number || "Production run"} is ready to start.`,
      });
      return insert.data ?? null;
    } catch (e) {
      setError(getErrorMessage(e));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateProductionRunWithFallback = useCallback(async (runId, initialPayload) => {
    let nextPayload = { ...initialPayload };
    const removedColumns = new Set();
    for (let i = 0; i < 20; i += 1) {
      const res = await supabase.from("production_runs").update(nextPayload).eq("id", runId);
      if (!res.error) return res;
      const missingColumn = getMissingColumnName(res.error);
      if (!missingColumn || !Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) return res;
      if (removedColumns.has(missingColumn)) return res;
      removedColumns.add(missingColumn);
      const { [missingColumn]: _removed, ...trimmed } = nextPayload;
      nextPayload = trimmed;
    }
    return await supabase.from("production_runs").update(nextPayload).eq("id", runId);
  }, []);

  const startProduction = async () => {
    setError("");
    setNotice("");
    if (!validateBeforeRun()) return;
    try {
      const stockCheck = await validateStockNow();
      if (!stockCheck.ok) {
        setError(`Validate stock failed. Insufficient stock: ${stockCheck.shortItems.join("; ")}`);
        return;
      }
    } catch (e) {
      setError(getErrorMessage(e));
      return;
    }
    let runId = activeRun?.id || "";
    if (!runId) {
      const createdRun = await saveProduction();
      runId = createdRun?.id || "";
      if (!runId) return;
    }
    setSaving(true);
    try {
      const update = await updateProductionRunWithFallback(runId, {
        status: "in_progress",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (update.error) throw update.error;
      await loadActiveRun();
      setNotice("Production started (In Progress).");
      setProductionSuccess({
        title: "Production started",
        message: `${activeRun?.production_number || "Production run"} is now in progress.`,
      });
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
      const stockCheck = await validateStockNow();
      if (!stockCheck.ok) {
        throw new Error(`Cannot complete production. Insufficient stock: ${stockCheck.shortItems.join("; ")}`);
      }
      const deltas = [];
      let rawLineCount = 0;
      for (const row of computedRawRows) {
        if (!row?.itemId) continue;
        rawLineCount += 1;
        deltas.push({
          itemId: row.itemId,
          deltaQty: -toNumber(row.quantityConsumed, 0),
        });
      }
      if (rawLineCount === 0) {
        throw new Error("No raw-material lines detected for deduction. Please reselect BOM and try again.");
      }
      if (selectedFinishedGood?.id) {
        deltas.push({
          itemId: selectedFinishedGood.id,
          deltaQty: toNumber(produceQty, 0),
        });
      }
      const mergedByItem = new Map();
      for (const row of deltas) {
        if (!row.itemId) continue;
        mergedByItem.set(row.itemId, toNumber(mergedByItem.get(row.itemId), 0) + toNumber(row.deltaQty, 0));
      }
      const itemIds = [...mergedByItem.keys()];
      if (itemIds.length === 0) {
        throw new Error("No inventory adjustments were generated for this production run.");
      }
      const liveBalancesByItem = await loadLocationBalancesByItemIds(itemIds);
      const stockRes = await supabase.from("inventory_items").select("id,current_stock").in("id", itemIds).limit(5000);
      if (stockRes.error) throw stockRes.error;
      const currentById = new Map();
      for (const row of stockRes.data ?? []) {
        const itemId = row?.id;
        if (!itemId) continue;
        const locationTotal = (liveBalancesByItem.get(itemId) ?? []).reduce(
          (sum, entry) => sum + toNumber(entry.qty, 0),
          0
        );
        const globalQty = toNumber(row.current_stock, 0);
        currentById.set(itemId, Math.max(locationTotal, globalQty));
      }
      const stockItemMeta = new Map();
      for (const row of computedRawRows) {
        if (row?.itemId) stockItemMeta.set(row.itemId, row);
      }
      if (selectedFinishedGood?.id) {
        stockItemMeta.set(selectedFinishedGood.id, {
          sku: selectedFinishedGood.sku || "—",
          name: selectedFinishedGood.name || "Finished Good",
        });
      }
      const nextById = new Map();
      for (const itemId of itemIds) {
        const nextStock = toNumber(currentById.get(itemId), 0) + toNumber(mergedByItem.get(itemId), 0);
        if (nextStock < -1e-9) {
          const meta = stockItemMeta.get(itemId);
          const available = toNumber(currentById.get(itemId), 0);
          const required = Math.abs(Math.min(toNumber(mergedByItem.get(itemId), 0), 0));
          throw new Error(
            `Cannot complete production. ${meta?.sku || meta?.name || "Item"} needs ${formatQuantity(required)} but only ${formatQuantity(available)} is available.`
          );
        }
        const clampedNext = Math.max(0, nextStock);
        nextById.set(itemId, clampedNext);
      }

      const normalizedLocation = normText(location);
      const nextLocationTotalsByItem = new Map(
        [...liveBalancesByItem.entries()].map(([itemId, entries]) => [
          itemId,
          entries.reduce((sum, entry) => sum + toNumber(entry.qty, 0), 0),
        ])
      );
      for (const row of computedRawRows) {
        for (const allocation of row.allocations ?? []) {
          const locRow = await supabase
            .from("inventory_item_locations")
            .select("id,quantity")
            .eq("item_id", row.itemId)
            .eq("location", allocation.location)
            .maybeSingle();
          if (locRow.error) {
            if (!isMissingTableError(locRow.error, "inventory_item_locations")) throw locRow.error;
            continue;
          }
          if (!locRow.data?.id) continue;
          const nextLocQty = Math.max(0, toNumber(locRow.data.quantity, 0) - toNumber(allocation.qty, 0));
          const { error: updateLocErr } = await supabase
            .from("inventory_item_locations")
            .update({ quantity: nextLocQty })
            .eq("id", locRow.data.id);
          if (updateLocErr) throw updateLocErr;
          nextLocationTotalsByItem.set(
            row.itemId,
            Math.max(0, toNumber(nextLocationTotalsByItem.get(row.itemId), 0) - toNumber(allocation.qty, 0))
          );
        }
      }
      if (selectedFinishedGood?.id && normalizedLocation) {
        const locRow = await supabase
          .from("inventory_item_locations")
          .select("id,quantity")
          .eq("item_id", selectedFinishedGood.id)
          .eq("location", normalizedLocation)
          .maybeSingle();
        if (locRow.error) {
          if (!isMissingTableError(locRow.error, "inventory_item_locations")) throw locRow.error;
        } else if (locRow.data?.id) {
          const nextLocQty = Math.max(0, toNumber(locRow.data.quantity, 0) + toNumber(produceQty, 0));
          const { error: updateLocErr } = await supabase
            .from("inventory_item_locations")
            .update({ quantity: nextLocQty })
            .eq("id", locRow.data.id);
          if (updateLocErr) throw updateLocErr;
          nextLocationTotalsByItem.set(
            selectedFinishedGood.id,
            toNumber(nextLocationTotalsByItem.get(selectedFinishedGood.id), 0) + toNumber(produceQty, 0)
          );
        } else {
          const insertRes = await supabase
            .from("inventory_item_locations")
            .insert({ item_id: selectedFinishedGood.id, location: normalizedLocation, quantity: toNumber(produceQty, 0) });
          if (insertRes.error && !isMissingTableError(insertRes.error, "inventory_item_locations")) throw insertRes.error;
          nextLocationTotalsByItem.set(
            selectedFinishedGood.id,
            toNumber(nextLocationTotalsByItem.get(selectedFinishedGood.id), 0) + toNumber(produceQty, 0)
          );
        }
      }

      for (const itemId of itemIds) {
        const nextStock = Math.max(
          0,
          Math.max(
            toNumber(nextLocationTotalsByItem.get(itemId), 0),
            toNumber(nextById.get(itemId), 0)
          )
        );
        const { error: updateStockErr } = await supabase
          .from("inventory_items")
          .update({ current_stock: nextStock })
          .eq("id", itemId);
        if (updateStockErr) throw updateStockErr;
      }

      const finishedQty = Math.max(toNumber(produceQty, 0), 0.000001);
      const fallbackFinishedUnitCost = toNumber(totals.totalRawCost, 0) / finishedQty;
      const finishedUnitCost = toNumber(resolvedFinishedGoodUnitCost, 0) > 0
        ? toNumber(resolvedFinishedGoodUnitCost, 0)
        : toNumber(fallbackFinishedUnitCost, 0);
      const insertMovementWithFallback = async (initialPayload) => {
        let nextPayload = { ...initialPayload };
        const removedColumns = new Set();
        for (let i = 0; i < 20; i += 1) {
          const res = await supabase.from("stock_movements").insert(nextPayload);
          if (!res.error) return res;
          const notNullColumn = getNotNullColumnName(res.error);
          if (notNullColumn) {
            if (notNullColumn === "reference_type") {
              nextPayload = { ...nextPayload, reference_type: "production_run" };
              continue;
            }
            if (notNullColumn === "reference_number") {
              nextPayload = {
                ...nextPayload,
                reference_number: String(activeRun?.production_number || activeRun?.id || "PRODUCTION"),
              };
              continue;
            }
            if (notNullColumn === "organization_id" && profile?.organization_id) {
              nextPayload = { ...nextPayload, organization_id: profile.organization_id };
              continue;
            }
          }
          const missingColumn = getMissingColumnName(res.error);
          if (!missingColumn || !Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) return res;
          if (removedColumns.has(missingColumn)) return res;
          removedColumns.add(missingColumn);
          const { [missingColumn]: _removed, ...trimmed } = nextPayload;
          nextPayload = trimmed;
        }
        return await supabase.from("stock_movements").insert(nextPayload);
      };
      for (const row of computedRawRows) {
        for (const allocation of row.allocations ?? []) {
          const movementRes = await insertMovementWithFallback({
            item_id: row.itemId,
            movement_type: "out",
            quantity: Math.abs(toNumber(allocation.qty, 0)),
            from_location: allocation.location || null,
            to_location: null,
            unit_cost: toNumber(allocation.unitCost, 0),
            created_by: profile?.id ?? null,
            reference_id: activeRun.id,
            reference_type: "production_run",
            reference_number: String(activeRun?.production_number || activeRun?.id || "PRODUCTION"),
            organization_id: profile?.organization_id || null,
          });
          if (movementRes.error && !isMissingTableError(movementRes.error, "stock_movements")) throw movementRes.error;
        }
      }
      if (selectedFinishedGood?.id) {
        const movementRes = await insertMovementWithFallback({
          item_id: selectedFinishedGood.id,
          movement_type: "in",
          quantity: Math.abs(toNumber(produceQty, 0)),
          from_location: null,
          to_location: normalizedLocation || null,
          unit_cost: finishedUnitCost,
          created_by: profile?.id ?? null,
          reference_id: activeRun.id,
          reference_type: "production_run",
          reference_number: String(activeRun?.production_number || activeRun?.id || "PRODUCTION"),
          organization_id: profile?.organization_id || null,
        });
        if (movementRes.error && !isMissingTableError(movementRes.error, "stock_movements")) throw movementRes.error;
      }

      const completeUpdate = await updateProductionRunWithFallback(activeRun.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (completeUpdate.error) throw completeUpdate.error;
      setActiveRun(null);
      setNotice("Production completed successfully. Raw materials deducted and finished goods added.");
      setProductionSuccess({
        title: "Production completed",
        message: `${activeRun?.production_number || "Production run"} was completed successfully.`,
      });
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
      if (rpcErr) {
        const failedUpdate = await updateProductionRunWithFallback(activeRun.id, {
          status: "failed",
          failed_at: new Date().toISOString(),
          failure_reason: String(reason || "").trim() || null,
          updated_at: new Date().toISOString(),
        });
        if (failedUpdate.error) throw failedUpdate.error;
      }
      setActiveRun(null);
      setNotice("Production marked as failed.");
      setProductionSuccess({
        title: "Production failed",
        message: `${activeRun?.production_number || "Production run"} was marked as failed.`,
      });
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
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.15rem] border border-slate-200/70 bg-white/90 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                  <div className="flex items-start justify-between rounded-t-[1.15rem] bg-primary px-3 py-2.5 text-white">
                    <h2 className="font-headline text-sm font-extrabold tracking-tight text-white">Produce Inventory (BOM)</h2>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={runStatus} />
                      <Link
                        to="/dashboard"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-all hover:border-white/40 hover:bg-white/20"
                        aria-label="Close produce page"
                        title="Close"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </Link>
                    </div>
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
                        <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">BOM / Qty</label>
                        <div className="grid grid-cols-[1fr_64px] gap-1">
                          <div className="relative">
                            <input
                              value={bomQuery}
                              onChange={(e) => {
                                setBomQuery(e.target.value);
                                setBomMenuOpen(true);
                                setSelectedBomId("");
                              }}
                              onFocus={() => setBomMenuOpen(true)}
                              onBlur={() => window.setTimeout(() => setBomMenuOpen(false), 120)}
                              disabled={loading || saving}
                              className="h-5 w-full rounded-md border-none bg-white px-1.5 pr-5 text-[10px]"
                              placeholder={loading ? "Loading..." : "Select BOM..."}
                            />
                            <span className="material-symbols-outlined pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[12px] text-slate-500">
                              expand_more
                            </span>
                            {bomMenuOpen ? (
                              <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                                {filteredBoms.length ? (
                                  filteredBoms.map((bom) => (
                                    <button
                                      key={bom.id}
                                      type="button"
                                      onMouseDown={() => {
                                        setSelectedBomId(bom.id);
                                        setBomQuery(bomOptionLabel(bom));
                                        setBomMenuOpen(false);
                                      }}
                                      className="w-full px-2 py-1 text-left text-[10px] text-slate-900 hover:bg-slate-100"
                                    >
                                      {bomOptionLabel(bom)}
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-2 py-1 text-[10px] text-slate-500">No BOM available</div>
                                )}
                              </div>
                            ) : null}
                          </div>
                          <input value={produceQty} onChange={(e) => setProduceQty(e.target.value)} type="number" min="0.000001" step="0.000001" className="h-5 rounded-md border-none bg-white px-1.5 text-[10px] text-center" />
                        </div>
                      </div>
                      <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                        <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Location *</label>
                        <div className="relative">
                          <input
                            value={locationQuery}
                            onChange={(e) => {
                              setLocationQuery(e.target.value);
                              setLocationMenuOpen(true);
                              setLocation("");
                            }}
                            onFocus={() => setLocationMenuOpen(true)}
                            onBlur={() => window.setTimeout(() => setLocationMenuOpen(false), 120)}
                            disabled={saving}
                            className="h-5 w-full rounded-md border-none bg-white px-1.5 pr-5 text-[10px]"
                            placeholder="Select location..."
                          />
                          <span className="material-symbols-outlined pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[12px] text-slate-500">
                            expand_more
                          </span>
                          {locationMenuOpen ? (
                            <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                              {filteredLocations.length ? (
                                filteredLocations.map((loc) => (
                                  <button
                                    key={loc}
                                    type="button"
                                    onMouseDown={() => {
                                      setLocation(loc);
                                      setLocationQuery(loc);
                                      setLocationMenuOpen(false);
                                    }}
                                    className="w-full px-2 py-1 text-left text-[10px] text-slate-900 hover:bg-slate-100"
                                  >
                                    {loc}
                                  </button>
                                ))
                              ) : (
                                <div className="px-2 py-1 text-[10px] text-slate-500">No locations available</div>
                              )}
                            </div>
                          ) : null}
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
                        <button type="button" onClick={() => void completeProduction()} disabled={saving || runStatus !== "in_progress"} className="h-6 rounded-full bg-emerald-600 px-2.5 text-[9px] font-bold text-white disabled:opacity-45">Mark Complete</button>
                        <button type="button" onClick={() => void failProduction()} disabled={saving || runStatus !== "in_progress"} className="h-6 rounded-full bg-red-600 px-2.5 text-[9px] font-bold text-white disabled:opacity-45">Mark Failed</button>
                      </div>
                    </div>

                    <div className="mt-1 grid grid-cols-1 gap-1 md:grid-cols-3">
                      <p className={`rounded-md border px-2 py-1 text-[9px] ${computedRawRows.length > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                        Rule: Auto explode BOM {computedRawRows.length > 0 ? "OK" : "Pending"}
                      </p>
                      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] text-emerald-700">
                        Rule: Deduct all levels on Complete
                      </p>
                      <p className={`rounded-md border px-2 py-1 text-[9px] ${stockCheckFailed || hasInsufficientStock ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                        Rule: Validate stock {stockCheckFailed || hasInsufficientStock ? "Failed" : "Passed"}
                      </p>
                    </div>

                      <p className="text-[9px] text-on-surface-variant">
                        Workflow: Save (Not Started) {"->"} Start (In Progress) {"->"} Mark Complete or Mark Failed.
                      </p>
                    {notice ? <p className="text-[10px] font-medium text-primary">{notice}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      {productionSuccess ? (
        <div className="fixed bottom-6 left-1/2 z-[120] w-[min(100%-2rem,560px)] -translate-x-1/2 pointer-events-auto">
          <div className="flex items-start gap-3 rounded-3xl border border-green-200/80 bg-white/95 p-4 pr-3 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.2)] backdrop-blur-xl">
            <div className="shrink-0 rounded-2xl bg-green-50 p-2">
              <span className="material-symbols-outlined text-2xl text-green-700">check_circle</span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-headline text-sm font-bold text-on-surface">{productionSuccess.title}</p>
              <p className="mt-1 text-xs text-on-surface-variant">{productionSuccess.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setProductionSuccess(null)}
              className="shrink-0 rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high"
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
