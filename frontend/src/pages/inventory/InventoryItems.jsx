import { useState, useEffect, useCallback, Fragment } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { ItemThumbOrIcon } from "../../components/ItemThumbOrIcon";
import { NotificationBell } from "../../components/NotificationBell";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";

const PAGE_SIZE = 6;
const ITEM_TYPE_OPTIONS = [
  { value: "ingredient", label: "Ingredient" },
  { value: "sub_material", label: "Sub-material" },
  { value: "finished_good", label: "Finished good" },
];
const BASE_UNIT_OPTIONS = [
  "piece",
  "pcs",
  "unit",
  "box",
  "pack",
  "set",
  "kg",
  "g",
  "lb",
  "oz",
  "l",
  "ml",
  "m",
  "cm",
];

/** Strip characters that break PostgREST `ilike` patterns */
function sanitizeSearch(raw) {
  return raw.trim().replace(/[%_\\]/g, "");
}

function mapInventoryRow(row) {
  const stock = Number(row.current_stock ?? 0);
  const reorder = row.reorder_level != null ? Number(row.reorder_level) : 20;
  const low = stock <= reorder;
  const cap = row.max_stock != null && row.max_stock > 0 ? Number(row.max_stock) : Math.max(stock, 1) * 2;
  const barPctNum = Math.min(100, Math.round((stock / cap) * 100));
  const cat = row.categories && typeof row.categories === "object" ? row.categories.name : null;
  return {
    id: row.id,
    name: row.name ?? "—",
    subtitle: row.description || row.location || row.sku || "—",
    sku: row.sku ?? "—",
    category: cat ?? "Uncategorized",
    itemType: row.item_type ?? "ingredient",
    qty: Number.isFinite(stock) ? String(stock) : "0",
    qtyTone: low ? "tertiary" : "default",
    barTrack: low ? "bg-tertiary-fixed" : "bg-primary-fixed",
    barFill: low ? "bg-tertiary" : "bg-primary",
    barPct: `${barPctNum}%`,
    reorder: row.reorder_level != null ? String(row.reorder_level) : "—",
    reorderBadge: low ? `Low (≤${reorder})` : null,
    image_url: row.image_url || null,
    baseUnit: row.unit_of_measure || "unit",
    unitCost: Number(row.unit_cost ?? 0),
    isActive: row.is_active !== false,
    location: normalizeLocationValue(row.location),
  };
}

function remapRowQty(row, qtyNum) {
  const stock = Number(qtyNum ?? 0);
  const reorder = row.reorder != null ? Number(row.reorder) : 20;
  const low = stock <= reorder;
  const cap = Math.max(stock, 1) * 2;
  const barPctNum = Math.min(100, Math.round((stock / cap) * 100));
  return {
    ...row,
    qty: Number.isFinite(stock) ? String(stock) : "0",
    qtyTone: low ? "tertiary" : "default",
    barTrack: low ? "bg-tertiary-fixed" : "bg-primary-fixed",
    barFill: low ? "bg-tertiary" : "bg-primary",
    barPct: `${barPctNum}%`,
    reorderBadge: low ? `Low (≤${reorder})` : null,
    baseUnit: row.baseUnit || "unit",
  };
}

