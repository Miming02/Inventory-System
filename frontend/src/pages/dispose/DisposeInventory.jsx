import { Link } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { useDistinctLocations } from "../../lib/useDistinctLocations";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";
import { convertItemQuantity } from "../../lib/unitConversion";
import { NotificationBell } from "../../components/NotificationBell";

const filterOptions = ["All", "Draft", "Pending", "Disposed", "Cancelled"];
const adjustmentTypeOptions = [
  { value: "damage", label: "Damage" },
  { value: "expired", label: "Expired" },
  { value: "loss", label: "Loss" },
  { value: "correction", label: "Correction" },
  { value: "write_off", label: "Write Off" },
];

function formatAdjustmentType(t) {
  const s = (t || "").replace(/_/g, " ");
  return s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : "—";
}

function profileFromEmbed(p) {
  if (!p) return null;
  return Array.isArray(p) ? p[0] ?? null : p;
}

function profileLabel(p) {
  const row = profileFromEmbed(p);
  if (!row) return "—";
  const fn = (row.first_name || "").trim();
  const ln = (row.last_name || "").trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
  return row.email || "Team member";
}

function profileRoleLabel(p) {
  const row = profileFromEmbed(p);
  if (!row) return "Team member";
  const explicit = String(row.role_name || "").trim();
  if (explicit) return explicit;
  const rel = row.roles;
  if (Array.isArray(rel) && rel[0]?.name) return rel[0].name;
  if (!Array.isArray(rel) && rel?.name) return rel.name;
  return "Team member";
}

function profileAvatar(p) {
  const row = profileFromEmbed(p);
  return row?.avatar_url || null;
}

function rowStatus(row) {
  const raw = String(row.status || "").toLowerCase();
  if (raw === "draft" || raw === "approved" || raw === "rejected" || raw === "pending") return raw;
  if (row.approved_by) return "approved";
  return "pending";
}

function StatusBadge({ status }) {
  if (status === "draft") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        Draft
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-fixed-variant text-xs font-bold">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        Pending
      </div>
    );
  }
  if (status === "approved") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
        <span className="material-symbols-outlined text-[14px]">check_circle</span>
        Disposed
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
      <span className="material-symbols-outlined text-[14px]">cancel</span>
      Cancelled
    </div>
  );
}

function UserMetaCell({ profileEmbed, emptyLabel = "TBD" }) {
  const row = profileFromEmbed(profileEmbed);
  if (!row) {
    return <span className="text-xs text-on-surface-variant italic">{emptyLabel}</span>;
  }
  const name = profileLabel(row);
  const roleLabel = profileRoleLabel(row);
  return (
    <div className="flex items-center gap-2">
      <UserAvatarOrIcon src={profileAvatar(row)} alt={name} size="sm" />
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-semibold text-on-surface">{roleLabel}</span>
        <span className="text-[11px] text-on-surface-variant">{name}</span>
      </div>
    </div>
  );
}

