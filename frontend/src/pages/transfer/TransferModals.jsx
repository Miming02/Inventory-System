import { useEffect, useMemo, useState } from "react";
import { useDistinctLocations } from "../../lib/useDistinctLocations";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { uploadAttachment } from "../../lib/storageUpload";
import { SkuAutocompleteInput } from "../../components/SkuAutocompleteInput";

function generateTransferReference() {
  return `TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function buildRequestedByLabel(profile, user) {
  const first = String(profile?.first_name || "").trim();
  const last = String(profile?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || String(user?.email || "").trim() || "—";
}

function formatMoney(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function valueFromRow(row, aliases) {
  const aliasSet = new Set(aliases.map((a) => normalizeHeader(a)));
  for (const [key, val] of Object.entries(row || {})) {
    if (aliasSet.has(normalizeHeader(key))) return val;
  }
  return "";
}

function parseCsvText(csvText) {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = cols[idx] ?? "";
    });
    return row;
  });
}

async function parseBatchFile(file) {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return parseCsvText(text);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const xlsx = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: "array" });
    const firstSheet = workbook.SheetNames?.[0];
    if (!firstSheet) return [];
    return xlsx.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });
  }
  throw new Error("Unsupported file format. Upload CSV or Excel.");
}

function useModalA11y(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
}

function RenderSafeSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  wrapperClassName = "",
  inputClassName = "",
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

export function TransferScanModal({ open, onClose, onReviewDone, inline = false, compact = false }) {
  const dense = inline || compact;
  useModalA11y(open && !inline, onClose);
  const { user, profile } = useAuth();
  const locations = useDistinctLocations(open);
  const [inventoryOptions, setInventoryOptions] = useState([]);
  const [itemStockByLocation, setItemStockByLocation] = useState(new Map());
  const [hasLocationStockData, setHasLocationStockData] = useState(false);
  const [step, setStep] = useState("entry");
  const [skuValue, setSkuValue] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState("1");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [transferBy, setTransferBy] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [attachmentPath, setAttachmentPath] = useState("");
  const [attachmentMsg, setAttachmentMsg] = useState("");
  const [queue, setQueue] = useState([]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const requestedBy = buildRequestedByLabel(profile, user);

  useEffect(() => {
    if (!open) return;
    setStep("entry");
    setSkuValue("");
    setSelectedItem(null);
    setQuantity("1");
    setFromLocation("");
    setToLocation("");
    setTransferDate("");
    setTransferBy("");
    setReferenceNo(generateTransferReference());
    setAttachmentPath("");
    setAttachmentMsg("");
    setQueue([]);
    setFormError("");
    setSaving(false);
    setItemStockByLocation(new Map());
    setHasLocationStockData(false);
    void Promise.all([
      supabase
        .from("inventory_items")
        .select("id,sku,name,unit_of_measure,current_stock,is_active")
        .neq("is_active", false)
        .order("name", { ascending: true })
        .limit(3000),
      supabase
        .from("inventory_item_locations")
        .select("item_id,location,quantity")
        .limit(5000),
    ]).then(([itemsRes, locRes]) => {
      const itemsData = itemsRes.data ?? [];
      if (!locRes.error) {
        const map = new Map();
        for (const row of locRes.data ?? []) {
          const itemId = row.item_id;
          const loc = String(row.location || "").trim();
          const qty = Number(row.quantity ?? 0);
          if (!itemId || !loc || !Number.isFinite(qty) || qty <= 0) continue;
          const key = `${itemId}::${loc}`;
          map.set(key, (map.get(key) ?? 0) + qty);
        }
        setItemStockByLocation(map);
        setHasLocationStockData(map.size > 0);
        const availableIds = new Set();
        for (const key of map.keys()) {
          const [itemId] = key.split("::");
          if (itemId) availableIds.add(itemId);
        }
        setInventoryOptions(
          itemsData.filter(
            (row) => row?.sku && (availableIds.has(String(row.id)) || Number(row.current_stock ?? 0) > 0)
          )
        );
        return;
      }
      setInventoryOptions(itemsData.filter((row) => row?.sku && Number(row.current_stock ?? 0) > 0));
    });
  }, [open]);

  const queueTotalQty = queue.reduce((acc, row) => acc + Number(row.quantity || 0), 0);
  const selectedScanItem =
    selectedItem || inventoryOptions.find((opt) => String(opt.sku || "").toLowerCase() === skuValue.trim().toLowerCase()) || null;
  const scanFromLocationOptions = useMemo(() => {
    if (!selectedScanItem?.id || !hasLocationStockData) return [];
    const out = [];
    for (const loc of locations) {
      const key = `${selectedScanItem.id}::${loc}`;
      const availableQty = Number(itemStockByLocation.get(key) ?? 0);
      const queuedQty = queue
        .filter((row) => row.itemId === selectedScanItem.id && row.fromLocation === loc)
        .reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
      const remaining = Math.max(0, availableQty - queuedQty);
      if (remaining > 0) out.push({ location: loc, available: remaining });
    }
    return out;
  }, [hasLocationStockData, itemStockByLocation, locations, queue, selectedScanItem?.id]);

  const handleAttachmentSelect = async (file) => {
    if (!user?.id || !file) return;
    setAttachmentMsg("");
    try {
      const { path } = await uploadAttachment(user.id, file, "transfer-docs");
      setAttachmentPath(path);
      setAttachmentMsg(`Uploaded: ${path}`);
    } catch (e) {
      setAttachmentPath("");
      setAttachmentMsg(getErrorMessage(e));
    }
  };

  const handleAddItem = () => {
    setFormError("");
    const matched = selectedItem || inventoryOptions.find((opt) => String(opt.sku || "").toLowerCase() === skuValue.trim().toLowerCase());
    const qty = Number(quantity);
    if (!matched?.id) return setFormError("Scan or select a valid SKU.");
    if (!Number.isFinite(qty) || qty <= 0) return setFormError("Quantity Transferred must be greater than 0.");
    if (!fromLocation) return setFormError("From Location is required.");
    if (!toLocation) return setFormError("To Location is required.");
    if (fromLocation === toLocation) return setFormError("From and To locations must be different.");
    if (!transferDate) return setFormError("Transfer Date is required.");
    if (!transferBy.trim()) return setFormError("Transfer By is required.");
    if (!requestedBy.trim() || requestedBy === "—") return setFormError("Requested By is required.");
    if (!referenceNo.trim()) return setFormError("Reference No. is required.");
    if (hasLocationStockData) {
      const key = `${matched.id}::${fromLocation}`;
      const availableQty = Number(itemStockByLocation.get(key) ?? 0);
      const queuedQty = queue
        .filter((row) => row.itemId === matched.id && row.fromLocation === fromLocation)
        .reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
      const remainingQty = Math.max(0, availableQty - queuedQty);
      if (remainingQty <= 0) return setFormError(`No available stock left for ${matched.sku} in "${fromLocation}".`);
      if (qty > remainingQty) return setFormError(`Quantity exceeds available stock. Remaining in "${fromLocation}": ${remainingQty}.`);
    }
    setQueue((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        itemId: matched.id,
        sku: matched.sku,
        itemName: matched.name || matched.sku,
        quantity: qty,
        unit: String(matched.unit_of_measure || "unit").trim() || "unit",
        fromLocation,
        toLocation,
        transferDate,
        transferBy: transferBy.trim(),
        requestedBy,
        referenceNo: referenceNo.trim(),
        attachmentPath: attachmentPath || "",
      },
    ]);
    setSkuValue("");
    setSelectedItem(null);
    setQuantity("1");
    setReferenceNo(generateTransferReference());
  };

  const handleManualEntryKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleAddItem();
  };

  const handleFinalize = async (submitIntent = "submit") => {
    if (queue.length === 0) return setFormError("Add at least one item before finalizing.");
    setSaving(true);
    try {
      await onReviewDone?.({ lineCount: queue.length, unitCount: queueTotalQty, queue, submitIntent });
      onClose();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open && !inline) return null;

  return (
    <div className={inline ? "w-full" : "fixed inset-0 z-[90] flex items-center justify-center p-4 overflow-y-auto bg-on-surface/30 backdrop-blur-sm"} role="dialog" aria-modal={inline ? undefined : "true"} aria-labelledby="transfer-scan-title" onClick={inline ? undefined : (e) => e.target === e.currentTarget && onClose()}>
      <div className={inline ? "w-full overflow-hidden max-h-[calc(100dvh-10rem)]" : "w-full max-w-5xl my-4 bg-surface-container-lowest rounded-3xl overflow-hidden"} onClick={inline ? undefined : (e) => e.stopPropagation()}>
        <div className={`${dense ? "px-2 py-2" : "px-5 py-4"} flex items-center justify-between bg-surface-bright`}>
          <h1 id="transfer-scan-title" className={`${dense ? "text-base" : "text-2xl"} font-extrabold tracking-tight text-on-surface font-headline`}>
            Scan SKU or Code
          </h1>
          {!inline ? (
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-high transition-colors" aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          ) : null}
        </div>
        {step === "review" ? (
          <div className="p-5 overflow-y-auto">
            <button type="button" onClick={() => setStep("entry")} className="text-sm font-bold text-primary flex items-center gap-1 mb-4">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Back to scan
            </button>
            <div className="rounded-2xl border border-outline-variant/20 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-high/90">
                  <tr>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">SKU</th>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">Item</th>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">Qty</th>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">From</th>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {queue.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3">{row.sku}</td>
                      <td className="px-3 py-3">{row.itemName}</td>
                      <td className="px-3 py-3">{row.quantity}</td>
                      <td className="px-3 py-3">{row.fromLocation}</td>
                      <td className="px-3 py-3">{row.toLocation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {formError ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setStep("entry")} className="px-7 py-3 rounded-full font-bold text-sm bg-secondary-container text-on-secondary-container">
                Edit list
              </button>
              <button type="button" disabled={saving} onClick={() => void handleFinalize("draft")} className="px-7 py-3 rounded-full font-bold text-sm bg-surface-container-high text-on-surface disabled:opacity-50">
                {saving ? "Saving..." : "Save as Draft"}
              </button>
              <button type="button" disabled={saving} onClick={() => void handleFinalize("submit")} className="px-9 py-3 rounded-full font-bold text-sm bg-gradient-to-r from-primary to-primary-container text-on-primary disabled:opacity-50">
                {saving ? "Saving..." : "Submit for Approval"}
              </button>
            </div>
          </div>
        ) : (
          <div className={`${dense ? "p-2" : "p-5"} overflow-y-auto`}>
            {formError ? <p className="mb-2 text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
            <div className="mb-2 space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Scan SKU or Code</label>
              <SkuAutocompleteInput
                options={inventoryOptions.map((opt) => ({ sku: opt.sku, name: opt.name }))}
                value={skuValue}
                onChange={setSkuValue}
                onSelect={(opt) => {
                  if (!opt) return setSelectedItem(null);
                  const matched = inventoryOptions.find((row) => row.sku === opt.sku) || null;
                  setSelectedItem(matched);
                }}
                inputClassName="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20"
                placeholder="Scan barcode or type SKU..."
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
              <section className="rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Transfer Setup</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Quantity</label>
                  <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20" type="number" min="1" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Transfer Date</label>
                  <input value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20" type="date" />
                </div>
              </section>

              <section className="rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Source & Destination</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">From Location</label>
                  <RenderSafeSelect
                    value={fromLocation}
                    onChange={setFromLocation}
                    placeholder={selectedScanItem?.id ? "Select source location..." : "Select SKU first..."}
                    options={(hasLocationStockData ? scanFromLocationOptions : locations.map((loc) => ({ location: loc, available: null }))).map((entry) => ({
                      value: entry.location,
                      label: entry.available == null ? entry.location : `${entry.location} - ${entry.available}`,
                    }))}
                    inputClassName="h-8 rounded-lg px-2.5 text-sm text-slate-900 bg-white border border-slate-200 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">To Location</label>
                  <RenderSafeSelect
                    value={toLocation}
                    onChange={setToLocation}
                    placeholder="Select..."
                    options={locations.map((loc) => ({ value: loc, label: loc }))}
                    inputClassName="h-8 rounded-lg px-2.5 text-sm text-slate-900 bg-white border border-slate-200 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </section>

              <section className="rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Transfer Support</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Transfer By</label>
                  <input value={transferBy} onChange={(e) => setTransferBy(e.target.value)} className="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20" type="text" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Requested By</label>
                  <input value={requestedBy} readOnly className="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none text-on-surface-variant" type="text" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Reference No.</label>
                  <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20" type="text" />
                </div>
              </section>
            </div>

            <div className="mt-2 rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Attachment (Optional)</label>
              <input
                className="w-full h-8 rounded-lg px-2.5 py-1 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleAttachmentSelect(f);
                  e.target.value = "";
                }}
              />
              {attachmentMsg ? <p className="text-xs text-on-surface-variant">{attachmentMsg}</p> : null}
            </div>

            <div className="mt-2 flex flex-col md:flex-row gap-2">
              <button type="button" onClick={handleAddItem} className="flex-1 h-8 px-4 rounded-full bg-surface-container-high text-on-secondary-container font-bold text-sm flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">playlist_add</span>
                Add Item to List
              </button>
              <button type="button" onClick={() => setStep("review")} disabled={queue.length === 0} className="flex-1 h-8 px-4 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined text-[18px]">fact_check</span>
                Proceed to Review List ({queue.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TransferManualModal({ open, onClose, onReviewDone, inline = false, compact = false, operationType = "transfer" }) {
  const MANUAL_PAGE_SIZE = 22;
  const dense = inline || compact;
  useModalA11y(open && !inline, onClose);
  const { user, profile } = useAuth();
  const locations = useDistinctLocations(open);
  const [skuOptions, setSkuOptions] = useState([]);
  const [itemStockByLocation, setItemStockByLocation] = useState(new Map());
  const [hasLocationStockData, setHasLocationStockData] = useState(false);
  const [selectedItemStockByLocation, setSelectedItemStockByLocation] = useState(new Map());
  const [skuValue, setSkuValue] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemNameLocked, setItemNameLocked] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [baseUnit, setBaseUnit] = useState("");
  const [unitCost, setUnitCost] = useState(0);
  const [transferDate, setTransferDate] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [transferBy, setTransferBy] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [attachmentPath, setAttachmentPath] = useState("");
  const [attachmentMsg, setAttachmentMsg] = useState("");
  const [queue, setQueue] = useState([]);
  const [step, setStep] = useState("entry");
  const [formError, setFormError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [saving, setSaving] = useState(false);
  const [queuePage, setQueuePage] = useState(1);

  const requestedBy = buildRequestedByLabel(profile, user);

  const sameLocationSelected =
    Boolean(fromLocation) && Boolean(toLocation) && fromLocation === toLocation;

  const applySkuSelection = (nextSku) => {
    const normalized = String(nextSku || "").trim();
    setSkuValue(normalized);
    const matched = availableSkuOptions.find((opt) => opt.sku?.toLowerCase() === normalized.toLowerCase());
    if (!matched) {
      setItemName("");
      setItemNameLocked(false);
      setBaseUnit("");
      setUnit("");
      setUnitCost(0);
      return;
    }
    setItemName(matched.name || "");
    setItemNameLocked(true);
    const uom = String(matched.unit_of_measure || "").trim();
    setBaseUnit(uom);
    setUnit(uom);
    setUnitCost(Number(matched.unit_cost ?? 0));
  };

  useEffect(() => {
    if (!open) return;
    setSkuValue("");
    setItemName("");
    setItemNameLocked(false);
    setQuantity("");
    setUnit("");
    setBaseUnit("");
    setUnitCost(0);
    setTransferDate("");
    setFromLocation("");
    setToLocation("");
    setTransferBy("");
    setReferenceNo(generateTransferReference());
    setAttachmentPath("");
    setAttachmentMsg("");
    setQueue([]);
    setItemStockByLocation(new Map());
    setHasLocationStockData(false);
    setSelectedItemStockByLocation(new Map());
    setStep("entry");
    setFormError("");
    setReviewError("");
    setSaving(false);
    setQueuePage(1);
    let active = true;
    Promise.all([
      supabase
        .from("inventory_items")
        .select("id,sku,name,unit_of_measure,unit_cost,current_stock,is_active")
        .order("name", { ascending: true })
        .limit(1000),
      supabase
        .from("inventory_item_locations")
        .select("item_id,location,quantity")
        .limit(5000),
    ]).then(([itemsRes, locRes]) => {
      if (!active) return;

      if (!locRes.error) {
        const map = new Map();
        for (const row of locRes.data ?? []) {
          const itemId = row.item_id;
          const loc = String(row.location || "").trim();
          const qty = Number(row.quantity ?? 0);
          if (!itemId || !loc || !Number.isFinite(qty) || qty <= 0) continue;
          const key = `${itemId}::${loc}`;
          map.set(key, (map.get(key) ?? 0) + qty);
        }
        setItemStockByLocation(map);
        setHasLocationStockData(map.size > 0);

        const availableIds = new Set();
        for (const key of map.keys()) {
          const [itemId] = key.split("::");
          if (itemId) availableIds.add(itemId);
        }
        const items = (itemsRes.data ?? [])
          .filter((row) => row?.sku)
          .filter((row) => row.is_active !== false)
          .filter((row) => availableIds.has(String(row.id)) || Number(row.current_stock ?? 0) > 0);
        setSkuOptions(items);
        return;
      }

      const fallbackItems = (itemsRes.data ?? [])
        .filter((row) => row?.sku)
        .filter((row) => row.is_active !== false)
        .filter((row) => Number(row.current_stock ?? 0) > 0);
      setSkuOptions(fallbackItems);
    });
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    const sku = String(skuValue || "").trim().toLowerCase();
    const selected = skuOptions.find((opt) => String(opt.sku || "").trim().toLowerCase() === sku);
    if (!open || !selected?.id) {
      setSelectedItemStockByLocation(new Map());
      return;
    }
    let active = true;
    (async () => {
      const map = new Map();

      const direct = await supabase
        .from("inventory_item_locations")
        .select("location,quantity")
        .eq("item_id", selected.id)
        .limit(300);

      if (!direct.error) {
        for (const row of direct.data ?? []) {
          const loc = String(row.location || "").trim();
          const qty = Number(row.quantity ?? 0);
          if (!loc || !Number.isFinite(qty) || qty <= 0) continue;
          map.set(loc, (map.get(loc) ?? 0) + qty);
        }
      }

      // Fallback: derive per-location balance from movement history when location table is empty/stale.
      if (map.size === 0) {
        const moves = await supabase
          .from("stock_movements")
          .select("movement_type,quantity,from_location,to_location")
          .eq("item_id", selected.id)
          .order("created_at", { ascending: true })
          .limit(10000);
        if (!moves.error) {
          for (const move of moves.data ?? []) {
            const qty = Number(move.quantity ?? 0);
            if (!Number.isFinite(qty) || qty <= 0) continue;
            const type = String(move.movement_type || "").toLowerCase();
            const src = String(move.from_location || "").trim();
            const dst = String(move.to_location || "").trim();
            if (type === "in" && dst) map.set(dst, (map.get(dst) ?? 0) + qty);
            else if (type === "out" && src) map.set(src, (map.get(src) ?? 0) - qty);
            else if (type === "transfer") {
              if (src) map.set(src, (map.get(src) ?? 0) - qty);
              if (dst) map.set(dst, (map.get(dst) ?? 0) + qty);
            }
          }
        }
      }

      if (!active) return;
      const positiveOnly = new Map();
      for (const [loc, qty] of map.entries()) {
        const n = Number(qty ?? 0);
        if (Number.isFinite(n) && n > 0) positiveOnly.set(loc, n);
      }
      setSelectedItemStockByLocation(positiveOnly);
    })();
    return () => {
      active = false;
    };
  }, [open, skuOptions, skuValue]);

  const handleAttachmentSelect = async (file) => {
    if (!user?.id || !file) return;
    setAttachmentMsg("");
    try {
      const { path } = await uploadAttachment(user.id, file, "transfer-docs");
      setAttachmentPath(path);
      setAttachmentMsg(`Uploaded: ${path}`);
    } catch (e) {
      setAttachmentPath("");
      setAttachmentMsg(getErrorMessage(e));
    }
  };

  const availableSkuOptions = useMemo(() => {
    if (!hasLocationStockData) return skuOptions;

    // Keep SKU visible as long as at least one source location still has
    // remaining stock after considering queued lines for that same location.
    return skuOptions.filter((item) => {
      const locationEntries = [...itemStockByLocation.entries()].filter(([key]) => key.startsWith(`${item.id}::`));
      for (const [key, stockQty] of locationEntries) {
        const [, loc] = key.split("::");
        const queuedQty = queue
          .filter((row) => row.itemId === item.id && row.fromLocation === loc)
          .reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
        if (Math.max(0, Number(stockQty ?? 0) - queuedQty) > 0) return true;
      }
      return false;
    });
  }, [fromLocation, hasLocationStockData, itemStockByLocation, queue, skuOptions]);

  useEffect(() => {
    if (!skuValue) return;
    const stillAvailable = availableSkuOptions.some((opt) => opt.sku?.toLowerCase() === skuValue.toLowerCase());
    if (!stillAvailable) {
      // Keep current value visible to avoid blank-looking select fields while dependent options update.
      return;
    }
  }, [availableSkuOptions, skuValue]);

  const remainingQtyForSelected = useMemo(() => {
    const sku = String(skuValue || "").trim().toLowerCase();
    const selected = availableSkuOptions.find((opt) => String(opt.sku || "").toLowerCase() === sku);
    if (!selected?.id || !fromLocation || !hasLocationStockData) return null;
    const availableQty =
      selectedItemStockByLocation.size > 0
        ? Number(selectedItemStockByLocation.get(fromLocation) ?? 0)
        : Number(itemStockByLocation.get(`${selected.id}::${fromLocation}`) ?? 0);
    const queuedQty = queue
      .filter((row) => row.itemId === selected.id && row.fromLocation === fromLocation)
      .reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
    return Math.max(0, availableQty - queuedQty);
  }, [availableSkuOptions, fromLocation, hasLocationStockData, itemStockByLocation, queue, selectedItemStockByLocation, skuValue]);

  const fromLocationOptions = useMemo(() => {
    const sku = String(skuValue || "").trim().toLowerCase();
    const selected = skuOptions.find((opt) => String(opt.sku || "").trim().toLowerCase() === sku);
    if (!selected?.id) {
      return [];
    }
    if (selectedItemStockByLocation.size > 0) {
      return [...selectedItemStockByLocation.entries()]
        .map(([location, qty]) => ({ location, available: Number(qty || 0) }))
        .filter((row) => row.available > 0)
        .sort((a, b) => a.location.localeCompare(b.location));
    }
    if (!hasLocationStockData) {
      return [];
    }
    const options = [];
    for (const loc of locations) {
      const key = `${selected.id}::${loc}`;
      const availableQty = Number(itemStockByLocation.get(key) ?? 0);
      const queuedQty = queue
        .filter((row) => row.itemId === selected.id && row.fromLocation === loc)
        .reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
      const remaining = Math.max(0, availableQty - queuedQty);
      if (remaining > 0) {
        options.push({ location: loc, available: remaining });
      }
    }
    return options;
  }, [availableSkuOptions, hasLocationStockData, itemStockByLocation, locations, queue, selectedItemStockByLocation, skuValue]);

  const handleAddItem = () => {
    setFormError("");
    const sku = skuValue.trim();
    const qty = Number(quantity);
    const unitValue = String(unit || "").trim();
    const matched = availableSkuOptions.find((opt) => opt.sku?.toLowerCase() === sku.toLowerCase());
    if (!sku) {
      setFormError("SKU is required.");
      return;
    }
    if (!matched?.id) {
      setFormError("Use an existing SKU from inventory.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError("Enter a quantity greater than 0.");
      return;
    }
    if (!unitValue) {
      setFormError("Unit is required.");
      return;
    }
    if (!fromLocation || !toLocation) {
      setFormError("Select both from and to locations.");
      return;
    }
    if (!transferDate) {
      setFormError("Transfer Date is required.");
      return;
    }
    if (operationType === "transfer" && !transferBy.trim()) {
      setFormError("Transfer By is required.");
      return;
    }
    if (!requestedBy.trim() || requestedBy === "—") {
      setFormError("Requested By is required.");
      return;
    }
    if (operationType === "transfer" && !referenceNo.trim()) {
      setFormError("Reference No. is required.");
      return;
    }
    if (fromLocation === toLocation) {
      setFormError("From and to locations must be different.");
      return;
    }
    if (hasLocationStockData) {
      const key = `${matched.id}::${fromLocation}`;
      const availableQty = Number(itemStockByLocation.get(key) ?? 0);
      const queuedQty = queue
        .filter((row) => row.itemId === matched.id && row.fromLocation === fromLocation)
        .reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
      const remainingQty = Math.max(0, availableQty - queuedQty);
      if (remainingQty <= 0) {
        setFormError(`No available stock left for ${matched.sku} in "${fromLocation}".`);
        return;
      }
      if (qty > remainingQty) {
        setFormError(`Quantity exceeds available stock. Remaining in "${fromLocation}": ${remainingQty}.`);
        return;
      }
    }
    setQueue((q) => {
      const next = [
        ...q,
        {
          id: crypto.randomUUID(),
          itemId: matched.id,
          sku,
          itemName: itemName.trim() || matched.name || sku,
          quantity: qty,
          unit: unitValue,
          unitCost: Number(matched.unit_cost ?? 0),
          transferDate: transferDate || "",
          fromLocation,
          toLocation,
          transferBy: transferBy.trim(),
          requestedBy,
          referenceNo: referenceNo.trim(),
          attachmentPath: attachmentPath || "",
        },
      ];
      setQueuePage(Math.max(1, Math.ceil(next.length / MANUAL_PAGE_SIZE)));
      return next;
    });
    setSkuValue("");
    setItemName("");
    setItemNameLocked(false);
    setQuantity("");
    setUnitCost(0);
    setReferenceNo(generateTransferReference());
  };

  const handleManualEntryKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleAddItem();
  };

  const handleProceedToReview = () => {
    setFormError("");
    setReviewError("");
    if (queue.length === 0) {
      setFormError("Add at least one line before reviewing.");
      return;
    }
    setStep("review");
  };

  const removeQueueLine = (id) => {
    setQueue((q) => q.filter((row) => row.id !== id));
  };

  const queueTotalQty = queue.reduce((acc, row) => acc + row.quantity, 0);
  const queueTotalValue = queue.reduce((acc, row) => acc + Number(row.quantity ?? 0) * Number(row.unitCost ?? 0), 0);
  const queuePageCount = Math.max(1, Math.ceil(queue.length / MANUAL_PAGE_SIZE));
  const pagedQueue = useMemo(() => {
    const start = (queuePage - 1) * MANUAL_PAGE_SIZE;
    return queue.slice(start, start + MANUAL_PAGE_SIZE);
  }, [queue, queuePage]);

  useEffect(() => {
    setQueuePage((prev) => Math.min(prev, queuePageCount));
  }, [queuePageCount]);

  const queueBadgeLabel =
    queue.length === 0 ? "0 items" : queue.length === 1 ? "1 item" : `${queue.length} items`;

  const handleReviewDone = async (submitIntent = "submit") => {
    if (!onReviewDone) {
      onClose();
      return;
    }
    if (queue.length === 0) {
      setFormError("Add at least one line before submitting.");
      return;
    }
    setFormError("");
    setReviewError("");
    setSaving(true);
    try {
      await onReviewDone({ lineCount: queue.length, unitCount: queueTotalQty, queue, submitIntent });
      onClose();
    } catch (e) {
      const message = getErrorMessage(e);
      setReviewError(message);
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!open && !inline) return null;

  return (
    <div
      className={inline ? "w-full" : "fixed inset-0 z-[90] flex items-center justify-center p-4 lg:p-6"}
      role="dialog"
      aria-modal={inline ? undefined : "true"}
      aria-labelledby="transfer-manual-title"
      onClick={inline ? undefined : (e) => e.target === e.currentTarget && onClose()}
    >
      {!inline ? <div className="absolute inset-0 bg-on-background/20 backdrop-blur-sm" aria-hidden /> : null}
      <div
        className={inline ? "relative w-full overflow-hidden flex flex-col md:flex-row max-h-[calc(100dvh-10rem)]" : "relative w-full max-w-5xl bg-surface-container-lowest rounded-[2rem] shadow-[0_24px_64px_-12px_rgba(23,28,31,0.12)] overflow-hidden flex flex-col md:flex-row max-h-[min(780px,88vh)] my-auto"}
        onClick={inline ? undefined : (e) => e.stopPropagation()}
      >
        {step === "review" ? (
          <div className="flex-1 flex flex-col min-h-0 p-8 lg:p-12 overflow-y-auto">
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setStep("entry")}
                className="text-sm font-bold text-primary flex items-center gap-1 mb-4 hover:opacity-80"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Back to entry
              </button>
              <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">Transfer Inventory</span>
              <h2 id="transfer-manual-title" className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">
                Review transfer
              </h2>
              <p className="text-sm text-on-surface-variant mt-2">
                {queue.length} line{queue.length === 1 ? "" : "s"} · {queueTotalQty} unit{queueTotalQty === 1 ? "" : "s"} total
              </p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 overflow-hidden min-h-0">
              <div className="overflow-x-auto max-h-[min(360px,50vh)] overflow-y-auto">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead className="sticky top-0 bg-surface-container-high/90 backdrop-blur-sm z-[1]">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-on-surface-variant">SKU</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-on-surface-variant">Item</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-on-surface-variant">Qty</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-on-surface-variant">Unit</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-on-surface-variant">From</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-on-surface-variant">To</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase text-on-surface-variant">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {queue.map((row) => (
                      <tr key={row.id} className="bg-surface-container-lowest">
                        <td className="px-4 py-3 font-medium text-on-surface whitespace-nowrap">{row.sku}</td>
                        <td className="px-4 py-3 text-on-surface-variant max-w-[200px] truncate" title={row.itemName}>
                          {row.itemName}
                        </td>
                        <td className="px-4 py-3 font-semibold text-on-surface">{row.quantity}</td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs whitespace-nowrap">{row.unit}</td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs max-w-[140px] truncate" title={row.fromLocation}>
                          {row.fromLocation}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs max-w-[140px] truncate" title={row.toLocation}>
                          {row.toLocation}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs whitespace-nowrap">{row.transferDate || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3 justify-end">
              {reviewError ? <p className="w-full text-sm text-red-600 dark:text-red-400 font-medium">{reviewError}</p> : null}
              <button
                type="button"
                onClick={() => setStep("entry")}
                disabled={saving}
                className="px-8 py-3.5 rounded-full font-bold text-sm bg-secondary-container text-on-secondary-container hover:brightness-95 transition-all"
              >
                Edit queue
              </button>
              <button
                type="button"
                onClick={() => void handleReviewDone("draft")}
                disabled={saving}
                className="px-8 py-3.5 rounded-full font-bold text-sm bg-surface-container-high text-on-surface shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? "Saving..." : "Save as Draft"}
              </button>
              <button
                type="button"
                onClick={() => void handleReviewDone("submit")}
                disabled={saving}
                className="px-10 py-3.5 rounded-full font-bold text-sm bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? "Saving..." : (operationType === "request" ? "Submit Request" : "Submit for Approval")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-2 overflow-hidden min-h-0 flex flex-col">
            {formError ? <p className="mb-2 text-sm text-red-600 dark:text-red-400 font-medium">{formError}</p> : null}
            <div className="mt-1 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.05)] flex-1 min-h-0 flex flex-col">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary/60">Manual Input Preview Table</h3>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{queue.length} items</span>
              </div>
              <div className="mb-1.5 grid grid-cols-1 gap-1 md:grid-cols-4">
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                  <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">From Location</label>
                  <RenderSafeSelect
                    value={fromLocation}
                    onChange={(next) => {
                      setFromLocation(next);
                      setFormError("");
                    }}
                    placeholder={skuValue ? "Select source location..." : "Select SKU first..."}
                    options={fromLocationOptions.map((entry) => ({
                      value: entry.location,
                      label: `${entry.location} - ${entry.available}`,
                    }))}
                    inputClassName="h-5 rounded-md border border-slate-200 bg-white px-1.5 text-[10px] text-slate-900"
                  />
                </div>
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                  <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">To Location</label>
                  <RenderSafeSelect
                    value={toLocation}
                    onChange={(next) => {
                      setToLocation(next);
                      setFormError("");
                    }}
                    placeholder="Select location..."
                    options={locations.map((loc) => ({ value: loc, label: loc }))}
                    inputClassName="h-5 rounded-md border border-slate-200 bg-white px-1.5 text-[10px] text-slate-900"
                  />
                </div>
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                  <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Transfer Date</label>
                  <input value={transferDate} onChange={(e) => setTransferDate(e.target.value)} type="date" className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                </div>
                <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                  {operationType === "request" ? (
                    <>
                      <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Requested By</label>
                      <input value={requestedBy} readOnly className="h-5 w-full rounded-md border-none bg-slate-100 px-1.5 text-[10px] text-slate-500 cursor-not-allowed" />
                    </>
                  ) : (
                    <>
                      <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Transfer By</label>
                      <input value={transferBy} onChange={(e) => setTransferBy(e.target.value)} className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-slate-200">
                <div className="h-full min-h-[260px] overflow-x-auto overflow-y-hidden">
                  <table className={`w-full ${operationType === "transfer" ? "min-w-[920px]" : "min-w-[600px]"} table-fixed text-left text-[10px]`}>
                    <thead className="sticky top-0 z-10 bg-slate-100">
                      <tr>
                        <th className={`${operationType === "transfer" ? "w-[20%]" : "w-[35%]"} px-2 py-1.5 text-[9px] uppercase text-on-surface-variant`}>SKU-Code</th>
                        <th className={`${operationType === "transfer" ? "w-[24%]" : "w-[40%]"} px-2 py-1.5 text-[9px] uppercase text-on-surface-variant`}>Item Name</th>
                        <th className={`${operationType === "transfer" ? "w-[12%]" : "w-[15%]"} px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center`}>Quantity</th>
                        {operationType === "transfer" ? (
                          <>
                            <th className="w-[16%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Unit Cost</th>
                            <th className="w-[18%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Transfer Value</th>
                          </>
                        ) : null}
                        <th className="w-[10%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 bg-white">
                      {pagedQueue.map((row) => (
                        <tr key={row.id}>
                          <td className="truncate px-2 py-1 font-medium">{row.sku}</td>
                          <td className="truncate px-2 py-1">{row.itemName}</td>
                          <td className="px-2 py-1 text-center font-semibold">{row.quantity}</td>
                          {operationType === "transfer" ? (
                            <>
                              <td className="px-2 py-1">{formatMoney(row.unitCost)}</td>
                              <td className="px-2 py-1 font-semibold">{formatMoney(Number(row.quantity ?? 0) * Number(row.unitCost ?? 0))}</td>
                            </>
                          ) : null}
                          <td className="px-2 py-1 text-center">
                            <button type="button" onClick={() => removeQueueLine(row.id)} className="rounded-full p-0.5 hover:bg-slate-100" aria-label={`Remove ${row.sku}`}>
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50/70">
                        <td className="px-1.5 py-1">
                          <RenderSafeSelect
                            value={skuValue}
                            onChange={applySkuSelection}
                            placeholder="Select SKU..."
                            options={availableSkuOptions.map((item) => ({ value: item.sku, label: item.sku }))}
                            inputClassName="h-6 rounded-md border border-slate-200 bg-white px-1.5 text-[10px] text-slate-900"
                          />
                        </td>
                        <td className="px-1.5 py-1">
                          <input value={itemName} onChange={(e) => setItemName(e.target.value)} onKeyDown={handleManualEntryKeyDown} readOnly={itemNameLocked} className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                        </td>
                        <td className="px-1.5 py-1">
                          <input
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            onKeyDown={handleManualEntryKeyDown}
                            type="number"
                            min="1"
                            max={remainingQtyForSelected != null ? remainingQtyForSelected : undefined}
                            className="h-6 w-full rounded-md border-none bg-white px-1.5 text-center text-[10px]"
                          />
                        </td>
                        {operationType === "transfer" ? (
                          <>
                            <td className="px-1.5 py-1">
                              <input
                                value={unitCost > 0 ? formatMoney(unitCost) : ""}
                                readOnly
                                onKeyDown={handleManualEntryKeyDown}
                                className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px] text-slate-800"
                                placeholder="Auto"
                              />
                            </td>
                            <td className="px-1.5 py-1">
                              <input
                                value={formatMoney(Number(quantity || 0) * Number(unitCost || 0))}
                                readOnly
                                onKeyDown={handleManualEntryKeyDown}
                                className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px] text-slate-800"
                              />
                            </td>
                          </>
                        ) : null}
                        <td className="px-1.5 py-1">
                          <span className="text-[9px] font-semibold text-primary/80">Enter</span>
                        </td>
                      </tr>
                      {Array.from({ length: Math.max(0, MANUAL_PAGE_SIZE - pagedQueue.length - 1) }).map((_, idx) => (
                        <tr key={`transfer-empty-row-${idx}`} className="bg-white">
                          <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>
                          {operationType === "transfer" ? (
                            <>
                              <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                              <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                            </>
                          ) : null}
                          <td className="px-2 py-1"></td>
                        </tr>
                      ))}
                    </tbody>
                    {queue.length > 0 ? (
                      <tfoot>
                        <tr className="sticky bottom-0 z-10 bg-slate-700 text-white">
                          <td className="px-2 py-1.5 text-[10px] font-semibold" colSpan={2}>Totals</td>
                          <td className="px-2 py-1.5 text-center font-semibold">{queueTotalQty}</td>
                          {operationType === "transfer" ? (
                            <>
                              <td className="px-2 py-1.5"></td>
                              <td className="px-2 py-1.5 font-semibold">{formatMoney(queueTotalValue)}</td>
                            </>
                          ) : null}
                          <td className="px-2 py-1.5 text-right">
                            <button type="button" onClick={() => setQueue([])} className="rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-white/25">Clear</button>
                          </td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-on-surface-variant">Total Quantity: <span className="font-semibold text-on-surface">{queueTotalQty} units</span></span>
                  {operationType === "transfer" ? (
                    <span className="text-[10px] text-on-surface-variant">Total Value: <span className="font-semibold text-on-surface">{formatMoney(queueTotalValue)}</span></span>
                  ) : null}
                  {queue.length > MANUAL_PAGE_SIZE ? (
                    <div className="flex items-center gap-1 text-[9px]">
                      <button type="button" onClick={() => setQueuePage((p) => Math.max(1, p - 1))} disabled={queuePage <= 1} className="h-5 rounded-md bg-slate-100 px-1.5 font-semibold text-slate-700 disabled:opacity-40">Prev</button>
                      <span className="text-on-surface-variant">Page {queuePage} of {queuePageCount}</span>
                      <button type="button" onClick={() => setQueuePage((p) => Math.min(queuePageCount, p + 1))} disabled={queuePage >= queuePageCount} className="h-5 rounded-md bg-slate-100 px-1.5 font-semibold text-slate-700 disabled:opacity-40">Next</button>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Attachment</label>
                  <input className="h-5 rounded-md border-none bg-slate-100 px-1.5 text-[9px]" type="file" accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAttachmentSelect(f); e.target.value = ""; }} />
                  <button
                    type="button"
                    onClick={() => handleReviewDone("submit")}
                    disabled={queue.length === 0 || saving}
                    className="h-6 rounded-full bg-primary px-2.5 text-[9px] font-bold text-white disabled:opacity-45"
                  >
                    {saving ? "Submitting..." : `Submit for Approval (${queue.length})`}
                  </button>
                </div>
              </div>
              {attachmentMsg ? <p className="mt-1 text-[10px] text-on-surface-variant">{attachmentMsg}</p> : null}
            </div>
          </div>
        )}
        {!inline ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 h-10 w-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors z-10"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TransferBatchModal({ open, onClose, onReviewDone, inline = false, compact = false }) {
  const dense = inline || compact;
  useModalA11y(open && !inline, onClose);
  const { user, profile } = useAuth();
  const locations = useDistinctLocations(open);
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [transferBy, setTransferBy] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [attachmentPath, setAttachmentPath] = useState("");
  const [attachMsg, setAttachMsg] = useState("");
  const [rows, setRows] = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [fileMsg, setFileMsg] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inventoryBySku, setInventoryBySku] = useState(new Map());

  const requestedBy = buildRequestedByLabel(profile, user);

  useEffect(() => {
    if (!open) return;
    setFromLocation("");
    setToLocation("");
    setTransferDate("");
    setTransferBy("");
    setReferenceNo(generateTransferReference());
    setAttachmentPath("");
    setAttachMsg("");
    setRows([]);
    setRowErrors([]);
    setFileMsg("");
    setFormError("");
    setBusy(false);
    void supabase
      .from("inventory_items")
      .select("id,sku,name,unit_of_measure,is_active")
      .neq("is_active", false)
      .limit(3000)
      .then(({ data }) => {
        const map = new Map();
        for (const row of data ?? []) {
          const sku = String(row.sku || "").trim().toLowerCase();
          if (sku) map.set(sku, row);
        }
        setInventoryBySku(map);
      });
  }, [open]);

  const validateRows = (sourceRows) => {
    const normalizedRows = [];
    const errors = [];
    sourceRows.forEach((source, idx) => {
      const sku = String(valueFromRow(source, ["sku", "sku code", "sku_code"])).trim();
      const itemName = String(valueFromRow(source, ["item name", "item", "name"])).trim();
      const quantityRaw = valueFromRow(source, ["quantity transferred", "quantity", "qty"]);
      const quantity = Number(quantityRaw);
      const rowIssues = [];
      if (!sku) rowIssues.push("SKU is required.");
      if (!itemName) rowIssues.push("Item Name is required.");
      if (!Number.isFinite(quantity) || quantity <= 0) rowIssues.push("Quantity Transferred must be > 0.");
      const matched = inventoryBySku.get(sku.toLowerCase());
      if (!matched?.id) rowIssues.push("SKU not found in inventory items.");
      normalizedRows.push({
        id: crypto.randomUUID(),
        sourceIndex: idx + 2,
        sku,
        itemName,
        quantity,
        matched,
      });
      if (rowIssues.length > 0) errors.push(`Row ${idx + 2}: ${rowIssues.join(" ")}`);
    });
    return { normalizedRows, errors };
  };

  const handleFileUpload = async (file) => {
    setFileMsg("");
    setFormError("");
    if (!file) return;
    setBusy(true);
    try {
      const parsedRows = await parseBatchFile(file);
      const { normalizedRows, errors } = validateRows(parsedRows);
      setRows(normalizedRows);
      setRowErrors(errors);
      setFileMsg(`Loaded ${normalizedRows.length} row(s).`);
    } catch (e) {
      setRows([]);
      setRowErrors([]);
      setFileMsg(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAttachmentUpload = async (file) => {
    if (!user?.id || !file) return;
    setAttachMsg("");
    setBusy(true);
    try {
      const { path } = await uploadAttachment(user.id, file, "transfer-docs");
      setAttachmentPath(path);
      setAttachMsg(`Uploaded: ${path}`);
    } catch (e) {
      setAttachmentPath("");
      setAttachMsg(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (submitIntent = "submit") => {
    setFormError("");
    if (!fromLocation) return setFormError("From Location is required.");
    if (!toLocation) return setFormError("To Location is required.");
    if (fromLocation === toLocation) return setFormError("From and To locations must be different.");
    if (!transferDate) return setFormError("Transfer Date is required.");
    if (!transferBy.trim()) return setFormError("Transfer By is required.");
    if (!requestedBy.trim() || requestedBy === "—") return setFormError("Requested By is required.");
    if (!referenceNo.trim()) return setFormError("Reference No. is required.");
    if (rows.length === 0) return setFormError("Upload a CSV or Excel file first.");
    if (rowErrors.length > 0) return setFormError("Fix row validation errors before confirming.");
    const queue = rows.map((row) => ({
      id: row.id,
      itemId: row.matched.id,
      sku: row.sku,
      itemName: row.itemName || row.matched.name || row.sku,
      quantity: row.quantity,
      unit: String(row.matched.unit_of_measure || "unit").trim() || "unit",
      transferDate,
      transferBy: transferBy.trim(),
      fromLocation,
      toLocation,
      attachmentPath: attachmentPath || "",
      requestedBy,
      referenceNo: `${referenceNo.trim()}-${row.sourceIndex}`,
    }));
    setBusy(true);
    try {
      const totalUnits = queue.reduce((acc, row) => acc + Number(row.quantity || 0), 0);
      await onReviewDone?.({ lineCount: queue.length, unitCount: totalUnits, queue, submitIntent });
      onClose();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open && !inline) return null;

  return (
    <div className={inline ? "w-full" : "fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto py-8 px-4 md:px-8 bg-on-surface/40 backdrop-blur-md"} role="dialog" aria-modal={inline ? undefined : "true"} aria-labelledby="transfer-batch-title" onClick={inline ? undefined : (e) => e.target === e.currentTarget && onClose()}>
      <div className={inline ? "w-full overflow-hidden max-h-[calc(100dvh-10rem)]" : "w-full max-w-5xl bg-surface-container-lowest rounded-3xl overflow-hidden"} onClick={inline ? undefined : (e) => e.stopPropagation()}>
        <div className={`${dense ? "px-2 py-2" : "px-5 py-4"} flex items-center justify-between border-b border-outline-variant/10 gap-4`}>
          <h1 id="transfer-batch-title" className={`${dense ? "text-base" : "text-2xl"} font-extrabold tracking-tight text-on-surface font-headline`}>
            Batch Upload Transfer
          </h1>
          {!inline ? (
            <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high" aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          ) : null}
        </div>
        <div className={`${dense ? "px-2 py-2" : "px-5 py-5"} overflow-y-auto min-h-0`}>
          <div className="space-y-2">
            {formError ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
            <div className="rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">File Upload (CSV/Excel)</label>
              <input
                className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 py-1 text-sm focus:ring-2 focus:ring-primary/20"
                type="file"
                accept=".csv,.xlsx,.xls"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileUpload(f);
                  e.target.value = "";
                }}
              />
              {fileMsg ? <p className="text-xs text-on-surface-variant">{fileMsg}</p> : null}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
              <section className="rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Transfer Routing</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">From Location</label>
                  <RenderSafeSelect
                    value={fromLocation}
                    onChange={setFromLocation}
                    placeholder="Select..."
                    options={locations.map((loc) => ({ value: loc, label: loc }))}
                    inputClassName="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">To Location</label>
                  <RenderSafeSelect
                    value={toLocation}
                    onChange={setToLocation}
                    placeholder="Select..."
                    options={locations.map((loc) => ({ value: loc, label: loc }))}
                    inputClassName="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900"
                  />
                </div>
              </section>
              <section className="rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Transfer Details</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Transfer Date</label>
                  <input value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 text-sm" type="date" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Transfer By</label>
                  <input value={transferBy} onChange={(e) => setTransferBy(e.target.value)} className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 text-sm" type="text" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Requested By</label>
                  <input value={requestedBy} readOnly className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 text-sm text-on-surface-variant" type="text" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Reference No.</label>
                  <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 text-sm" type="text" />
                </div>
              </section>
              <section className="rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Documents</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Attachment (Optional)</label>
                  <input
                    className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 py-1 text-sm"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleAttachmentUpload(f);
                      e.target.value = "";
                    }}
                  />
                  {attachMsg ? <p className="text-xs text-on-surface-variant">{attachMsg}</p> : null}
                </div>
              </section>
            </div>

            <div className="mt-2 rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-2">
              <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Transfer Preview</h3>
              <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-bold">
                {rows.length} rows
              </span>
            </div>
            <div className="overflow-auto bg-surface-container-low/30 rounded-2xl min-h-[220px]">
              <table className="w-full text-left min-w-[620px]">
                <thead className="sticky top-0 bg-surface-container-highest/80">
                  <tr>
                    <th className="p-3 text-[10px] font-bold uppercase text-on-surface-variant">SKU</th>
                    <th className="p-3 text-[10px] font-bold uppercase text-on-surface-variant">Item Name</th>
                    <th className="p-3 text-[10px] font-bold uppercase text-on-surface-variant">Quantity</th>
                    <th className="p-3 text-[10px] font-bold uppercase text-on-surface-variant">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-sm text-on-surface-variant text-center">
                        Upload a file to preview rows.
                      </td>
                    </tr>
                  ) : (
                    rows.slice(0, 50).map((row) => (
                      <tr key={row.id} className="border-t border-outline-variant/10">
                        <td className="p-3">{row.sku}</td>
                        <td className="p-3">{row.itemName}</td>
                        <td className="p-3">{row.quantity}</td>
                        <td className="p-3">{row.matched?.id ? "OK" : "Unknown SKU"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {rowErrors.length > 0 ? (
              <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 space-y-1 max-h-36 overflow-y-auto">
                {rowErrors.map((err) => (
                  <p key={err}>{err}</p>
                ))}
              </div>
            ) : null}
            <div className="pt-1 flex justify-end">
              <button type="button" disabled={busy || rows.length === 0} onClick={() => void handleConfirm("draft")} className="h-8 px-5 rounded-full bg-surface-container-high text-on-surface font-bold text-sm disabled:opacity-50">
                {busy ? "Processing..." : "Save as Draft"}
              </button>
              <button type="button" disabled={busy || rows.length === 0} onClick={() => void handleConfirm("submit")} className="h-8 px-5 rounded-full bg-primary text-white font-bold text-sm disabled:opacity-50">
                {busy ? "Processing..." : "Submit for Approval"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