function normalizeLocationValue(raw) {
  const trimmed = String(raw || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isMissingInventoryItemLocationsError(err) {
  const msg = String(err?.message || "").toLowerCase();
  const details = String(err?.details || "").toLowerCase();
  const code = String(err?.code || "").toLowerCase();
  return (
    msg.includes("inventory_item_locations") ||
    details.includes("inventory_item_locations") ||
    code === "pgrst205" ||
    msg.includes("schema cache") ||
    msg.includes("does not exist")
  );
}

function profileDisplayName(profile) {
  if (!profile) return "Inventory user";
  const firstName = String(profile.first_name || "").trim();
  const lastName = String(profile.last_name || "").trim();
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
  return profile.email || "Inventory user";
}

function buildLocationBreakdownFromMovements(movements, itemIds) {
  const itemSet = new Set(itemIds);
  const qtyByItemLocation = new Map();
  const locationSet = new Set();

  for (const move of movements ?? []) {
    if (!itemSet.has(move.item_id)) continue;
    const qty = Number(move.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const type = String(move.movement_type || "").toLowerCase();
    const src = normalizeLocationValue(move.from_location);
    const dst = normalizeLocationValue(move.to_location);

    const applyDelta = (itemId, location, delta) => {
      if (!location || !delta) return;
      const key = `${itemId}::${location}`;
      qtyByItemLocation.set(key, (qtyByItemLocation.get(key) ?? 0) + delta);
      locationSet.add(location);
    };

    if (type === "in") {
      applyDelta(move.item_id, dst, qty);
      continue;
    }
    if (type === "out") {
      applyDelta(move.item_id, src, -qty);
      continue;
    }
    if (type === "transfer") {
      applyDelta(move.item_id, src, -qty);
      applyDelta(move.item_id, dst, qty);
    }
  }

  const breakdown = {};
  for (const [key, value] of qtyByItemLocation.entries()) {
    if (value <= 0) continue;
    const [itemId, location] = key.split("::");
    if (!breakdown[itemId]) breakdown[itemId] = [];
    breakdown[itemId].push({ location, qty: value });
  }

  for (const itemId of Object.keys(breakdown)) {
    breakdown[itemId].sort((a, b) => b.qty - a.qty || a.location.localeCompare(b.location));
  }

  return { breakdown, locations: [...locationSet] };
}

function CreateInventoryItemForm({ open, onClose, onCreated, categories, locationOptions, userId, inline = false }) {
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    sku: "",
    name: "",
    item_type: "ingredient",
    unit_of_measure: "unit",
    category_id: "",
    new_category_name: "",
    reorder_level: "0",
    location: "",
  });

  useEffect(() => {
    if (!open) return;
    setFormError("");
    setSubmitting(false);
    setForm({
      sku: "",
      name: "",
      item_type: "ingredient",
      unit_of_measure: "unit",
      category_id: "",
      new_category_name: "",
      reorder_level: "0",
      location: "",
    });
  }, [open]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const fieldClass =
    "h-9 w-full rounded-lg border-none bg-surface-container-highest px-3 text-xs text-on-surface transition-all focus:ring-2 focus:ring-primary/20";

  const handleSubmit = async (e) => {
    e.preventDefault();
    const sku = form.sku.trim();
    const name = form.name.trim();
    if (!sku || !name) {
      setFormError("SKU and Item Name are required.");
      return;
    }

    if (!form.category_id) {
      setFormError("Category is required.");
      return;
    }
    if (form.category_id === "__other__" && !form.new_category_name.trim()) {
      setFormError("Enter a name for the new category.");
      return;
    }
    const normalizedLocation = form.location.trim();
    let categoryId = form.category_id;

    if (form.category_id === "__other__") {
      const categoryName = form.new_category_name.trim();
      const { data: existing, error: existingErr } = await supabase
        .from("categories")
        .select("id,name")
        .eq("name", categoryName)
        .limit(1)
        .maybeSingle();
      if (existingErr) {
        setFormError(getErrorMessage(existingErr));
        return;
      }
      if (existing?.id) {
        categoryId = existing.id;
      } else {
        const { data: createdCategory, error: categoryErr } = await supabase
          .from("categories")
          .insert({
            name: categoryName,
            created_by: userId ?? null,
          })
          .select("id")
          .single();
        if (categoryErr || !createdCategory?.id) {
          setFormError(getErrorMessage(categoryErr || new Error("Failed to create category.")));
          return;
        }
        categoryId = createdCategory.id;
      }
    }

    const row = {
      sku,
      name,
      item_type: form.item_type,
      category_id: categoryId || null,
      unit_of_measure: form.unit_of_measure.trim() || "unit",
      current_stock: 0,
      reorder_level: form.reorder_level === "" ? 0 : Number(form.reorder_level),
      location: normalizedLocation || null,
      is_active: true,
      created_by: userId ?? null,
    };

    setSubmitting(true);
    setFormError("");
    const { error } = await supabase.from("inventory_items").insert(row).select("id").single();
    setSubmitting(false);
    if (error) {
      setFormError(getErrorMessage(error));
      return;
    }
    onCreated?.();
    onClose();
  };

  if (!open) return null;

  return (
    <div className={inline ? "w-full" : "fixed inset-0 z-[90] flex items-center justify-center p-4 bg-on-surface/30 backdrop-blur-sm"}>
      <div
        className={
          inline
            ? "w-full rounded-[1.35rem] border border-slate-200/70 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.06)] overflow-hidden flex flex-col"
            : "bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-outline-variant/20"
        }
      >
        <div className="flex items-center justify-between border-b border-surface-container px-3 py-2.5">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-on-surface font-headline">Create Inventory Item</h2>
            <p className="text-[11px] text-on-surface-variant">Add a new item for stock tracking.</p>
          </div>
          {!inline ? (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors shrink-0"
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2 p-3">
          {formError ? (
            <div className="rounded-xl border border-error/30 bg-error-container/30 px-3 py-2 text-xs text-on-error-container">
              {formError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">SKU *</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setField("sku", e.target.value)}
                className={fieldClass}
                required
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Item Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className={fieldClass}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Item Type *</label>
              <select
                value={form.item_type}
                onChange={(e) => setField("item_type", e.target.value)}
                className={fieldClass}
                required
              >
                {ITEM_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Base Unit *</label>
              <input
                type="text"
                value={form.unit_of_measure}
                onChange={(e) => setField("unit_of_measure", e.target.value)}
                list="create-base-unit-options"
                className={fieldClass}
                placeholder="e.g. piece, kg, ml"
                required
              />
              <datalist id="create-base-unit-options">
                {BASE_UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Category *</label>
              <select
                value={form.category_id}
                onChange={(e) => setField("category_id", e.target.value)}
                className={fieldClass}
                required
              >
                <option value="">Select category...</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__other__">Other (create new)</option>
              </select>
            </div>
            {form.category_id === "__other__" ? (
              <div>
                <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">New Category Name *</label>
                <input
                  type="text"
                  value={form.new_category_name}
                  onChange={(e) => setField("new_category_name", e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Decorative Lighting"
                  required
                />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Reorder Level</label>
              <input type="number" min="0" value={form.reorder_level} onChange={(e) => setField("reorder_level", e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Location</label>
              <select
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
                className={fieldClass}
                required
              >
                <option value="">Select location...</option>
                {(locationOptions ?? []).map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-0.5">
            {inline ? (
              <Link to="/dashboard" className="inline-flex h-9 items-center rounded-lg bg-surface-container px-4 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container-high">
                Cancel
              </Link>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-lg bg-surface-container px-4 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container-high"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-lg bg-gradient-to-r from-primary to-primary-container px-4 text-xs font-semibold text-on-primary shadow-lg shadow-primary/10 transition-all hover:shadow-xl disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Create Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditInventoryItemModal({ open, onClose, onSaved, categories, item }) {
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setForm({
      name: item.name ?? "",
      description: item.description ?? "",
      item_type: item.item_type ?? "ingredient",
      category_id: item.category_id ?? "",
      reorder_level: item.reorder_level ?? 0,
      unit_of_measure: item.unit_of_measure ?? "unit",
      unit_cost: item.unit_cost ?? "",
      selling_price: item.selling_price ?? "",
      location: item.location ?? "",
      is_active: item.is_active !== false,
    });
    setFormError("");
    setSubmitting(false);
  }, [open, item]);

  if (!open || !item || !form) return null;

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!String(form.name || "").trim()) {
      setFormError("Item Name is required.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      item_type: form.item_type,
      category_id: form.category_id || null,
      unit_of_measure: form.unit_of_measure.trim() || "unit",
      reorder_level: form.reorder_level === "" ? 0 : Number(form.reorder_level),
      unit_cost: form.unit_cost === "" ? null : Number(form.unit_cost),
      selling_price: form.selling_price === "" ? null : Number(form.selling_price),
      location: form.location.trim() || null,
      is_active: Boolean(form.is_active),
    };
    setSubmitting(true);
    setFormError("");
    const { error } = await supabase.from("inventory_items").update(payload).eq("id", item.id);
    setSubmitting(false);
    if (error) {
      setFormError(getErrorMessage(error));
      return;
    }
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-on-surface/30 backdrop-blur-sm">
      <div className="bg-surface-container-lowest w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-outline-variant/20">
        <div className="flex items-center justify-between p-6 border-b border-surface-container">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-on-surface font-headline">Edit Item</h2>
            <p className="text-sm text-on-surface-variant">SKU: {item.sku}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors shrink-0" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError ? <div className="rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-on-error-container">{formError}</div> : null}
          <div>
            <label className="block text-xs font-bold uppercase tracking-tighter text-on-surface-variant mb-2">Item Name</label>
            <input value={form.name} onChange={(e) => setField("name", e.target.value)} className="w-full bg-surface-container-highest border-none rounded-xl p-3" placeholder="Item Name" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-tighter text-on-surface-variant mb-2">Description</label>
            <textarea value={form.description} onChange={(e) => setField("description", e.target.value)} className="w-full bg-surface-container-highest border-none rounded-xl p-3 resize-none" rows={2} placeholder="Description" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-tighter text-on-surface-variant mb-2">Item Type</label>
              <select value={form.item_type} onChange={(e) => setField("item_type", e.target.value)} className="w-full bg-surface-container-highest border-none rounded-xl p-3">
                {ITEM_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-tighter text-on-surface-variant mb-2">Base Unit</label>
              <input
                value={form.unit_of_measure}
                onChange={(e) => setField("unit_of_measure", e.target.value)}
                list="edit-base-unit-options"
                className="w-full bg-surface-container-highest border-none rounded-xl p-3"
                placeholder="e.g. piece, g, kg, ml, box"
              />
              <datalist id="edit-base-unit-options">
                {BASE_UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-tighter text-on-surface-variant mb-2">Category</label>
              <select value={form.category_id} onChange={(e) => setField("category_id", e.target.value)} className="w-full bg-surface-container-highest border-none rounded-xl p-3">
                <option value="">Uncategorized</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-tighter text-on-surface-variant mb-2">Reorder Level</label>
              <input type="number" min="0" value={form.reorder_level} onChange={(e) => setField("reorder_level", e.target.value)} className="w-full bg-surface-container-highest border-none rounded-xl p-3" placeholder="Reorder Level" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-tighter text-on-surface-variant mb-2">Location</label>
              <input value={form.location} onChange={(e) => setField("location", e.target.value)} className="w-full bg-surface-container-highest border-none rounded-xl p-3" placeholder="Location" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-tighter text-on-surface-variant mb-2">Unit Cost</label>
              <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setField("unit_cost", e.target.value)} className="w-full bg-surface-container-highest border-none rounded-xl p-3" placeholder="Unit Cost" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-tighter text-on-surface-variant mb-2">Selling Price</label>
              <input type="number" min="0" step="0.01" value={form.selling_price} onChange={(e) => setField("selling_price", e.target.value)} className="w-full bg-surface-container-highest border-none rounded-xl p-3" placeholder="Selling Price" />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setField("is_active", e.target.checked)} className="h-4 w-4 rounded border-outline-variant" />
            Active item
          </label>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-6 py-3 bg-surface-container text-on-surface rounded-xl font-semibold hover:bg-surface-container-high transition-all">Cancel</button>
            <button type="submit" disabled={submitting} className="px-6 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl font-semibold shadow-lg shadow-primary/10 hover:shadow-xl transition-all disabled:opacity-60">
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventoryItems() {
  const { profile, user, role } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locationBreakdownByItem, setLocationBreakdownByItem] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  /** Total rows matching current search (for pagination). */
  const [filteredTotal, setFilteredTotal] = useState(0);
  /** All inventory rows (summary). */
  const [globalTotal, setGlobalTotal] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [hasInventoryItemLocationsTable, setHasInventoryItemLocationsTable] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const term = sanitizeSearch(debouncedSearch);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let listQuery = supabase
      .from("inventory_items")
      .select("id,sku,name,description,item_type,unit_of_measure,current_stock,reorder_level,max_stock,image_url,location,unit_cost,is_active,categories(name)", {
        count: "exact",
      })
      .order("name", { ascending: true })
      .range(from, to);

    if (term.length > 0) {
      const p = `%${term}%`;
      listQuery = listQuery.or(`name.ilike.${p},sku.ilike.${p}`);
    }

    const [listRes, totalRes, lowRes, categoriesRes, locationRes, legacyLocationRes, movementLocationRes] = await Promise.all([
      listQuery,
      supabase.from("inventory_items").select("*", { count: "exact", head: true }),
      supabase.from("inventory_items").select("*", { count: "exact", head: true }).lte("current_stock", 20).neq("is_active", false),
      supabase.from("categories").select("id,name").order("name", { ascending: true }),
      hasInventoryItemLocationsTable
        ? supabase.from("inventory_item_locations").select("location").not("location", "is", null).limit(2500)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("inventory_items").select("location").not("location", "is", null).limit(2500),
      supabase.from("stock_movements").select("from_location,to_location").limit(2500),
    ]);

    if (listRes.error) {
      setLoadError(getErrorMessage(listRes.error));
      setRows([]);
      setFilteredTotal(0);
    } else {
      setFilteredTotal(listRes.count ?? 0);
    }
    if (!totalRes.error) setGlobalTotal(totalRes.count ?? 0);
    if (!lowRes.error) setLowStockCount(lowRes.count ?? 0);
    if (!categoriesRes.error) setCategories(categoriesRes.data ?? []);
    const locationSet = new Set();
    if (locationRes?.error && isMissingInventoryItemLocationsError(locationRes.error)) {
      setHasInventoryItemLocationsTable(false);
    }

    if (!locationRes?.error) {
      for (const row of locationRes.data ?? []) {
        const v = normalizeLocationValue(row.location);
        if (v) locationSet.add(v);
      }
    } else if (!legacyLocationRes?.error) {
      for (const row of legacyLocationRes.data ?? []) {
        const v = normalizeLocationValue(row.location);
        if (v) locationSet.add(v);
      }
    }
    if (!movementLocationRes?.error) {
      for (const row of movementLocationRes.data ?? []) {
        const from = normalizeLocationValue(row.from_location);
        const to = normalizeLocationValue(row.to_location);
        if (from) locationSet.add(from);
        if (to) locationSet.add(to);
      }
    }
    setLocationOptions([...locationSet].sort((a, b) => a.localeCompare(b)));

    const listRows = listRes.error ? [] : listRes.data ?? [];
    const mappedRows = listRows.map(mapInventoryRow);
    const itemIds = listRows.map((r) => r.id);
    const breakdown = {};
    if (itemIds.length > 0) {
      const locBalRes = hasInventoryItemLocationsTable
        ? await supabase
            .from("inventory_item_locations")
            .select("item_id,location,quantity")
            .in("item_id", itemIds)
        : { data: [], error: null };
      if (!locBalRes.error) {
        for (const row of locBalRes.data ?? []) {
          const itemId = row.item_id;
          if (!breakdown[itemId]) breakdown[itemId] = [];
          breakdown[itemId].push({
            location: row.location || "—",
            qty: Number(row.quantity ?? 0),
          });
        }
      } else {
        if (isMissingInventoryItemLocationsError(locBalRes.error)) {
          setHasInventoryItemLocationsTable(false);
        }
        const moveRes = await supabase
          .from("stock_movements")
          .select("item_id,movement_type,quantity,from_location,to_location")
          .in("item_id", itemIds)
          .order("created_at", { ascending: true })
          .limit(10000);
        if (!moveRes.error && (moveRes.data ?? []).length > 0) {
          const fromMovements = buildLocationBreakdownFromMovements(moveRes.data ?? [], itemIds);
          Object.assign(breakdown, fromMovements.breakdown);
        }
        if (Object.keys(breakdown).length === 0) {
          for (const row of listRows) {
            const loc = normalizeLocationValue(row.location);
            if (loc) {
              breakdown[row.id] = [{ location: loc, qty: Number(row.current_stock ?? 0) }];
            }
          }
        }
      }
    }
    setLocationBreakdownByItem(breakdown);
    const finalRows = mappedRows.map((row) => {
      const perLocation = breakdown[row.id] ?? [];
      if (perLocation.length === 0) return row;
      const totalFromBreakdown = perLocation.reduce((sum, loc) => sum + Number(loc.qty ?? 0), 0);
      return remapRowQty(row, totalFromBreakdown);
    });
    setRows(finalRows);

    setLoading(false);
  }, [page, debouncedSearch, hasInventoryItemLocationsTable]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const pageStart = filteredTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, filteredTotal);

  const handleEditItem = async (itemId) => {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("id,sku,name,description,item_type,category_id,unit_of_measure,reorder_level,min_stock,max_stock,unit_cost,selling_price,location,barcode,image_url,is_active")
      .eq("id", itemId)
      .maybeSingle();
    if (error || !data) {
      setLoadError(getErrorMessage(error || new Error("Item not found.")));
      return;
    }
    setEditingItem(data);
    setShowEditItemModal(true);
  };

  const handleDeleteItem = async (itemId) => {
    const ok = window.confirm("Delete this item? This cannot be undone.");
    if (!ok) return;
    setLoadError("");
    const { error } = await supabase.from("inventory_items").delete().eq("id", itemId);
    if (error) {
      const deleteMsg = getErrorMessage(error);
      const looksReferenced =
        deleteMsg.toLowerCase().includes("foreign key") ||
        deleteMsg.toLowerCase().includes("violates") ||
        deleteMsg.toLowerCase().includes("constraint");
      if (!looksReferenced) {
        setLoadError(deleteMsg);
        return;
      }

      // Fallback: if hard delete is blocked by references, hide it from active inventory.
      const { error: softErr } = await supabase.from("inventory_items").update({ is_active: false }).eq("id", itemId);
      if (softErr) {
        setLoadError(getErrorMessage(softErr));
        return;
      }
    }
    await loadInventory();
  };

  const toggleRowExpanded = (itemId) => {
    setExpandedRows((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const tableRows = rows.map((row) => {
    const qtyNum = Number(row.qty ?? 0);
    const primaryLocation = (locationBreakdownByItem[row.id] ?? [])[0]?.location || row.location || "—";
    const status = !row.isActive ? "Locked" : qtyNum <= 0 ? "Out of Stock" : "Available";
    const stockValue = qtyNum * Number(row.unitCost ?? 0);
    return { ...row, qtyNum, primaryLocation, status, stockValue };
  });

  const statusClasses = (status) => {
    if (status === "Available") return "bg-green-100 text-green-700";
    if (status === "Out of Stock") return "bg-rose-100 text-rose-700";
    return "bg-amber-100 text-amber-700";
  };

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

      <main className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col px-2 pb-4 pt-20 sm:px-3 lg:px-4 md:pb-2">
        <section className="px-1 py-2 sm:px-2">
          <div className="relative mx-auto h-[calc(100dvh-6.6rem)] w-full max-w-[1560px] overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest to-surface shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            <section className="relative h-full overflow-hidden bg-transparent p-3 sm:p-4 lg:p-5">
              <div className="mx-auto flex h-full w-full max-w-none flex-col p-0.5">
                <div className="mb-1.5 flex items-center justify-between rounded-xl bg-primary px-3 py-2 text-white">
                  <h2 className="font-headline text-xs font-extrabold uppercase tracking-[0.11em]">View Storage</h2>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">{filteredTotal} items</span>
                    <Link
                      to="/dashboard"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-all hover:bg-white/20"
                      aria-label="Close"
                      title="Close"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </Link>
                  </div>
                </div>
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="relative w-full sm:max-w-[300px]">
                    <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                      search
                    </span>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search item name or SKU"
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full table-fixed text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-100">
                        <tr>
                          <th className="w-[28%] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Item Name</th>
                          <th className="w-[14%] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Stock Level</th>
                          <th className="w-[22%] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Location</th>
                          <th className="w-[16%] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Status</th>
                          <th className="w-[20%] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Stock Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 bg-white">
                        {loading ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-sm text-on-surface-variant">
                              Loading inventory status...
                            </td>
                          </tr>
                        ) : loadError ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-sm text-error">
                              {loadError}
                            </td>
                          </tr>
                        ) : tableRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-sm text-on-surface-variant">
                              No items found.
                            </td>
                          </tr>
                        ) : (
                          tableRows.map((row) => (
                            <tr key={row.id}>
                              <td className="px-2.5 py-2">
                                <div className="flex items-center gap-2">
                                  <ItemThumbOrIcon src={row.image_url} alt={row.name} size="sm" />
                                  <div className="min-w-0">
                                    <p className="truncate text-[13px] font-semibold text-on-surface">{row.name}</p>
                                    <p className="truncate text-[10px] text-on-surface-variant">{row.sku}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-2.5 py-2 text-[13px] font-semibold text-on-surface">
                                {row.qtyNum} {row.baseUnit}
                              </td>
                              <td className="truncate px-2.5 py-2 text-[13px] text-on-surface">{row.primaryLocation}</td>
                              <td className="px-2.5 py-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClasses(row.status)}`}>{row.status}</span>
                              </td>
                              <td className="px-2.5 py-2 text-[13px] font-semibold text-on-surface">
                                {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(row.stockValue)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-on-surface-variant">
                    Showing {pageStart}-{pageEnd} of {filteredTotal}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page <= 1}
                      className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-on-surface disabled:opacity-45"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-semibold text-on-surface-variant">
                      Page {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page >= totalPages}
                      className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-on-surface disabled:opacity-45"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>

      <nav className="fixed bottom-0 w-full z-50 md:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] h-16 flex justify-around items-center px-4 pb-safe font-['Inter'] text-[10px] font-medium">
        <Link to="/" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-1">
          <span className="material-symbols-outlined">dashboard</span>
          <span>Dashboard</span>
        </Link>
        <span className="flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-xl px-3 py-1">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            inventory_2
          </span>
          <span>Inventory</span>
        </span>
        <a className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-1" href="#">
          <span className="material-symbols-outlined">receipt_long</span>
          <span>Orders</span>
        </a>
        <a className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-1" href="#">
          <span className="material-symbols-outlined">analytics</span>
          <span>Reports</span>
        </a>
      </nav>

      <EditInventoryItemModal
        open={showEditItemModal}
        onClose={() => {
          setShowEditItemModal(false);
          setEditingItem(null);
        }}
        onSaved={() => void loadInventory()}
        categories={categories}
        item={editingItem}
      />
    </div>
  );
}