function normalizeLocationValue(raw) {
  const trimmed = String(raw || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function locationMatchesSelection(selectedLocation, candidateLocation) {
  const selected = normalizeLocationValue(selectedLocation);
  const candidate = normalizeLocationValue(candidateLocation);
  if (!selected || !candidate) return false;
  const s = selected.toLowerCase();
  const c = candidate.toLowerCase();
  return c === s || c.startsWith(`${s} -`) || c.startsWith(`${s} —`);
}

function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMoney(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function uploadDisposalAttachments({ files, profileId }) {
  const uploadedPaths = [];
  if (!Array.isArray(files) || files.length === 0) return uploadedPaths;

  for (const file of files) {
    const safeName = String(file.name || "attachment")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 120);
    const path = `disposals/${profileId || "anonymous"}/${Date.now()}-${Math.floor(Math.random() * 10000)}-${safeName}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    if (error) throw error;
    uploadedPaths.push(path);
  }
  return uploadedPaths;
}

async function resolveCostBasis(itemId, baseUnitCost) {
  const direct = Number(baseUnitCost ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;

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

function CreateDisposalRequestModal({ open, onClose, profile, user, role, locations, onCreated, inline = false }) {
  const DISPOSAL_PAGE_SIZE = 14;
  const LOCATION_ITEM_DELIMITER = "||";
  const [itemOptions, setItemOptions] = useState([]);
  const [locationTotals, setLocationTotals] = useState(new Map());
  const [itemLocationTotals, setItemLocationTotals] = useState(new Map());
  const [stockByItemLocation, setStockByItemLocation] = useState(new Map());
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState("");
  const [formError, setFormError] = useState("");
  const [availableQty, setAvailableQty] = useState(null);
  const [selectedLocationItemValue, setSelectedLocationItemValue] = useState("");
  const [lineItems, setLineItems] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [form, setForm] = useState({
    disposedBy: "",
    location: "",
    date: "",
    adjustmentType: "",
    reasonDetail: "",
  });
  const [lineDraft, setLineDraft] = useState({
    itemId: "",
    quantity: "",
    unit: "",
  });

  const selectedItem =
    itemOptions.find((item) => String(item.id) === String(lineDraft.itemId)) ?? null;
  const minDate = todayYmd();
  const totals = useMemo(() => {
    return lineItems.reduce(
      (acc, line) => {
        acc.totalQty += Number(line.baseQty || 0);
        acc.totalValue += Number(line.disposalValue || 0);
        return acc;
      },
      { totalQty: 0, totalValue: 0 }
    );
  }, [lineItems]);
  const selectedItemStockByLocation = useMemo(() => {
    const selectedId = lineDraft.itemId;
    const location = normalizeLocationValue(form.location);
    if (!selectedId || !location) return 0;
    const queued = lineItems
      .filter((row) => row.itemId === selectedId)
      .reduce((sum, row) => sum + Number(row.inputQty || 0), 0);
    return Math.max(0, Number(availableQty || 0) - queued);
  }, [availableQty, form.location, lineDraft.itemId, lineItems]);
  const pagedLineItems = lineItems.slice(0, DISPOSAL_PAGE_SIZE);
  const locationOptions = useMemo(() => {
    const sourceTotals = lineDraft.itemId ? itemLocationTotals : locationTotals;
    const byLocation = new Map();
    for (const [loc, rawQty] of sourceTotals.entries()) {
      const locationName = String(loc || "").trim();
      if (!locationName) continue;
      const qty = Number(rawQty ?? 0);
      byLocation.set(locationName, {
        value: locationName,
        qty: Number.isFinite(qty) ? qty : 0,
        label: `${locationName} - ${Number.isFinite(qty) ? qty : 0}`,
      });
    }

    // Always merge known distinct locations so user can see locations
    // even when per-location quantities are still syncing.
    for (const loc of locations) {
      if (!byLocation.has(loc)) {
        let mergedQty = 0;
        for (const [sourceLoc, qtyRaw] of sourceTotals.entries()) {
          if (!locationMatchesSelection(loc, sourceLoc)) continue;
          const qty = Number(qtyRaw ?? 0);
          if (!Number.isFinite(qty)) continue;
          mergedQty += qty;
        }
        byLocation.set(loc, {
          value: loc,
          qty: mergedQty,
          label: `${loc} - ${mergedQty}`,
        });
      }
    }

    return Array.from(byLocation.values()).sort((a, b) => a.value.localeCompare(b.value));
  }, [itemLocationTotals, lineDraft.itemId, locationTotals, locations]);
  const locationItemOptions = useMemo(() => {
    const options = [];
    const seen = new Set();
    for (const item of itemOptions) {
      const itemId = item.id;
      const itemLabel = String(item.name || item.sku || "Item").trim();
      if (!itemId || !itemLabel) continue;
      for (const [key, qtyRaw] of stockByItemLocation.entries()) {
        const [keyItemId, loc] = String(key).split("::");
        if (keyItemId !== String(itemId)) continue;
        const qty = Number(qtyRaw ?? 0);
        if (!loc || !Number.isFinite(qty) || qty <= 0) continue;
        const dedupeKey = `${loc}::${itemId}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        options.push({
          value: `${loc}${LOCATION_ITEM_DELIMITER}${itemId}`,
          location: loc,
          itemId,
          qty,
          label: `${loc} - ${itemLabel} - ${qty}`,
        });
      }
    }
    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [itemOptions, stockByItemLocation]);
  const locationSelectOptions = useMemo(() => {
    if (locationItemOptions.length > 0) return locationItemOptions;
    return locationOptions.map((entry) => ({
      value: entry.value,
      label: entry.label,
      location: entry.value,
      itemId: "",
      qty: Number(entry.qty || 0),
    }));
  }, [locationItemOptions, locationOptions]);
  const selectedLocationItemLabel = useMemo(() => {
    if (!selectedLocationItemValue) return "";
    const matched = locationSelectOptions.find((entry) => entry.value === selectedLocationItemValue);
    if (matched) return matched.label;
    const [loc] = String(selectedLocationItemValue).split(LOCATION_ITEM_DELIMITER);
    return loc || "";
  }, [locationSelectOptions, selectedLocationItemValue]);
  const itemOptionsForSelectedLocation = useMemo(() => {
    const selectedLocation = normalizeLocationValue(form.location);
    if (!selectedLocation) return itemOptions;
    return itemOptions.filter((item) => {
      let totalAtLocation = 0;
      for (const [stockKey, qtyRaw] of stockByItemLocation.entries()) {
        const [stockItemId, stockLocation] = String(stockKey).split("::");
        if (String(stockItemId) !== String(item.id)) continue;
        if (!locationMatchesSelection(selectedLocation, stockLocation)) continue;
        const qty = Number(qtyRaw ?? 0);
        if (!Number.isFinite(qty)) continue;
        totalAtLocation += qty;
      }
      return totalAtLocation > 0;
    });
  }, [form.location, itemOptions, stockByItemLocation]);

  useEffect(() => {
    if (!open) return;
    if (!selectedItem) return;
    const baseUnit = String(selectedItem.unit_of_measure || "").trim() || "unit";
    setLineDraft((prev) => {
      if (prev.unit === baseUnit) return prev;
      return { ...prev, unit: baseUnit };
    });
  }, [open, selectedItem]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void supabase
      .from("inventory_item_locations")
      .select("item_id,location,quantity")
      .limit(10000)
      .then(async ({ data, error }) => {
        if (!active) return;
        const totals = new Map();
        const stockMap = new Map();
        if (!error) {
          for (const row of data ?? []) {
            const itemId = row.item_id;
            const loc = normalizeLocationValue(row.location);
            const qty = Number(row.quantity ?? 0);
            if (!loc || !Number.isFinite(qty)) continue;
            totals.set(loc, (totals.get(loc) ?? 0) + qty);
            if (itemId) {
              const stockKey = `${itemId}::${loc}`;
              stockMap.set(stockKey, (stockMap.get(stockKey) ?? 0) + qty);
            }
          }
        }
        // Fallback for environments where per-location table is restricted/unavailable.
        if (totals.size === 0) {
          const legacy = await supabase
            .from("inventory_items")
            .select("id,location,current_stock")
            .not("location", "is", null)
            .limit(5000);
          if (!legacy.error) {
            for (const row of legacy.data ?? []) {
              const itemId = row.id;
              const loc = normalizeLocationValue(row.location);
              const qty = Number(row.current_stock ?? 0);
              if (!loc || !Number.isFinite(qty)) continue;
              totals.set(loc, (totals.get(loc) ?? 0) + qty);
              if (itemId) {
                const stockKey = `${itemId}::${loc}`;
                stockMap.set(stockKey, (stockMap.get(stockKey) ?? 0) + qty);
              }
            }
          }
        }
        if (!active) return;
        setLocationTotals(totals);
        setStockByItemLocation(stockMap);
      });
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!lineDraft.itemId) {
      setItemLocationTotals(new Map());
      return;
    }
    let active = true;
    void supabase
      .from("inventory_item_locations")
      .select("location,quantity")
      .eq("item_id", lineDraft.itemId)
      .limit(1000)
      .then(async ({ data, error }) => {
        if (!active) return;
        const totals = new Map();
        if (!error) {
          for (const row of data ?? []) {
            const loc = normalizeLocationValue(row.location);
            const qty = Number(row.quantity ?? 0);
            if (!loc || !Number.isFinite(qty)) continue;
            totals.set(loc, (totals.get(loc) ?? 0) + qty);
          }
        }
        // Legacy fallback for item-level location quantity.
        if (totals.size === 0) {
          const legacy = await supabase
            .from("inventory_items")
            .select("location,current_stock")
            .eq("id", lineDraft.itemId)
            .limit(1);
          if (!legacy.error) {
            for (const row of legacy.data ?? []) {
              const loc = normalizeLocationValue(row.location);
              const qty = Number(row.current_stock ?? 0);
              if (!loc || !Number.isFinite(qty)) continue;
              totals.set(loc, (totals.get(loc) ?? 0) + qty);
            }
          }
        }
        if (!active) return;
        setItemLocationTotals(totals);
      });
    return () => {
      active = false;
    };
  }, [lineDraft.itemId, open]);

  useEffect(() => {
    if (!open) return;
    const itemId = lineDraft.itemId;
    const location = normalizeLocationValue(form.location);
    if (!itemId || !location) {
      setAvailableQty(null);
      return;
    }
    setLoadingAvailability(true);
    let qtyAtLocation = 0;
    for (const [stockKey, qtyRaw] of stockByItemLocation.entries()) {
      const [stockItemId, stockLocation] = String(stockKey).split("::");
      if (String(stockItemId) !== String(itemId)) continue;
      if (!locationMatchesSelection(location, stockLocation)) continue;
      const qty = Number(qtyRaw ?? 0);
      if (!Number.isFinite(qty)) continue;
      qtyAtLocation += qty;
    }
    setAvailableQty(Math.max(0, qtyAtLocation));
    setLoadingAvailability(false);
  }, [open, lineDraft.itemId, form.location, stockByItemLocation]);

  useEffect(() => {
    if (!open) return undefined;
    setForm({
      disposedBy: profileLabel(profile),
      location: "",
      date: "",
      adjustmentType: "",
      reasonDetail: "",
    });
    setLineDraft({
      itemId: "",
      quantity: "",
      unit: "",
    });
    setLineItems([]);
    setAttachments([]);
    setFormError("");
    setAvailableQty(null);
    setSelectedLocationItemValue("");
    setSubmitting("");
    setLoadingItems(true);
    let active = true;
    void supabase
      .from("inventory_items")
      .select("id,sku,name,current_stock,is_active,unit_of_measure,unit_cost")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(500)
      .then(({ data }) => {
        if (!active) return;
        setItemOptions(data ?? []);
      })
      .finally(() => {
        if (!active) return;
        setLoadingItems(false);
      });

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      active = false;
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, profile]);

  if (!open) return null;

  const setField = (key, value) => {
    setFormError("");
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const handleLocationItemChange = (value) => {
    setFormError("");
    setSelectedLocationItemValue(value || "");
    if (!value) {
      setForm((prev) => ({ ...prev, location: "" }));
      return;
    }
    const picked = locationSelectOptions.find((entry) => entry.value === value) || null;
    const [loc, itemId] = String(value).split(LOCATION_ITEM_DELIMITER);
    const nextLocation = normalizeLocationValue(loc);
    const selected = itemOptions.find((item) => String(item.id) === String(itemId || picked?.itemId || "")) ?? null;
    const unit = String(selected?.unit_of_measure || "").trim() || "unit";
    setForm((prev) => ({ ...prev, location: nextLocation || "" }));
    setLineDraft((prev) => {
      if (!selected?.id) return prev;
      return {
        ...prev,
        itemId: selected.id,
        unit,
        // Quantity is user-entered; do not auto-fill from selected availability.
        quantity: prev.quantity || "",
      };
    });
  };

  const addLineItem = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setFormError("");
    const qty = Number(lineDraft.quantity);
    const location = normalizeLocationValue(form.location);
    const date = String(form.date || "").trim();
    const item = selectedItem;
    const fromUnit = String(lineDraft.unit || "").trim();
    if (!item?.id) {
      setFormError("Select an item.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError("Quantity must be greater than 0.");
      return;
    }
    if (!fromUnit) {
      setFormError("Unit is required.");
      return;
    }
    if (!location) {
      setFormError("Location is required.");
      return;
    }
    if (!date) {
      setFormError("Date is required.");
      return;
    }
    if (date < minDate) {
      setFormError("Date cannot be in the past.");
      return;
    }
    if (!form.adjustmentType) {
      setFormError("Reason type is required.");
      return;
    }

    let available = 0;
    for (const [stockKey, qtyRaw] of stockByItemLocation.entries()) {
      const [stockItemId, stockLocation] = String(stockKey).split("::");
      if (String(stockItemId) !== String(item.id)) continue;
      if (!locationMatchesSelection(location, stockLocation)) continue;
      const qty = Number(qtyRaw ?? 0);
      if (!Number.isFinite(qty)) continue;
      available += qty;
    }
    const queued = lineItems
      .filter((row) => row.itemId === item.id)
      .reduce((sum, row) => sum + Number(row.inputQty || 0), 0);
    const remaining = Math.max(0, available - queued);
    if (qty > remaining) {
      setFormError(`Insufficient stock at "${location}". Available: ${remaining}, requested: ${qty}.`);
      return;
    }

    const baseUom = String(item.unit_of_measure || "").trim() || "unit";
    const baseQty = await convertItemQuantity({
      itemId: item.id,
      qty,
      fromUnit,
      toUnit: baseUom,
    });

    const unitCost = await resolveCostBasis(item.id, item.unit_cost);
    const disposalValue = unitCost * Number(baseQty || 0);
    setLineItems((prev) => [
      ...prev,
      {
        id: `${item.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        itemId: item.id,
        sku: item.sku || "—",
        itemName: item.name || "—",
        inputQty: qty,
        inputUnit: fromUnit,
        baseQty,
        baseUnit: baseUom,
        costBasis: unitCost,
        disposalValue,
      },
    ]);
    setLineDraft({ itemId: "", quantity: "", unit: "" });
    setAvailableQty(null);
  };

  const handleManualEntryKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void addLineItem(event);
  };

  const handleSubmit = async (e, submitIntent = "submit") => {
    if (e?.preventDefault) e.preventDefault();
    setFormError("");
    const location = normalizeLocationValue(form.location);
    const date = String(form.date || "").trim();
    const disposedBy = String(form.disposedBy || "").trim();
    if (!disposedBy) {
      setFormError("Disposed by is required.");
      return;
    }
    if (!location) {
      setFormError("Location is required.");
      return;
    }
    if (!date) {
      setFormError("Disposal date is required.");
      return;
    }
    if (date < minDate) {
      setFormError("Date cannot be in the past.");
      return;
    }
    if (!form.adjustmentType) {
      setFormError("Reason type is required.");
      return;
    }
    if (lineItems.length === 0) {
      setFormError("Add at least one line item.");
      return;
    }

    const nextStatus = submitIntent === "draft" ? "draft" : "pending";
    setSubmitting(submitIntent);
    const adjustmentPrefix = `ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let attachmentPaths = [];
    try {
      attachmentPaths = await uploadDisposalAttachments({
        files: attachments,
        profileId: profile?.id || "anonymous",
      });
    } catch (uploadErr) {
      setSubmitting("");
      setFormError(`Attachment upload failed: ${getErrorMessage(uploadErr)}`);
      return;
    }
    const rows = lineItems.map((line, idx) => {
      const reason = [
        `${form.adjustmentType}`,
        `Disposed by: ${disposedBy}`,
        `Location: ${location}`,
        `Date: ${date}`,
        line.inputUnit.toLowerCase() === line.baseUnit.toLowerCase()
          ? ""
          : `Input: ${line.inputQty} ${line.inputUnit} (base ${line.baseQty} ${line.baseUnit})`,
        form.reasonDetail.trim(),
      ]
        .filter(Boolean)
        .join(" | ");
      return {
        adjustment_number: `${adjustmentPrefix}-${String(idx + 1).padStart(2, "0")}`,
        item_id: line.itemId,
        adjustment_type: form.adjustmentType,
        quantity: line.baseQty,
        reason,
        created_by: profile?.id ?? null,
        requested_location: location,
        requested_date: date,
        status: nextStatus,
        attachment_paths: attachmentPaths,
      };
    });
    const { error } = await supabase.from("stock_adjustments").insert(rows);
    if (error) {
      setSubmitting("");
      setFormError(getErrorMessage(error));
      return;
    }
    setSubmitting("");
    await onCreated?.({
      lineCount: lineItems.length,
      unitCount: totals.totalQty,
      status: nextStatus,
    });
    onClose();
  };

  return (
    <div
      className={
        inline
          ? "w-full"
          : "fixed inset-0 z-[60] flex items-center justify-center bg-on-surface/20 p-4 backdrop-blur-[12px] transition-opacity"
      }
      role="dialog"
      aria-modal={inline ? undefined : "true"}
      aria-labelledby="create-disposal-title"
      onClick={(e) => {
        if (!inline && e.target === e.currentTarget) onClose();
      }}
    >
        <div
          className={
            inline
              ? "flex w-full flex-col overflow-hidden rounded-[1.15rem] border border-slate-200/70 bg-white/90 shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
              : "flex w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-[0_12px_32px_-4px_rgba(23,28,31,0.06)]"
          }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between rounded-t-[1.15rem] bg-primary px-3 py-2.5 text-white">
          <h2 id="create-disposal-title" className="font-headline text-sm font-extrabold tracking-tight text-white">
            Dispose Inventory
          </h2>
          {!inline ? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full border border-white/25 bg-white/10 p-2 text-white transition-all hover:bg-white/20"
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          ) : null}
        </div>

        <form className="flex h-full min-h-0 flex-col space-y-1 p-2 pt-0 overflow-hidden" onSubmit={(e) => void handleSubmit(e, "submit")}>
          {formError ? <p className="text-sm font-medium text-error">{formError}</p> : null}
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary/60">Manual Input Preview Table</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{lineItems.length} items</span>
            </div>
            <div className="mb-1.5 grid grid-cols-1 gap-1 md:grid-cols-4">
              <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Location</label>
                <div className="relative">
                  <select
                    value={selectedLocationItemValue}
                    onChange={(e) => handleLocationItemChange(e.target.value)}
                    disabled={Boolean(submitting)}
                    className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px] text-slate-900"
                  >
                    <option value="">Select location...</option>
                    {locationSelectOptions.map((entry) => (
                      <option key={`disp-loc-item-${entry.value}`} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Dispose Date</label>
                <input
                  type="date"
                  min={minDate}
                  value={form.date}
                  onChange={(e) => setField("date", e.target.value)}
                  disabled={Boolean(submitting)}
                  className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]"
                />
              </div>
              <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Disposed By</label>
                <input
                  value={form.disposedBy}
                  onChange={(e) => setField("disposedBy", e.target.value)}
                  disabled={Boolean(submitting)}
                  className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]"
                />
              </div>
              <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Reason</label>
                <div className="relative">
                  <select
                    value={form.adjustmentType}
                    onChange={(e) => setField("adjustmentType", e.target.value)}
                    disabled={Boolean(submitting)}
                    className="h-5 w-full appearance-none rounded-md border-none bg-white px-1.5 text-[10px] !text-slate-900 [color-scheme:light]"
                    style={{
                      color: "#0f172a",
                      colorScheme: "light",
                      WebkitTextFillColor: "#0f172a",
                      WebkitAppearance: "none",
                      MozAppearance: "none",
                      appearance: "none",
                      backgroundImage: "none",
                      opacity: 1,
                    }}
                  >
                    <option value="" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>Select reason...</option>
                    {adjustmentTypeOptions.map((reason) => (
                      <option key={reason.value} value={reason.value} style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 left-1.5 flex items-center pr-6 text-[10px] text-slate-900">
                    {adjustmentTypeOptions.find((opt) => opt.value === form.adjustmentType)?.label || "Select reason..."}
                  </span>
                  <span className="material-symbols-outlined pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[14px] text-slate-500">
                    expand_more
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-slate-200">
              <div className="h-full min-h-[180px] overflow-x-auto overflow-y-hidden">
                <table className="w-full min-w-[980px] table-fixed text-left text-[10px]">
                  <thead className="sticky top-0 z-10 bg-slate-100">
                    <tr>
                      <th className="w-[16%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">SKU-Code</th>
                      <th className="w-[18%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Item Name</th>
                      <th className="w-[8%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">UOM</th>
                      <th className="w-[10%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Quantity</th>
                      <th className="w-[14%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Cost Basis</th>
                      <th className="w-[14%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Disposal Value</th>
                      <th className="w-[10%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 bg-white">
                    {pagedLineItems.map((line) => (
                      <tr key={line.id}>
                        <td className="truncate px-2 py-1 font-medium">{line.sku}</td>
                        <td className="truncate px-2 py-1">{line.itemName}</td>
                        <td className="px-2 py-1">{line.inputUnit}</td>
                        <td className="px-2 py-1 text-center font-semibold">{line.inputQty}</td>
                        <td className="truncate px-2 py-1">{formatMoney(line.costBasis)}</td>
                        <td className="truncate px-2 py-1">{formatMoney(line.disposalValue)}</td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => setLineItems((prev) => prev.filter((it) => it.id !== line.id))}
                            className="rounded-full p-0.5 hover:bg-slate-100"
                            aria-label={`Remove ${line.sku}`}
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/70">
                      <td className="px-1.5 py-1">
                        <div className="relative">
                          <select
                            value={lineDraft.itemId}
                            onChange={(e) => {
                              const nextItemId = e.target.value;
                              const selectedLocation = normalizeLocationValue(form.location);
                              const availableAtLocation = selectedLocation
                                ? Number(stockByItemLocation.get(`${nextItemId}::${selectedLocation}`) ?? 0)
                                : 0;
                              setLineDraft((prev) => ({
                                ...prev,
                                itemId: nextItemId,
                                quantity: prev.quantity || (availableAtLocation > 0 ? "1" : ""),
                              }));
                            }}
                            onKeyDown={handleManualEntryKeyDown}
                            disabled={loadingItems || Boolean(submitting)}
                            className="h-6 w-full appearance-none rounded-md border-none bg-white px-1.5 text-[10px] !text-slate-900 [color-scheme:light]"
                            style={{
                              color: "#0f172a",
                              colorScheme: "light",
                              WebkitTextFillColor: "#0f172a",
                              WebkitAppearance: "none",
                              MozAppearance: "none",
                              appearance: "none",
                              backgroundImage: "none",
                              opacity: 1,
                            }}
                          >
                            <option value="" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
                              {loadingItems ? "Loading..." : "Select SKU..."}
                            </option>
                            {itemOptionsForSelectedLocation.map((item) => {
                              const selectedLocation = normalizeLocationValue(form.location);
                              const qty = selectedLocation
                                ? Number(stockByItemLocation.get(`${item.id}::${selectedLocation}`) ?? 0)
                                : Number(item.current_stock ?? 0);
                              return (
                              <option key={item.id} value={item.id} style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
                                {item.sku} - {item.name || "Item"} - {qty}
                              </option>
                              );
                            })}
                          </select>
                          <span className="pointer-events-none absolute inset-y-0 left-1.5 flex items-center pr-6 text-[10px] text-slate-900">
                            {selectedItem?.sku || (loadingItems ? "Loading..." : "Select SKU...")}
                          </span>
                          <span className="material-symbols-outlined pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[14px] text-slate-500">
                            expand_more
                          </span>
                        </div>
                      </td>
                      <td className="px-1.5 py-1">
                        <input
                          value={selectedItem?.name || ""}
                          readOnly
                          className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px]"
                        />
                      </td>
                      <td className="px-1.5 py-1">
                        <input
                          value={lineDraft.unit}
                          readOnly
                          className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px]"
                        />
                      </td>
                      <td className="px-1.5 py-1">
                        <input
                          value={lineDraft.quantity}
                          onChange={(e) => setLineDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                          onKeyDown={handleManualEntryKeyDown}
                          type="number"
                          min="1"
                          max={selectedItemStockByLocation || undefined}
                          className="h-6 w-full rounded-md border-none bg-white px-1.5 text-center text-[10px]"
                        />
                      </td>
                      <td className="px-1.5 py-1 text-[9px] text-on-surface-variant">Auto</td>
                      <td className="px-1.5 py-1 text-[9px] text-on-surface-variant">Auto</td>
                      <td className="px-1.5 py-1 text-center">
                        <button
                          type="button"
                          onClick={(e) => void addLineItem(e)}
                          disabled={Boolean(submitting) || loadingItems}
                          className="text-[9px] font-semibold text-primary/80 disabled:opacity-50"
                        >
                          Enter
                        </button>
                      </td>
                    </tr>
                    {Array.from({ length: Math.max(0, DISPOSAL_PAGE_SIZE - pagedLineItems.length - 1) }).map((_, idx) => (
                      <tr key={`dispose-empty-row-${idx}`} className="bg-white">
                        <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                        <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                        <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                        <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>
                        <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
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
                        <td className="px-2 py-1.5 text-center font-semibold">{totals.totalQty}</td>
                        <td className="px-2 py-1.5" colSpan={2}></td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => setLineItems([])}
                            className="rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-white/25"
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
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-on-surface-variant">
                  Total Quantity: <span className="font-semibold text-on-surface">{totals.totalQty} units</span>
                </span>
                <span className="text-[10px] text-on-surface-variant">
                  Total Value: <span className="font-semibold text-on-surface">{formatMoney(totals.totalValue)}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Attachment</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                  disabled={Boolean(submitting)}
                  className="h-5 rounded-md border-none bg-slate-100 px-1.5 text-[9px]"
                />
                <button
                  type="button"
                  onClick={(e) => void handleSubmit(e, "draft")}
                  disabled={Boolean(submitting) || loadingItems}
                  className="h-6 rounded-full bg-surface-container px-2.5 text-[9px] font-bold text-on-surface disabled:opacity-60"
                >
                  {submitting === "draft" ? "Saving..." : "Save"}
                </button>
                <button
                  type="submit"
                  disabled={Boolean(submitting) || loadingItems}
                  className="h-6 rounded-full bg-primary px-2.5 text-[9px] font-bold text-white disabled:opacity-45"
                >
                  {submitting === "submit" ? "Submitting..." : `Submit for Approval (${lineItems.length})`}
                </button>
              </div>
            </div>
            <textarea
              className="mt-1 w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px]"
              placeholder="Additional details (optional)"
              rows={1}
              value={form.reasonDetail}
              onChange={(e) => setField("reasonDetail", e.target.value)}
              disabled={Boolean(submitting)}
            />
            <p className="text-[9px] text-on-surface-variant">
              {loadingAvailability
                ? "Checking availability..."
                : availableQty == null
                  ? "Select item and location to see available quantity."
                  : `Available at selected location: ${selectedItemStockByLocation}`}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DisposeInventory() {
  const { profile, user, role } = useAuth();
  const [disposeSuccess, setDisposeSuccess] = useState(null);
  const [filter, setFilter] = useState("All");
  const modalLocations = useDistinctLocations(true);

  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [actionBusyId, setActionBusyId] = useState("");
  const [actionError, setActionError] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setActionError("");
    const base =
      "id, adjustment_number, adjustment_type, quantity, reason, created_at, approved_by, created_by, status, reviewed_by, reviewed_at, review_notes, requested_location, inventory_items ( name, sku ), creator:profiles!stock_adjustments_created_by_fkey ( first_name, last_name, avatar_url, email, roles(name) ), approver:profiles!stock_adjustments_approved_by_fkey ( first_name, last_name, avatar_url, email, roles(name) ), reviewer:profiles!stock_adjustments_reviewed_by_fkey ( first_name, last_name, avatar_url, email, roles(name) )";
    let { data, error } = await supabase.from("stock_adjustments").select(base).order("created_at", { ascending: false }).limit(200);
    if (error) {
      const fallback = await supabase
        .from("stock_adjustments")
        .select(
          "id, adjustment_number, adjustment_type, quantity, reason, created_at, approved_by, created_by, status, reviewed_by, inventory_items ( name, sku ), creator:profiles!stock_adjustments_created_by_fkey ( first_name, last_name, avatar_url, email ), approver:profiles!stock_adjustments_approved_by_fkey ( first_name, last_name, avatar_url, email ), reviewer:profiles!stock_adjustments_reviewed_by_fkey ( first_name, last_name, avatar_url, email )"
        )
        .order("created_at", { ascending: false })
        .limit(200);
      data = fallback.data;
      error = fallback.error;
    }
    if (error) setLoadError(getErrorMessage(error));
    else setRawRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadRows();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRows]);

  useEffect(() => {
    if (!disposeSuccess) return undefined;
    const t = window.setTimeout(() => setDisposeSuccess(null), 5000);
    return () => window.clearTimeout(t);
  }, [disposeSuccess]);

  const enriched = useMemo(() => {
    return rawRows.map((r) => {
      const inv = r.inventory_items;
      const item = Array.isArray(inv) ? inv[0] : inv;
      const status = rowStatus(r);
      return {
        ...r,
        _itemName: item?.name ?? "—",
        _sku: item?.sku ?? "—",
        _status: status,
        _when: r.created_at ? new Date(r.created_at).toLocaleString() : "—",
      };
    });
  }, [rawRows]);

  const reviewAdjustment = useCallback(
    async (row, action) => {
      const isReject = action === "reject";
      const reviewNotes = isReject ? window.prompt("Reason for rejection (required):", "") : "";
      if (isReject && reviewNotes == null) return;
      if (isReject && !String(reviewNotes || "").trim()) {
        setActionError("Rejection reason is required.");
        return;
      }

      setActionError("");
      setActionBusyId(row.id);
      const { error } = await supabase.rpc("process_stock_adjustment_review", {
        p_adjustment_id: row.id,
        p_action: action,
        p_review_notes: String(reviewNotes || "").trim() || null,
      });
      setActionBusyId("");
      if (error) {
        setActionError(getErrorMessage(error));
        return;
      }
      await loadRows();
    },
    [loadRows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((r) => {
      const activeFilter = String(filter || "").toLowerCase();
      if (activeFilter === "pending" && r._status !== "pending") return false;
      if (activeFilter === "approved" && r._status !== "approved") return false;
      if (activeFilter === "rejected" && r._status !== "rejected") return false;
      if (!q) return true;
      const blob = [r.adjustment_number, r._itemName, r._sku, r.reason, r.adjustment_type].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [enriched, filter, search]);

  const stats = useMemo(() => {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonth = rawRows.filter((r) => r.created_at && r.created_at >= startMonth).length;
    const pending = rawRows.filter((r) => rowStatus(r) === "pending").length;
    return { thisMonth, pending, total: rawRows.length };
  }, [rawRows]);

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
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 min-w-0">
            <NotificationBell />
            {role ? (
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {role}
              </span>
            ) : null}
            <span className="shrink-0 rounded-full border-2 border-surface-bright bg-surface-container-high p-0">
              <UserAvatarOrIcon src={profile?.avatar_url} alt={profileLabel(profile)} size="md" />
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-2 pb-4 pt-[4.2rem] sm:px-3 lg:px-4">
        <section className="py-1">
          <div className="relative mx-auto w-full overflow-hidden rounded-[1.4rem] border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest to-surface shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            <div className="min-h-[calc(100dvh-5.2rem)]">
              <div className="relative h-[calc(100dvh-6.3rem)] min-h-0 overflow-hidden bg-transparent p-1 sm:p-1.5 lg:p-2 flex flex-col">
                <Link
                  to="/dashboard"
                  className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-outline-variant/20 bg-white text-on-surface-variant transition-all hover:border-error/20 hover:text-error"
                  aria-label="Close dispose page"
                  title="Close"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </Link>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <CreateDisposalRequestModal
                    open
                    inline
                    onClose={() => {}}
                    profile={profile}
                    user={user}
                    role={role}
                    locations={modalLocations}
                    onCreated={async (created) => {
                      await loadRows();
                      setDisposeSuccess(created ?? { lineCount: 1, unitCount: 0, status: "pending" });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 w-full rounded-t-3xl border-t border-slate-100 bg-white/90 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/90 md:hidden">
        <div className="flex w-full items-center justify-around px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            to="/"
            className="flex flex-col items-center justify-center font-label text-[10px] font-medium text-slate-400 transition-transform duration-200 active:scale-95 dark:text-slate-500"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>Home</span>
          </Link>
          <Link
            to="/inventory"
            className="flex flex-col items-center justify-center font-label text-[10px] font-medium text-slate-400 transition-transform duration-200 active:scale-95 dark:text-slate-500"
          >
            <span className="material-symbols-outlined">inventory_2</span>
            <span>Inventory</span>
          </Link>
          <div className="flex flex-col items-center justify-center rounded-2xl bg-blue-50 px-5 py-2 font-label text-[10px] font-medium text-blue-700 transition-transform duration-200 active:scale-95 dark:bg-blue-900/30 dark:text-blue-300">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              delete_sweep
            </span>
            <span>Dispose</span>
          </div>
          <Link
            to="/count"
            className="flex flex-col items-center justify-center font-label text-[10px] font-medium text-slate-400 transition-transform duration-200 active:scale-95 dark:text-slate-500"
          >
            <span className="material-symbols-outlined">fact_check</span>
            <span>Count</span>
          </Link>
        </div>
      </nav>

      {disposeSuccess ? (
        <div className="fixed bottom-6 left-1/2 z-[120] w-[min(100%-2rem,560px)] -translate-x-1/2 pointer-events-auto">
          <div className="flex items-start gap-3 rounded-3xl border border-green-200/80 bg-white/95 p-4 pr-3 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.2)] backdrop-blur-xl">
            <div className="shrink-0 rounded-2xl bg-green-50 p-2">
              <span className="material-symbols-outlined text-2xl text-green-700">check_circle</span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-headline text-sm font-bold text-on-surface">
                {disposeSuccess.status === "draft" ? "Disposal request saved as draft" : "Disposal request submitted for approval"}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {disposeSuccess.lineCount} line{disposeSuccess.lineCount === 1 ? "" : "s"} · {disposeSuccess.unitCount} unit
                {disposeSuccess.unitCount === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDisposeSuccess(null)}
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
