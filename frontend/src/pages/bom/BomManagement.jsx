import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";

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

const BOM_TABLE_ROWS = 18;
const STATUS_OPTIONS = ["draft", "active", "inactive", "obsolete"];
const ITEM_TYPE_OPTIONS = ["ingredient", "sub_material", "finished_good"];

function mapUiStatusToDb(status) {
  if (status === "active") return "active";
  if (status === "inactive" || status === "obsolete") return "archived";
  return "draft";
}

function mapDbStatusToUi(status) {
  if (status === "active") return "active";
  if (status === "archived") return "inactive";
  return "draft";
}

export default function BomManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [items, setItems] = useState([]);
  const [boms, setBoms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [selectedBomId, setSelectedBomId] = useState("");
  const [bomItemsLoading, setBomItemsLoading] = useState(false);
  const [selectedBomItems, setSelectedBomItems] = useState([]);
  const [attachmentName, setAttachmentName] = useState("");

  const [bomForm, setBomForm] = useState({
    sku: "",
    name: "",
    code: "",
    finished_good_item_id: "",
    output_quantity: "1",
    output_unit: "unit",
    item_type: "finished_good",
    status: "draft",
    category_id: "",
    location: "",
    description: "",
    attachment_path: "",
  });

  const [bomItemForm, setBomItemForm] = useState({
    component_item_id: "",
    quantity: "",
    unit: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [itemRes, bomRes, categoryRes, locationsRes] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id,name,sku,item_type,unit_of_measure,is_active,category_id,location,description")
        .order("name"),
      supabase
        .from("boms")
        .select("id,name,code,finished_good_item_id,output_quantity,output_unit,status,notes,updated_at,created_at")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase.from("categories").select("id,name").order("name", { ascending: true }),
      supabase.from("inventory_items").select("location").not("location", "is", null).limit(2000),
    ]);

    if (itemRes.error || bomRes.error || categoryRes.error || locationsRes.error) {
      setError(getErrorMessage(itemRes.error || bomRes.error || categoryRes.error || locationsRes.error));
      setLoading(false);
      return;
    }

    setItems(itemRes.data ?? []);
    setBoms(bomRes.data ?? []);
    setCategories(categoryRes.data ?? []);
    const uniqueLocations = [...new Set((locationsRes.data ?? []).map((row) => normText(row.location)).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    setLocationOptions(uniqueLocations);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
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
      .limit(2000);
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

  const finishedGoods = useMemo(
    () => (items ?? []).filter((it) => it.is_active !== false && it.item_type === "finished_good"),
    [items]
  );
  const componentCandidates = useMemo(
    () => (items ?? []).filter((it) => it.is_active !== false && ["ingredient", "sub_material"].includes(it.item_type)),
    [items]
  );

  const selectedBom = useMemo(() => boms.find((b) => b.id === selectedBomId) || null, [boms, selectedBomId]);
  const selectedFinishedGood = useMemo(
    () => items.find((it) => it.id === selectedBom?.finished_good_item_id) || null,
    [items, selectedBom?.finished_good_item_id]
  );
  const findExistingBomForFinishedGood = useCallback(
    (finishedGoodId) =>
      (boms ?? [])
        .filter((b) => b.finished_good_item_id === finishedGoodId)
        .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))[0] || null,
    [boms]
  );

  const onFinishedGoodChange = useCallback(
    async (finishedGoodId) => {
      const fgId = normText(finishedGoodId);
      const fg = items.find((it) => it.id === fgId) || null;
      const existing = fgId ? findExistingBomForFinishedGood(fgId) : null;
      const suggestedName = fg ? `${normText(fg.name) || "Unnamed"} BOM` : "";
      const suggestedCode = fg?.sku ? `BOM-${normText(fg.sku)}` : "";
      const suggestedUnit = normText(fg?.unit_of_measure) || "unit";

      setBomForm((prev) => ({
        ...prev,
        sku: fg?.sku || prev.sku,
        finished_good_item_id: fgId,
        name: existing?.name ?? suggestedName,
        code: existing?.code ?? suggestedCode,
        output_quantity: existing ? String(existing.output_quantity ?? 1) : "1",
        output_unit: existing?.output_unit ?? suggestedUnit,
        item_type: fg?.item_type || prev.item_type,
        status: mapDbStatusToUi(existing?.status),
        category_id: fg?.category_id || prev.category_id,
        location: fg?.location || prev.location,
        description: fg?.description || prev.description,
      }));

      setBomItemForm({ component_item_id: "", quantity: "", unit: "" });
      setError("");
      if (!fgId) {
        setSelectedBomId("");
        setSelectedBomItems([]);
        return;
      }
      if (existing?.id) {
        setSelectedBomId(existing.id);
        await loadBomItems(existing.id);
      } else {
        setSelectedBomId("");
        setSelectedBomItems([]);
      }
    },
    [findExistingBomForFinishedGood, items, loadBomItems]
  );

  const saveBomEssentials = async (e) => {
    e.preventDefault();
    await persistBomEssentials();
  };

  const persistBomEssentials = async (finishedGoodIdOverride = "") => {
    setError("");
    setNotice("");
    const fgId = normText(finishedGoodIdOverride || bomForm.finished_good_item_id);
    const fg = items.find((it) => it.id === fgId) || null;
    if (!fgId) {
      setError("Select a finished good item.");
      return false;
    }
    if (fg && fg.item_type !== "finished_good") {
      setError("BOM output item must be a finished_good.");
      return false;
    }

    const payload = {
      name: normText(bomForm.name),
      code: normText(bomForm.code) || null,
      finished_good_item_id: fgId,
      output_quantity: toNumber(bomForm.output_quantity, 1),
      output_unit: normText(bomForm.output_unit) || "unit",
      status: mapUiStatusToDb(normText(bomForm.status).toLowerCase()),
      notes: [
        normText(bomForm.description) ? `Description: ${normText(bomForm.description)}` : "",
        normText(bomForm.location) ? `Default Location: ${normText(bomForm.location)}` : "",
        normText(bomForm.attachment_path) ? `Attachment: ${normText(bomForm.attachment_path)}` : "",
      ]
        .filter(Boolean)
        .join(" • ") || null,
    };

    const existing = findExistingBomForFinishedGood(fgId);
    if (existing?.id) {
      const { error: updateErr } = await supabase.from("boms").update(payload).eq("id", existing.id);
      if (updateErr) {
        setError(getErrorMessage(updateErr));
        return false;
      }
      await loadData();
      setSelectedBomId(existing.id);
      await loadBomItems(existing.id);
      return true;
    }

    const { data: createdBom, error: createErr } = await supabase.from("boms").insert(payload).select("id").single();
    if (createErr) {
      setError(getErrorMessage(createErr));
      return false;
    }

    await loadData();
    setBomItemForm({ component_item_id: "", quantity: "", unit: "" });
    if (createdBom?.id) {
      setSelectedBomId(createdBom.id);
      await loadBomItems(createdBom.id);
    }
    return true;
  };

  const resolveOrCreateFinishedGood = async () => {
    const sku = normText(bomForm.sku).toUpperCase();
    const name = normText(bomForm.name);
    const categoryId = normText(bomForm.category_id);
    const unit = normText(bomForm.output_unit);
    const location = normText(bomForm.location);

    if (!sku) {
      setError("SKU is required.");
      return null;
    }
    if (!name) {
      setError("Item Name is required.");
      return null;
    }
    if (!categoryId) {
      setError("Category is required.");
      return null;
    }
    if (!unit) {
      setError("UoM is required.");
      return null;
    }
    if (!location) {
      setError("Default Location is required.");
      return null;
    }

    const existingItem =
      items.find((it) => normText(it.sku).toLowerCase() === sku.toLowerCase()) || null;

    if (existingItem?.id) {
      const { error: updateItemErr } = await supabase
        .from("inventory_items")
        .update({
          sku,
          name,
          item_type: normText(bomForm.item_type) || "ingredient",
          category_id: categoryId,
          unit_of_measure: unit,
          location,
          description: normText(bomForm.description) || null,
        })
        .eq("id", existingItem.id);
      if (updateItemErr) {
        setError(getErrorMessage(updateItemErr));
        return null;
      }
      return existingItem.id;
    }

    const { data: createdItem, error: createItemErr } = await supabase
      .from("inventory_items")
      .insert({
        sku,
        name,
        item_type: normText(bomForm.item_type) || "ingredient",
        category_id: categoryId,
        unit_of_measure: unit,
        location,
        description: normText(bomForm.description) || null,
        current_stock: 0,
        reorder_level: 0,
        is_active: true,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (createItemErr || !createdItem?.id) {
      setError(getErrorMessage(createItemErr || new Error("Failed to create inventory item.")));
      return null;
    }
    return createdItem.id;
  };

  const saveSelectedItemDetails = async () => {
    const fgId = normText(bomForm.finished_good_item_id);
    if (!fgId) {
      setError("Select SKU / finished good item first.");
      return false;
    }
    const payload = {
      name: normText(bomForm.name) || null,
      item_type: "finished_good",
      category_id: normText(bomForm.category_id) || null,
      unit_of_measure: normText(bomForm.output_unit) || "unit",
      location: normText(bomForm.location) || null,
      description: normText(bomForm.description) || null,
    };
    const { error: itemErr } = await supabase.from("inventory_items").update(payload).eq("id", fgId);
    if (itemErr) {
      setError(getErrorMessage(itemErr));
      return false;
    }
    return true;
  };

  const updateBomStatus = async (status) => {
    if (!selectedBomId) return;
    setError("");
    const { error: statusErr } = await supabase.from("boms").update({ status: mapUiStatusToDb(status) }).eq("id", selectedBomId);
    if (statusErr) {
      setError(getErrorMessage(statusErr));
      return;
    }
    setBomForm((prev) => ({ ...prev, status }));
    await loadData();
  };

  const createBomItem = async () => {
    setError("");
    if (!selectedBomId) return setError("Save BOM essentials first.");
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
      waste_percent: 0,
      notes: null,
      sort_order: 0,
    };
    const { error: e1 } = await supabase.from("bom_items").insert(payload);
    if (e1) {
      setError(getErrorMessage(e1));
      return;
    }
    setBomItemForm({ component_item_id: "", quantity: "", unit: "" });
    await loadBomItems(selectedBomId);
  };

  const deleteBomItem = async (bomItemId) => {
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

  const handleBomItemKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void createBomItem();
  };

  const handleSelectFinishedGood = async (itemId) => {
    await onFinishedGoodChange(itemId);
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    setBomForm((prev) => ({
      ...prev,
      sku: normText(item.sku),
      name: normText(item.name) || prev.name,
      output_unit: normText(item.unit_of_measure) || prev.output_unit,
      category_id: item.category_id || prev.category_id,
      location: item.location || prev.location,
      description: item.description || prev.description,
    }));
  };

  return (
    <div className="bg-surface text-on-surface min-h-dvh">
      <header className="fixed top-0 left-0 w-full z-50 bg-white/70 backdrop-blur-xl dark:bg-slate-900/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
        <div className="flex justify-between items-center px-4 sm:px-6 lg:px-8 h-14 sm:h-16 w-full max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-white shrink-0"
            >
              <span className="material-symbols-outlined !text-base">arrow_back</span>
              Dashboard
            </Link>
            <div className="text-sm sm:text-lg font-extrabold tracking-tighter text-blue-700 dark:text-blue-300 truncate">
              The Fluid Curator
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-2 pb-4 pt-[4.2rem] sm:px-3 lg:px-4">
        <section className="py-1">
          <div className="relative mx-auto w-full overflow-hidden rounded-[1.4rem] border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest to-surface shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            <section className="relative h-[calc(100dvh-6.3rem)] min-h-0 overflow-hidden bg-transparent p-1 sm:p-1.5 lg:p-2">
              <div className="mx-auto h-full w-full max-w-none space-y-1 flex flex-col">
                <div className="mb-1 rounded-md bg-primary px-3 py-1.5 text-white flex items-center justify-between">
                  <h1 className="text-[13px] font-bold tracking-tight">Create Inventory Item</h1>
                  <Link
                    to="/dashboard"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-all hover:bg-white/20"
                    aria-label="Close"
                    title="Close"
                  >
                    <span className="material-symbols-outlined text-[12px]">close</span>
                  </Link>
                </div>

        {error ? <div className="rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-xs">{error}</div> : null}
        {!error && notice ? <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary">{notice}</div> : null}

        <div className="grid grid-cols-1 gap-1.5 flex-1 min-h-0">
          <section className="bg-surface-container-lowest p-1 rounded-xl flex flex-col border border-outline-variant/10 h-full min-h-0">
            <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.05)] flex-1 min-h-0 flex flex-col">
              <div className="mb-1 flex items-center justify-end">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{selectedBomItems.length} items</span>
              </div>

              <div className="mb-1 grid grid-cols-1 gap-1 md:grid-cols-4">
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                  <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">SKU</label>
                  <input
                    value={bomForm.sku}
                    onChange={(e) => {
                      const nextSku = e.target.value;
                      setBomForm((p) => ({ ...p, sku: nextSku }));
                      const matched = items.find(
                        (it) => normText(it.sku).toLowerCase() === normText(nextSku).toLowerCase()
                      );
                      if (matched?.id) void handleSelectFinishedGood(matched.id);
                    }}
                    className="h-8 w-full rounded-md border-none bg-white px-2 text-xs leading-5 text-slate-900"
                    placeholder="Type new or existing SKU"
                  />
                </div>
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                  <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Item Name</label>
                  <input value={bomForm.name} onChange={(e) => setBomForm((p) => ({ ...p, name: e.target.value }))} className="h-8 w-full rounded-md border-none bg-white px-2 text-xs leading-5 text-slate-900" placeholder="Item name" />
                </div>
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                  <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Category</label>
                  <select value={bomForm.category_id} onChange={(e) => setBomForm((p) => ({ ...p, category_id: e.target.value }))} className="h-8 w-full rounded-md border-none bg-white px-2 text-xs leading-5 text-slate-900">
                    <option value="">Select category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                  <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">UoM</label>
                  <input value={bomForm.output_unit} onChange={(e) => setBomForm((p) => ({ ...p, output_unit: e.target.value }))} className="h-8 w-full rounded-md border-none bg-white px-2 text-xs leading-5 text-slate-900" placeholder="pcs, kg, l..." />
                </div>
              </div>
              <div className="mb-1 grid grid-cols-1 gap-1 md:grid-cols-4">
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                  <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Item Type</label>
                  <select
                    value={bomForm.item_type}
                    onChange={(e) => setBomForm((p) => ({ ...p, item_type: e.target.value }))}
                    className="h-8 w-full appearance-none rounded-md border-none bg-white px-2 text-xs leading-5 text-slate-900"
                  >
                    {ITEM_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                  <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Default Location</label>
                  <select value={bomForm.location} onChange={(e) => setBomForm((p) => ({ ...p, location: e.target.value }))} className="h-8 w-full appearance-none rounded-md border-none bg-white px-2 text-xs leading-5 text-slate-900">
                    <option value="">Select location...</option>
                    {locationOptions.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                  <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Status</label>
                  <select value={bomForm.status} onChange={(e) => setBomForm((p) => ({ ...p, status: e.target.value }))} className="h-8 w-full appearance-none rounded-md border-none bg-white px-2 text-xs leading-5 text-slate-900 capitalize">
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                  <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Attachment</label>
                  <input
                    type="file"
                    className="h-8 w-full rounded-md border-none bg-white px-2 text-[11px] text-slate-900"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      const fileName = normText(file?.name);
                      setAttachmentName(fileName);
                      setBomForm((p) => ({ ...p, attachment_path: fileName }));
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <div className="mb-1 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Description (Optional)</label>
                <input value={bomForm.description} onChange={(e) => setBomForm((p) => ({ ...p, description: e.target.value }))} className="mt-0.5 h-8 w-full rounded-md border-none bg-white px-2 text-xs leading-5 text-slate-900" placeholder="Notes / description..." />
              </div>

              <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-slate-200">
                <div className="h-full min-h-[420px] overflow-x-auto overflow-y-auto pt-1 pb-8">
                  <table className="w-full min-w-[760px] md:min-w-[980px] table-fixed text-left text-[10px]">
                    <thead className="sticky top-0 z-10 bg-slate-100">
                      <tr>
                        <th className="w-[16%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Parent SKU</th>
                        <th className="w-[16%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Component SKU</th>
                        <th className="w-[24%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Component Name</th>
                        <th className="w-[10%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Quantity</th>
                        <th className="w-[10%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">UOM</th>
                        <th className="w-[10%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Level</th>
                        <th className="w-[14%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 bg-white [&>tr>td]:align-middle">
                      {!selectedBomId && selectedBomItems.length === 0 ? (
                        <tr>
                          <td className="px-2 py-1.5 text-[10px] text-slate-400" colSpan={7}>
                            &nbsp;
                          </td>
                        </tr>
                      ) : null}
                      {selectedBomItems.slice(0, BOM_TABLE_ROWS).map((ln) => {
                        const inv = ln.inventory_items;
                        const comp = Array.isArray(inv) ? inv[0] : inv;
                        return (
                          <tr key={ln.id}>
                            <td className="truncate px-2 py-1 font-medium">{selectedFinishedGood?.sku || "—"}</td>
                            <td className="truncate px-2 py-1">{normText(comp?.sku) || "—"}</td>
                            <td className="truncate px-2 py-1">{normText(comp?.name) || "—"}</td>
                            <td className="px-2 py-1 text-center font-semibold">{ln.quantity}</td>
                            <td className="px-2 py-1">{ln.unit}</td>
                            <td className="px-2 py-1 text-center font-semibold">1</td>
                            <td className="px-2 py-1 text-center">
                              <button type="button" onClick={() => void deleteBomItem(ln.id)} className="rounded-full p-0.5 hover:bg-slate-100" aria-label="Remove component">
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      <tr className="bg-slate-50/70 [&>td]:align-middle">
                        <td className="px-1.5 py-2 text-[10px] text-slate-600">{selectedFinishedGood?.sku || "—"}</td>
                        <td className="px-1.5 py-2">
                          <select
                            value={bomItemForm.component_item_id}
                            onChange={(e) => {
                              const nextId = e.target.value;
                              const comp = items.find((it) => it.id === nextId) || null;
                              const baseUom = normText(comp?.unit_of_measure) || "";
                              setBomItemForm((p) => ({ ...p, component_item_id: nextId, unit: normText(p.unit) ? p.unit : baseUom }));
                            }}
                            onKeyDown={handleBomItemKeyDown}
                            className={`h-9 w-full appearance-none rounded-md border px-2 text-[10px] ${
                              selectedBomId
                                ? "border-slate-200 bg-white text-slate-900"
                                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                            }`}
                            disabled={!selectedBomId}
                          >
                            <option value="">{selectedBomId ? "Select SKU..." : "Save BOM first..."}</option>
                            {componentCandidates.map((it) => (
                              <option key={it.id} value={it.id}>
                                {normText(it.sku) || "No SKU"}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1.5 py-2">
                          <input
                            value={normText(componentCandidates.find((it) => it.id === bomItemForm.component_item_id)?.name)}
                            readOnly
                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[10px]"
                          />
                        </td>
                        <td className="px-1.5 py-2">
                          <input value={bomItemForm.quantity} onChange={(e) => setBomItemForm((p) => ({ ...p, quantity: e.target.value }))} onKeyDown={handleBomItemKeyDown} type="number" min="0.000001" step="0.000001" className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-center text-[10px]" disabled={!selectedBomId} />
                        </td>
                        <td className="px-1.5 py-2">
                          <input value={bomItemForm.unit} onChange={(e) => setBomItemForm((p) => ({ ...p, unit: e.target.value }))} onKeyDown={handleBomItemKeyDown} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[10px]" disabled={!selectedBomId} />
                        </td>
                        <td className="px-1.5 py-2 text-center text-[9px] font-semibold text-primary/80">Auto</td>
                        <td className="px-1.5 py-2 text-center text-[9px] font-semibold text-primary/80">Enter</td>
                      </tr>

                      {Array.from({ length: Math.max(0, BOM_TABLE_ROWS - selectedBomItems.length - 1) }).map((_, idx) => (
                        <tr key={`bom-empty-row-${idx}`} className="bg-white">
                          <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-on-surface-variant">
                  Total Components: <span className="font-semibold text-on-surface">{selectedBomItems.length}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => void createBomItem()} disabled={!selectedBomId} className="h-6 rounded-full bg-slate-100 px-2.5 text-[9px] font-bold text-slate-700 disabled:opacity-40">
                    Add Component
                  </button>
                  <button type="button" disabled title="Multi-level and circular prevention need parent-child schema update." className="h-6 rounded-full bg-slate-100 px-2.5 text-[9px] font-bold text-slate-500 cursor-not-allowed">
                    Add Sub Component
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setError("");
                        setNotice("");
                        const resolvedItemId = await resolveOrCreateFinishedGood();
                        if (!resolvedItemId) return;
                        setBomForm((prev) => ({ ...prev, finished_good_item_id: resolvedItemId }));
                        if (normText(bomForm.item_type) === "finished_good") {
                          const bomSaved = await persistBomEssentials(resolvedItemId);
                          if (!bomSaved) return;
                          setNotice("Item and BOM saved. You can now add BOM lines.");
                        } else {
                          setSelectedBomId("");
                          setSelectedBomItems([]);
                          setNotice("Item saved to Inventory. Set Item Type to finished_good if you want BOM lines.");
                        }
                        await loadData();
                      } catch (e) {
                        setError(getErrorMessage(e));
                      }
                    }}
                    className="h-6 rounded-full bg-primary px-2.5 text-[9px] font-bold text-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setError("");
                        setNotice("");
                        const resolvedItemId = await resolveOrCreateFinishedGood();
                        if (!resolvedItemId) return;
                        setBomForm((prev) => ({ ...prev, finished_good_item_id: resolvedItemId }));
                        if (normText(bomForm.item_type) === "finished_good") {
                          const bomSaved = await persistBomEssentials(resolvedItemId);
                          if (!bomSaved) return;
                          setNotice("Item and BOM updated.");
                        } else {
                          setNotice("Item updated in Inventory. Set Item Type to finished_good if you want BOM lines.");
                        }
                        await loadData();
                      } catch (e) {
                        setError(getErrorMessage(e));
                      }
                    }}
                    className="h-6 rounded-full bg-primary/80 px-2.5 text-[9px] font-bold text-white"
                  >
                    Update
                  </button>
                  <button type="button" onClick={() => void updateBomStatus("inactive")} disabled={!selectedBomId} className="h-6 rounded-full bg-slate-700 px-2.5 text-[9px] font-bold text-white disabled:opacity-40">
                    Deactivate
                  </button>
                </div>
              </div>
              {attachmentName ? <p className="mt-1 text-[10px] text-on-surface-variant">Attachment selected: {attachmentName}</p> : null}
            </div>
          </section>
        </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

