import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { convertItemQuantity } from "../../lib/unitConversion";

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

export default function ManageBomAndConversions() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [boms, setBoms] = useState([]);
  const [itemConversions, setItemConversions] = useState([]);
  const [globalConversions, setGlobalConversions] = useState([]);

  const [activeTab, setActiveTab] = useState("boms"); // boms | explode | conversions
  const [selectedBomId, setSelectedBomId] = useState("");
  const [selectedBomItems, setSelectedBomItems] = useState([]);
  const [bomItemsLoading, setBomItemsLoading] = useState(false);

  const [bomForm, setBomForm] = useState({
    name: "",
    code: "",
    finished_good_item_id: "",
    output_quantity: "1",
    output_unit: "unit",
  });
  const [itemConversionForm, setItemConversionForm] = useState({
    item_id: "",
    from_unit: "",
    to_unit: "",
    factor: "",
  });
  const [globalConversionForm, setGlobalConversionForm] = useState({
    from_unit: "",
    to_unit: "",
    factor: "",
    note: "",
  });

  const [bomItemForm, setBomItemForm] = useState({
    component_item_id: "",
    quantity: "",
    unit: "",
    waste_percent: "0",
    notes: "",
  });

  const [explodeForm, setExplodeForm] = useState({
    target_qty: "1",
    target_unit: "",
  });
  const [explodeRows, setExplodeRows] = useState([]);
  const [explodeLoading, setExplodeLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [itemRes, bomRes, itemConvRes, globalConvRes] = await Promise.all([
      supabase.from("inventory_items").select("id,name,sku,item_type,unit_of_measure,is_active").order("name"),
      supabase
        .from("boms")
        .select("id,name,code,finished_good_item_id,output_quantity,output_unit,status,version,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("item_unit_conversions")
        .select("id,item_id,from_unit,to_unit,factor,note,created_at,inventory_items(name,sku)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("unit_conversions")
        .select("id,from_unit,to_unit,factor,note,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (itemRes.error || bomRes.error || itemConvRes.error || globalConvRes.error) {
      setError(getErrorMessage(itemRes.error || bomRes.error || itemConvRes.error || globalConvRes.error));
      setLoading(false);
      return;
    }
    setItems(itemRes.data ?? []);
    setBoms(bomRes.data ?? []);
    setItemConversions(itemConvRes.data ?? []);
    setGlobalConversions(globalConvRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadBomItems = useCallback(async (bomId) => {
    if (!bomId) {
      setSelectedBomItems([]);
      return;
    }
    setBomItemsLoading(true);
    setError("");
    const { data, error: e } = await supabase
      .from("bom_items")
      .select("id,bom_id,component_item_id,quantity,unit,waste_percent,sort_order,notes,inventory_items(name,sku,unit_of_measure,item_type)")
      .eq("bom_id", bomId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1000);
    if (e) {
      setError(getErrorMessage(e));
      setSelectedBomItems([]);
      setBomItemsLoading(false);
      return;
    }
    setSelectedBomItems(data ?? []);
    setBomItemsLoading(false);
  }, []);

  useEffect(() => {
    void loadBomItems(selectedBomId);
  }, [loadBomItems, selectedBomId]);

  const createBom = async (e) => {
    e.preventDefault();
    setError("");
    const fgId = normText(bomForm.finished_good_item_id);
    const fg = items.find((it) => it.id === fgId) || null;
    if (!fgId) {
      setError("Select a finished good item.");
      return;
    }
    if (fg && fg.item_type !== "finished_good") {
      setError("BOM output item must be a finished_good.");
      return;
    }
    const payload = {
      name: bomForm.name.trim(),
      code: bomForm.code.trim() || null,
      finished_good_item_id: fgId,
      output_quantity: Number(bomForm.output_quantity || 1),
      output_unit: bomForm.output_unit.trim() || "unit",
      status: "draft",
    };
    const { error: createErr } = await supabase.from("boms").insert(payload);
    if (createErr) {
      setError(getErrorMessage(createErr));
      return;
    }
    setBomForm({ name: "", code: "", finished_good_item_id: "", output_quantity: "1", output_unit: "unit" });
    await loadData();
  };

  const createItemConversion = async (e) => {
    e.preventDefault();
    setError("");
    const itemId = normText(itemConversionForm.item_id);
    if (!itemId) {
      setError("Select an item.");
      return;
    }
    const payload = {
      item_id: itemId,
      from_unit: normText(itemConversionForm.from_unit),
      to_unit: normText(itemConversionForm.to_unit),
      factor: Number(itemConversionForm.factor),
    };
    const { error: createErr } = await supabase.from("item_unit_conversions").insert(payload);
    if (createErr) {
      setError(getErrorMessage(createErr));
      return;
    }
    setItemConversionForm({ item_id: "", from_unit: "", to_unit: "", factor: "" });
    await loadData();
  };

  const createGlobalConversion = async (e) => {
    e.preventDefault();
    setError("");
    const payload = {
      from_unit: normText(globalConversionForm.from_unit),
      to_unit: normText(globalConversionForm.to_unit),
      factor: Number(globalConversionForm.factor),
      note: normText(globalConversionForm.note) || null,
    };
    const { error: e1 } = await supabase.from("unit_conversions").insert(payload);
    if (e1) {
      setError(getErrorMessage(e1));
      return;
    }
    setGlobalConversionForm({ from_unit: "", to_unit: "", factor: "", note: "" });
    await loadData();
  };

  const createBomItem = async (e) => {
    e.preventDefault();
    setError("");
    if (!selectedBomId) {
      setError("Select a BOM first.");
      return;
    }
    const componentId = normText(bomItemForm.component_item_id);
    const comp = items.find((it) => it.id === componentId) || null;
    if (!componentId) return setError("Select a component item.");
    if (comp && !["ingredient", "sub_material"].includes(comp.item_type)) {
      return setError("BOM components must be ingredient or sub_material.");
    }
    const qty = toNumber(bomItemForm.quantity, NaN);
    if (!Number.isFinite(qty) || qty <= 0) return setError("Component quantity must be > 0.");
    const unit = normText(bomItemForm.unit);
    if (!unit) return setError("Component unit is required.");

    const payload = {
      bom_id: selectedBomId,
      component_item_id: componentId,
      quantity: qty,
      unit,
      waste_percent: toNumber(bomItemForm.waste_percent, 0),
      notes: normText(bomItemForm.notes) || null,
      sort_order: 0,
    };
    const { error: e1 } = await supabase.from("bom_items").insert(payload);
    if (e1) {
      setError(getErrorMessage(e1));
      return;
    }
    setBomItemForm({ component_item_id: "", quantity: "", unit: "", waste_percent: "0", notes: "" });
    await loadBomItems(selectedBomId);
  };

  const deleteBomItem = async (bomItemId) => {
    if (!bomItemId) return;
    const ok = window.confirm("Remove this component from the BOM?");
    if (!ok) return;
    setError("");
    const { error: e } = await supabase.from("bom_items").delete().eq("id", bomItemId);
    if (e) {
      setError(getErrorMessage(e));
      return;
    }
    await loadBomItems(selectedBomId);
  };

  const runExplode = async () => {
    setError("");
    setExplodeRows([]);
    const bomId = normText(selectedBomId);
    const bom = boms.find((b) => b.id === bomId) || null;
    if (!bom) {
      setError("Select a BOM to explode.");
      return;
    }
    const bomLines = selectedBomItems ?? [];
    if (bomLines.length === 0) {
      setError("This BOM has no components yet.");
      return;
    }
    const targetQty = toNumber(explodeForm.target_qty, NaN);
    if (!Number.isFinite(targetQty) || targetQty <= 0) {
      setError("Target output qty must be > 0.");
      return;
    }
    const targetUnitRaw = normText(explodeForm.target_unit);
    const targetUnit = targetUnitRaw || normText(bom.output_unit) || "unit";

    setExplodeLoading(true);
    try {
      const bomOutputQty = toNumber(bom.output_quantity, 1);
      const bomOutputUnit = normText(bom.output_unit) || "unit";
      const fgId = bom.finished_good_item_id;

      const targetInBomUnit = await convertItemQuantity({
        itemId: fgId,
        qty: targetQty,
        fromUnit: targetUnit,
        toUnit: bomOutputUnit,
      });

      const multiplier = targetInBomUnit / bomOutputQty;
      const rows = [];

      for (const ln of bomLines) {
        const comp = ln.inventory_items;
        const compItem = Array.isArray(comp) ? comp[0] : comp;
        const baseUom = normText(compItem?.unit_of_measure) || "unit";

        const perBatchQty = toNumber(ln.quantity, 0);
        const wastePct = toNumber(ln.waste_percent, 0);
        const requiredInLineUnit = perBatchQty * multiplier * (1 + wastePct / 100);

        const requiredInBase = await convertItemQuantity({
          itemId: ln.component_item_id,
          qty: requiredInLineUnit,
          fromUnit: normText(ln.unit),
          toUnit: baseUom,
        });

        rows.push({
          id: ln.id,
          component_item_id: ln.component_item_id,
          component_label: itemLabel(compItem),
          item_type: compItem?.item_type || "",
          required_qty: requiredInLineUnit,
          required_unit: normText(ln.unit),
          required_base_qty: requiredInBase,
          base_unit: baseUom,
          waste_percent: wastePct,
        });
      }

      setExplodeRows(rows);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setExplodeLoading(false);
    }
  };

  const finishedGoods = useMemo(
    () => (items ?? []).filter((it) => it.is_active !== false && it.item_type === "finished_good"),
    [items]
  );

  const componentCandidates = useMemo(
    () => (items ?? []).filter((it) => it.is_active !== false && ["ingredient", "sub_material"].includes(it.item_type)),
    [items]
  );

  const selectedBom = boms.find((b) => b.id === selectedBomId) || null;
  const selectedFinishedGood = items.find((it) => it.id === selectedBom?.finished_good_item_id) || null;

  return (
    <div className="bg-surface text-on-surface min-h-dvh pb-10">
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-white/80 shadow-sm shadow-blue-900/5 backdrop-blur-xl">
        <div className="h-16 px-4 max-w-[1440px] mx-auto flex items-center justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white">
              <span className="material-symbols-outlined !text-base">arrow_back</span>
              Dashboard
            </Link>
            <h1 className="text-xl font-extrabold font-headline">Manage BOM</h1>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 pt-[5.2rem] space-y-6 sm:px-6 lg:px-8">
        {error ? <div className="rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm">{error}</div> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("boms")}
            className={activeTab === "boms" ? "px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-bold" : "px-4 py-2 rounded-full bg-surface-container text-on-surface text-sm font-semibold"}
          >
            BOMs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("explode")}
            className={activeTab === "explode" ? "px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-bold" : "px-4 py-2 rounded-full bg-surface-container text-on-surface text-sm font-semibold"}
          >
            Explode BOM
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("conversions")}
            className={activeTab === "conversions" ? "px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-bold" : "px-4 py-2 rounded-full bg-surface-container text-on-surface text-sm font-semibold"}
          >
            Unit conversions
          </button>
        </div>

        {activeTab === "boms" ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <section className="xl:col-span-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
              <h2 className="font-semibold mb-3">Create BOM</h2>
              <form onSubmit={createBom} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={bomForm.name} onChange={(e) => setBomForm((p) => ({ ...p, name: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3" placeholder="BOM name" required />
                <input value={bomForm.code} onChange={(e) => setBomForm((p) => ({ ...p, code: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3" placeholder="Code (optional)" />
                <select value={bomForm.finished_good_item_id} onChange={(e) => setBomForm((p) => ({ ...p, finished_good_item_id: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3 md:col-span-2" required>
                  <option value="">Select finished good item</option>
                  {finishedGoods.map((it) => (
                    <option key={it.id} value={it.id}>{itemLabel(it)}</option>
                  ))}
                </select>
                <input type="number" min="0.000001" step="0.000001" value={bomForm.output_quantity} onChange={(e) => setBomForm((p) => ({ ...p, output_quantity: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3" placeholder="Output qty" required />
                <input value={bomForm.output_unit} onChange={(e) => setBomForm((p) => ({ ...p, output_unit: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3" placeholder="Output unit" required />
                <button type="submit" className="md:col-span-2 bg-primary text-on-primary rounded-xl p-3 font-semibold">Create BOM</button>
              </form>

              <div className="mt-6">
                <h3 className="font-semibold mb-2">Select BOM</h3>
                <select
                  value={selectedBomId}
                  onChange={(e) => {
                    setSelectedBomId(e.target.value);
                    setExplodeRows([]);
                    setExplodeForm((p) => ({ ...p, target_unit: "" }));
                  }}
                  className="w-full bg-surface-container-highest rounded-xl p-3"
                >
                  <option value="">— Select BOM —</option>
                  {boms.map((b) => {
                    const fg = items.find((it) => it.id === b.finished_good_item_id) || null;
                    const sub = fg ? ` (${itemLabel(fg)})` : "";
                    const v = b.version ? ` v${b.version}` : "";
                    return (
                      <option key={b.id} value={b.id}>
                        {b.name}{v}{sub}
                      </option>
                    );
                  })}
                </select>
                {selectedBom ? (
                  <div className="mt-3 rounded-xl bg-surface-container p-3 text-sm">
                    <div className="font-semibold">{selectedBom.name}</div>
                    <div className="text-on-surface-variant">
                      Output: {selectedBom.output_quantity} {selectedBom.output_unit}
                      {selectedFinishedGood ? ` · FG base: ${selectedFinishedGood.unit_of_measure || "unit"}` : ""}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="xl:col-span-7 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="font-semibold">BOM components</h2>
                <span className="text-xs text-on-surface-variant">
                  {selectedBomId ? (bomItemsLoading ? "Loading…" : `${selectedBomItems.length} component(s)`) : "Select a BOM"}
                </span>
              </div>

              <form onSubmit={createBomItem} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={bomItemForm.component_item_id}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const comp = items.find((it) => it.id === nextId) || null;
                    const baseUom = normText(comp?.unit_of_measure) || "";
                    setBomItemForm((p) => ({
                      ...p,
                      component_item_id: nextId,
                      unit: normText(p.unit) ? p.unit : baseUom,
                    }));
                  }}
                  className="bg-surface-container-highest rounded-xl p-3 md:col-span-2"
                  disabled={!selectedBomId}
                  required
                >
                  <option value="">Select component (ingredient / sub-material)</option>
                  {componentCandidates.map((it) => (
                    <option key={it.id} value={it.id}>
                      {itemLabel(it)} · base {it.unit_of_measure || "unit"}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={bomItemForm.quantity}
                  onChange={(e) => setBomItemForm((p) => ({ ...p, quantity: e.target.value }))}
                  className="bg-surface-container-highest rounded-xl p-3"
                  placeholder="Qty per BOM output"
                  disabled={!selectedBomId}
                  required
                />
                <input
                  value={bomItemForm.unit}
                  onChange={(e) => setBomItemForm((p) => ({ ...p, unit: e.target.value }))}
                  className="bg-surface-container-highest rounded-xl p-3"
                  placeholder="Unit (e.g. g, ml, pcs)"
                  disabled={!selectedBomId}
                  required
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={bomItemForm.waste_percent}
                  onChange={(e) => setBomItemForm((p) => ({ ...p, waste_percent: e.target.value }))}
                  className="bg-surface-container-highest rounded-xl p-3"
                  placeholder="Waste %"
                  disabled={!selectedBomId}
                />
                <input
                  value={bomItemForm.notes}
                  onChange={(e) => setBomItemForm((p) => ({ ...p, notes: e.target.value }))}
                  className="bg-surface-container-highest rounded-xl p-3"
                  placeholder="Notes (optional)"
                  disabled={!selectedBomId}
                />
                <button type="submit" className="md:col-span-2 bg-primary text-on-primary rounded-xl p-3 font-semibold disabled:opacity-60" disabled={!selectedBomId}>
                  Add component
                </button>
              </form>

              <div className="mt-5">
                {!selectedBomId ? (
                  <p className="text-sm text-on-surface-variant">Select a BOM to view/edit components.</p>
                ) : bomItemsLoading ? (
                  <p className="text-sm text-on-surface-variant">Loading components…</p>
                ) : selectedBomItems.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">No components yet. Add your first component above.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[760px]">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                          <th className="text-left py-2 pr-3">Component</th>
                          <th className="text-right py-2 pr-3">Qty</th>
                          <th className="text-left py-2 pr-3">Unit</th>
                          <th className="text-right py-2 pr-3">Waste %</th>
                          <th className="text-left py-2 pr-3">Base unit</th>
                          <th className="text-right py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {selectedBomItems.map((ln) => {
                          const inv = ln.inventory_items;
                          const comp = Array.isArray(inv) ? inv[0] : inv;
                          return (
                            <tr key={ln.id}>
                              <td className="py-2 pr-3 font-medium">{itemLabel(comp)}</td>
                              <td className="py-2 pr-3 text-right font-semibold">{ln.quantity}</td>
                              <td className="py-2 pr-3 text-on-surface-variant">{ln.unit}</td>
                              <td className="py-2 pr-3 text-right text-on-surface-variant">{ln.waste_percent ?? 0}</td>
                              <td className="py-2 pr-3 text-on-surface-variant">{comp?.unit_of_measure || "unit"}</td>
                              <td className="py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => void deleteBomItem(ln.id)}
                                  className="px-3 py-1.5 rounded-lg bg-error-container/40 text-on-error-container text-xs font-bold"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "explode" ? (
          <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="font-semibold">Explode BOM</h2>
              <div className="text-xs text-on-surface-variant">
                {selectedBom ? (
                  <>
                    {selectedBom.name} · Output {selectedBom.output_quantity} {selectedBom.output_unit}
                  </>
                ) : (
                  "Select a BOM in the BOMs tab first"
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="number"
                min="0.000001"
                step="0.000001"
                value={explodeForm.target_qty}
                onChange={(e) => setExplodeForm((p) => ({ ...p, target_qty: e.target.value }))}
                className="bg-surface-container-highest rounded-xl p-3"
                placeholder="Target output qty"
                disabled={!selectedBomId}
              />
              <input
                value={explodeForm.target_unit}
                onChange={(e) => setExplodeForm((p) => ({ ...p, target_unit: e.target.value }))}
                className="bg-surface-container-highest rounded-xl p-3"
                placeholder={selectedBom ? `Unit (default: ${selectedBom.output_unit})` : "Unit"}
                disabled={!selectedBomId}
              />
              <button
                type="button"
                onClick={() => void runExplode()}
                className="bg-primary text-on-primary rounded-xl p-3 font-semibold disabled:opacity-60"
                disabled={!selectedBomId || explodeLoading}
              >
                {explodeLoading ? "Exploding…" : "Explode"}
              </button>
            </div>

            <div className="mt-5">
              {explodeRows.length === 0 ? (
                <p className="text-sm text-on-surface-variant">Run explode to compute required components.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[980px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                        <th className="text-left py-2 pr-3">Component</th>
                        <th className="text-right py-2 pr-3">Required</th>
                        <th className="text-left py-2 pr-3">Unit</th>
                        <th className="text-right py-2 pr-3">Required (base)</th>
                        <th className="text-left py-2 pr-3">Base unit</th>
                        <th className="text-right py-2">Waste %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {explodeRows.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2 pr-3 font-medium">{r.component_label}</td>
                          <td className="py-2 pr-3 text-right font-semibold">{r.required_qty.toFixed(6)}</td>
                          <td className="py-2 pr-3 text-on-surface-variant">{r.required_unit}</td>
                          <td className="py-2 pr-3 text-right font-semibold">{r.required_base_qty.toFixed(6)}</td>
                          <td className="py-2 pr-3 text-on-surface-variant">{r.base_unit}</td>
                          <td className="py-2 text-right text-on-surface-variant">{r.waste_percent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "conversions" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
              <h2 className="font-semibold mb-3">Create global conversion</h2>
              <form onSubmit={createGlobalConversion} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={globalConversionForm.from_unit} onChange={(e) => setGlobalConversionForm((p) => ({ ...p, from_unit: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3" placeholder="From unit" required />
                <input value={globalConversionForm.to_unit} onChange={(e) => setGlobalConversionForm((p) => ({ ...p, to_unit: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3" placeholder="To unit" required />
                <input type="number" min="0.000001" step="0.000001" value={globalConversionForm.factor} onChange={(e) => setGlobalConversionForm((p) => ({ ...p, factor: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3 md:col-span-2" placeholder="Factor (qty * factor)" required />
                <input value={globalConversionForm.note} onChange={(e) => setGlobalConversionForm((p) => ({ ...p, note: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3 md:col-span-2" placeholder="Note (optional)" />
                <button type="submit" className="md:col-span-2 bg-primary text-on-primary rounded-xl p-3 font-semibold">Create global conversion</button>
              </form>

              <h3 className="font-semibold mt-6 mb-2">Recent global conversions</h3>
              {loading ? <p className="text-sm text-on-surface-variant">Loading...</p> : (
                <ul className="space-y-2 text-sm">
                  {globalConversions.map((conv) => (
                    <li key={conv.id} className="rounded-xl bg-surface-container p-3">
                      <div className="font-semibold">{conv.from_unit} → {conv.to_unit} (x{conv.factor})</div>
                      {conv.note ? <div className="text-on-surface-variant">{conv.note}</div> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
              <h2 className="font-semibold mb-3">Create item-specific conversion</h2>
              <form onSubmit={createItemConversion} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select value={itemConversionForm.item_id} onChange={(e) => setItemConversionForm((p) => ({ ...p, item_id: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3 md:col-span-2" required>
                  <option value="">Select item</option>
                  {items.filter((it) => it.is_active !== false).map((it) => (
                    <option key={it.id} value={it.id}>{itemLabel(it)} · base {it.unit_of_measure || "unit"}</option>
                  ))}
                </select>
                <input value={itemConversionForm.from_unit} onChange={(e) => setItemConversionForm((p) => ({ ...p, from_unit: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3" placeholder="From unit" required />
                <input value={itemConversionForm.to_unit} onChange={(e) => setItemConversionForm((p) => ({ ...p, to_unit: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3" placeholder="To unit" required />
                <input type="number" min="0.000001" step="0.000001" value={itemConversionForm.factor} onChange={(e) => setItemConversionForm((p) => ({ ...p, factor: e.target.value }))} className="bg-surface-container-highest rounded-xl p-3 md:col-span-2" placeholder="Factor (qty * factor)" required />
                <button type="submit" className="md:col-span-2 bg-primary text-on-primary rounded-xl p-3 font-semibold">Create item conversion</button>
              </form>

              <h3 className="font-semibold mt-6 mb-2">Recent item conversions</h3>
              {loading ? <p className="text-sm text-on-surface-variant">Loading...</p> : (
                <ul className="space-y-2 text-sm">
                  {itemConversions.map((conv) => (
                    <li key={conv.id} className="rounded-xl bg-surface-container p-3">
                      <div className="font-semibold">{conv.inventory_items?.sku || "SKU"} - {conv.inventory_items?.name || "Item"}</div>
                      <div className="text-on-surface-variant">{conv.from_unit} → {conv.to_unit} (x{conv.factor})</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
