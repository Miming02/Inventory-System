import { useEffect, useMemo, useState } from "react";
import { useDistinctLocations } from "../../lib/useDistinctLocations";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { uploadAttachment } from "../../lib/storageUpload";
import { SkuAutocompleteInput } from "../../components/SkuAutocompleteInput";

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

export function DeliverScanModal({ open, onClose, onReviewDone, inline = false, compact = false }) {
  const dense = inline || compact;
  useModalA11y(open && !inline, onClose);
  const { user } = useAuth();
  const locations = useDistinctLocations(open);
  const [inventoryOptions, setInventoryOptions] = useState([]);
  const [step, setStep] = useState("entry");
  const [skuValue, setSkuValue] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [shipFrom, setShipFrom] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveredBy, setDeliveredBy] = useState("");
  const [attachmentPath, setAttachmentPath] = useState("");
  const [attachmentMsg, setAttachmentMsg] = useState("");
  const [queue, setQueue] = useState([]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("entry");
    setSkuValue("");
    setSelectedItem(null);
    setQuantity("1");
    setCustomerName("");
    setReferenceNo("");
    setShipFrom("");
    setShipTo("");
    setDeliveryDate("");
    setDeliveredBy("");
    setAttachmentPath("");
    setAttachmentMsg("");
    setQueue([]);
    setFormError("");
    setSaving(false);
    void supabase
      .from("inventory_items")
      .select("id,sku,name,unit_of_measure,current_stock,is_active")
      .neq("is_active", false)
      .order("name", { ascending: true })
      .limit(3000)
      .then(({ data }) => {
        setInventoryOptions((data ?? []).filter((row) => Number(row.current_stock ?? 0) > 0));
      });
  }, [open]);

  const queueTotalQty = queue.reduce((acc, row) => acc + Number(row.quantity || 0), 0);

  const handleAttachmentSelect = async (file) => {
    if (!user?.id || !file) return;
    setAttachmentMsg("");
    try {
      const { path } = await uploadAttachment(user.id, file, "delivery-docs");
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
    if (!Number.isFinite(qty) || qty <= 0) return setFormError("Quantity Delivered must be greater than 0.");
    if (!customerName.trim()) return setFormError("Customer Name is required.");
    if (!referenceNo.trim()) return setFormError("Reference No. is required.");
    if (!deliveryDate) return setFormError("Delivery Date is required.");
    setQueue((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        itemId: matched.id,
        sku: matched.sku,
        itemName: matched.name || matched.sku,
        quantity: qty,
        unit: String(matched.unit_of_measure || "unit").trim() || "unit",
        customerName: customerName.trim(),
        referenceNo: referenceNo.trim(),
        shipFrom,
        shipTo,
        deliveryDate,
        deliveredBy: deliveredBy.trim(),
        attachmentPath: attachmentPath || "",
      },
    ]);
    setSkuValue("");
    setSelectedItem(null);
    setQuantity("1");
  };

  const handleFinalize = async (submitForApproval) => {
    if (queue.length === 0) return setFormError("Add at least one item before finalizing.");
    setSaving(true);
    try {
      await onReviewDone?.({ lineCount: queue.length, unitCount: queueTotalQty, queue, submitForApproval });
      onClose();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open && !inline) return null;

  return (
    <div className={inline ? "w-full" : "fixed inset-0 z-[90] flex items-center justify-center p-4 bg-on-surface/10 backdrop-blur-sm"} role="dialog" aria-modal={inline ? undefined : "true"} aria-labelledby="deliver-scan-title" onClick={inline ? undefined : (e) => e.target === e.currentTarget && onClose()}>
      <div className={inline ? "w-full overflow-hidden max-h-[calc(100dvh-10rem)]" : "bg-surface-container-lowest w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[min(860px,94vh)]"} onClick={inline ? undefined : (e) => e.stopPropagation()}>
        <div className={`${dense ? "px-2 py-2" : "px-5 py-4"} flex justify-between items-center bg-surface-bright gap-4 shrink-0`}>
          <h1 id="deliver-scan-title" className={`${dense ? "text-base" : "text-2xl"} font-extrabold tracking-tight text-on-surface font-headline`}>
            Scan SKU or Code
          </h1>
          {!inline ? (
            <button type="button" onClick={onClose} className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full transition-all active:scale-95 shrink-0" aria-label="Close">
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
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">Customer</th>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {queue.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3 font-medium">{row.sku}</td>
                      <td className="px-3 py-3">{row.itemName}</td>
                      <td className="px-3 py-3">{row.quantity}</td>
                      <td className="px-3 py-3">{row.customerName}</td>
                      <td className="px-3 py-3">{row.shipTo}</td>
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
              <button type="button" disabled={saving} onClick={() => handleFinalize(false)} className="px-7 py-3 rounded-full font-bold text-sm bg-secondary-container text-on-secondary-container disabled:opacity-50">
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button type="button" disabled={saving} onClick={() => handleFinalize(true)} className="px-9 py-3 rounded-full font-bold text-sm bg-gradient-to-r from-primary to-primary-container text-on-primary disabled:opacity-50">
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
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Delivery Setup</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Quantity Delivered</label>
                  <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20" min={1} type="number" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Customer Name</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20" type="text" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Reference No.</label>
                  <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20" type="text" />
                </div>
              </section>

              <section className="rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Routing & Date</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Ship-From Location (Optional)</label>
                  <select value={shipFrom} onChange={(e) => setShipFrom(e.target.value)} className="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20 appearance-none">
                    <option value="">Select...</option>
                    {locations.map((loc) => (
                      <option key={`dscan-from-${loc}`} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Location/Delivery Address (Optional)</label>
                  <input value={shipTo} onChange={(e) => setShipTo(e.target.value)} className="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20" type="text" placeholder="Enter delivery address..." />
                </div>
              </section>

              <section className="rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Delivery Support</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Delivery Date</label>
                  <input value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20" type="date" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Delivered By (Optional)</label>
                  <input value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} className="w-full h-8 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20" type="text" />
                </div>
              </section>
            </div>

            <div className="mt-2 rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Attachment (Optional)</label>
              <input
                className="w-full h-8 rounded-lg px-2.5 py-1 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,image/jpeg,image/png,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
                Add to List
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

export function DeliverManualModal({ open, onClose, onReviewDone, inline = false, compact = false }) {
  const MANUAL_PAGE_SIZE = 22;
  const dense = inline || compact;
  useModalA11y(open && !inline, onClose);
  const { user } = useAuth();
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
  const [customerName, setCustomerName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [shipFrom, setShipFrom] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveredBy, setDeliveredBy] = useState("");
  const [queue, setQueue] = useState([]);
  const [step, setStep] = useState("entry");
  const [formError, setFormError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attachmentPath, setAttachmentPath] = useState("");
  const [attachmentMsg, setAttachmentMsg] = useState("");
  const [queuePage, setQueuePage] = useState(1);

  const applySkuSelection = (nextSku) => {
    const normalized = String(nextSku || "").trim();
    setSkuValue(normalized);
    const matched = availableSkuOptions.find((opt) => opt.sku?.toLowerCase() === normalized.toLowerCase());
    if (!matched) {
      setItemName("");
      setItemNameLocked(false);
      setUnit("");
      return;
    }
    setItemName(matched.name || "");
    setItemNameLocked(true);
    const uom = String(matched.unit_of_measure || "").trim();
    setUnit(uom);
  };

  useEffect(() => {
    if (!open) return;
    setSkuValue("");
    setItemName("");
    setItemNameLocked(false);
    setQuantity("");
    setUnit("");
    setCustomerName("");
    setReferenceNo("");
    setShipFrom("");
    setShipTo("");
    setDeliveryDate("");
    setDeliveredBy("");
    setQueue([]);
    setItemStockByLocation(new Map());
    setHasLocationStockData(false);
    setSelectedItemStockByLocation(new Map());
    setStep("entry");
    setFormError("");
    setReviewError("");
    setSaving(false);
    setAttachmentPath("");
    setAttachmentMsg("");
    setQueuePage(1);
    let active = true;
    Promise.all([
      supabase
        .from("inventory_items")
        .select("id,sku,name,current_stock,unit_of_measure,is_active,location")
        .order("name", { ascending: true })
        .limit(1000),
      supabase
        .from("inventory_item_locations")
        .select("item_id,location,quantity")
        .limit(5000),
    ]).then(async ([itemsRes, locRes]) => {
      if (!active) return;
      const itemsData = itemsRes.data ?? [];

      const buildMovementBalanceMap = async () => {
        const derived = new Map();
        const moveRes = await supabase
          .from("stock_movements")
          .select("item_id,movement_type,quantity,from_location,to_location")
          .order("created_at", { ascending: true })
          .limit(10000);
        if (moveRes.error) return derived;
        for (const move of moveRes.data ?? []) {
          const itemId = move.item_id;
          const qty = Number(move.quantity ?? 0);
          if (!itemId || !Number.isFinite(qty) || qty <= 0) continue;
          const type = String(move.movement_type || "").toLowerCase();
          const src = String(move.from_location || "").trim();
          const dst = String(move.to_location || "").trim();
          if (type === "in" && dst) {
            const key = `${itemId}::${dst}`;
            derived.set(key, (derived.get(key) ?? 0) + qty);
          } else if (type === "out" && src) {
            const key = `${itemId}::${src}`;
            derived.set(key, (derived.get(key) ?? 0) - qty);
          } else if (type === "transfer") {
            if (src) {
              const srcKey = `${itemId}::${src}`;
              derived.set(srcKey, (derived.get(srcKey) ?? 0) - qty);
            }
            if (dst) {
              const dstKey = `${itemId}::${dst}`;
              derived.set(dstKey, (derived.get(dstKey) ?? 0) + qty);
            }
          }
        }
        return derived;
      };

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
        // If location-balance rows are empty, derive from movement history first,
        // then fallback to legacy location/current_stock only if still empty.
        if (map.size === 0) {
          const derived = await buildMovementBalanceMap();
          for (const [key, value] of derived.entries()) {
            map.set(key, (map.get(key) ?? 0) + value);
          }
          if (map.size === 0) {
            for (const item of itemsData) {
              const loc = String(item?.location || "").trim();
              const stock = Number(item?.current_stock ?? 0);
              if (!item?.id || !loc || !Number.isFinite(stock) || stock <= 0) continue;
              const key = `${item.id}::${loc}`;
              map.set(key, (map.get(key) ?? 0) + stock);
            }
          }
        }

        const positiveOnlyMap = new Map();
        for (const [key, value] of map.entries()) {
          const qty = Number(value ?? 0);
          if (Number.isFinite(qty) && qty > 0) positiveOnlyMap.set(key, qty);
        }

        setItemStockByLocation(positiveOnlyMap);
        setHasLocationStockData(positiveOnlyMap.size > 0);

        const availableIds = new Set();
        for (const key of positiveOnlyMap.keys()) {
          const [itemId] = key.split("::");
          if (itemId) availableIds.add(itemId);
        }
        const items = itemsData
          .filter((row) => row?.sku)
          .filter((row) => row.is_active !== false)
          .filter((row) => availableIds.has(String(row.id)));
        setSkuOptions(items);
        return;
      }

      // If per-location table is inaccessible, derive movement balances first,
      // then fallback to legacy item location/current_stock only if still empty.
      const fallbackMap = new Map();
      const derived = await buildMovementBalanceMap();
      for (const [key, value] of derived.entries()) {
        fallbackMap.set(key, (fallbackMap.get(key) ?? 0) + value);
      }
      if (fallbackMap.size === 0) {
        for (const item of itemsData) {
          const loc = String(item?.location || "").trim();
          const stock = Number(item?.current_stock ?? 0);
          if (!item?.id || !loc || !Number.isFinite(stock) || stock <= 0) continue;
          const key = `${item.id}::${loc}`;
          fallbackMap.set(key, (fallbackMap.get(key) ?? 0) + stock);
        }
      }

      const positiveFallbackMap = new Map();
      for (const [key, value] of fallbackMap.entries()) {
        const qty = Number(value ?? 0);
        if (Number.isFinite(qty) && qty > 0) positiveFallbackMap.set(key, qty);
      }
      setItemStockByLocation(positiveFallbackMap);
      setHasLocationStockData(positiveFallbackMap.size > 0);

      const fallbackAvailableIds = new Set();
      for (const key of positiveFallbackMap.keys()) {
        const [itemId] = key.split("::");
        if (itemId) fallbackAvailableIds.add(itemId);
      }
      const fallbackItems = (itemsRes.data ?? [])
        .filter((row) => row?.sku)
        .filter((row) => row.is_active !== false)
        .filter((row) =>
          positiveFallbackMap.size > 0
            ? fallbackAvailableIds.has(String(row.id))
            : Number(row.current_stock ?? 0) > 0
        );
      setSkuOptions(fallbackItems);
    });
    return () => {
      active = false;
    };
  }, [open]);

  const handleAttachmentSelect = async (file) => {
    if (!user?.id || !file) return;
    setAttachmentMsg("");
    try {
      const { path } = await uploadAttachment(user.id, file, "delivery-docs");
      setAttachmentPath(path);
      setAttachmentMsg(`Uploaded: ${path}`);
    } catch (e) {
      setAttachmentPath("");
      setAttachmentMsg(getErrorMessage(e));
    }
  };

  const availableSkuOptions = useMemo(() => {
    if (!shipFrom || !hasLocationStockData) return skuOptions;
    return skuOptions.filter((item) => {
      const key = `${item.id}::${shipFrom}`;
      return Number(itemStockByLocation.get(key) ?? 0) > 0;
    });
  }, [hasLocationStockData, itemStockByLocation, shipFrom, skuOptions]);

  useEffect(() => {
    if (!skuValue) return;
    const stillAvailable = availableSkuOptions.some((opt) => opt.sku?.toLowerCase() === skuValue.toLowerCase());
    if (!stillAvailable) {
      setSkuValue("");
      setItemName("");
      setItemNameLocked(false);
      setUnit("");
      setQuantity("");
    }
  }, [availableSkuOptions, skuValue]);

  const remainingQtyForSelected = useMemo(() => {
    const sku = String(skuValue || "").trim().toLowerCase();
    const selected = availableSkuOptions.find((opt) => String(opt.sku || "").toLowerCase() === sku);
    if (!selected?.id || !shipFrom || !hasLocationStockData) return null;
    const availableQty =
      selectedItemStockByLocation.size > 0
        ? Number(selectedItemStockByLocation.get(shipFrom) ?? 0)
        : Number(itemStockByLocation.get(`${selected.id}::${shipFrom}`) ?? 0);
    const queuedQty = queue
      .filter((row) => row.itemId === selected.id && row.shipFrom === shipFrom)
      .reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
    return Math.max(0, availableQty - queuedQty);
  }, [availableSkuOptions, hasLocationStockData, itemStockByLocation, queue, selectedItemStockByLocation, shipFrom, skuValue]);

  const shipFromOptions = useMemo(() => {
    if (selectedItemStockByLocation.size > 0) {
      return [...selectedItemStockByLocation.entries()]
        .filter(([, qty]) => Number(qty ?? 0) > 0)
        .map(([loc]) => loc)
        .sort((a, b) => a.localeCompare(b));
    }
    if (!hasLocationStockData) return locations;
    const sku = String(skuValue || "").trim().toLowerCase();
    const selected = availableSkuOptions.find((opt) => String(opt.sku || "").toLowerCase() === sku);
    if (!selected?.id) return locations;
    const options = [];
    for (const loc of locations) {
      const key = `${selected.id}::${loc}`;
      const availableQty = Number(itemStockByLocation.get(key) ?? 0);
      const queuedQty = queue
        .filter((row) => row.itemId === selected.id && row.shipFrom === loc)
        .reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
      if (availableQty - queuedQty > 0) options.push(loc);
    }
    return options;
  }, [availableSkuOptions, hasLocationStockData, itemStockByLocation, locations, queue, selectedItemStockByLocation, skuValue]);

  useEffect(() => {
    if (!shipFrom) return;
    if (shipFromOptions.includes(shipFrom)) return;
    setShipFrom("");
  }, [shipFrom, shipFromOptions]);

  useEffect(() => {
    const sku = String(skuValue || "").trim().toLowerCase();
    const selected = availableSkuOptions.find((opt) => String(opt.sku || "").toLowerCase() === sku);
    if (!selected?.id || !open) {
      setSelectedItemStockByLocation(new Map());
      return;
    }
    let active = true;
    (async () => {
      const direct = await supabase
        .from("inventory_item_locations")
        .select("location,quantity")
        .eq("item_id", selected.id)
        .limit(200);

      const map = new Map();
      if (!direct.error) {
        for (const row of direct.data ?? []) {
          const loc = String(row.location || "").trim();
          const qty = Number(row.quantity ?? 0);
          if (!loc || !Number.isFinite(qty) || qty <= 0) continue;
          map.set(loc, (map.get(loc) ?? 0) + qty);
        }
      }

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

      if (map.size === 0) {
        const legacy = await supabase
          .from("inventory_items")
          .select("location,current_stock")
          .eq("id", selected.id)
          .maybeSingle();
        const loc = String(legacy.data?.location || "").trim();
        const qty = Number(legacy.data?.current_stock ?? 0);
        if (!legacy.error && loc && Number.isFinite(qty) && qty > 0) {
          map.set(loc, qty);
        }
      }

      const positive = new Map();
      for (const [loc, qty] of map.entries()) {
        if (Number(qty ?? 0) > 0) positive.set(loc, Number(qty));
      }
      if (!active) return;
      setSelectedItemStockByLocation(positive);
    })();
    return () => {
      active = false;
    };
  }, [availableSkuOptions, open, skuValue]);

  const handleAddItem = () => {
    setFormError("");
    const sku = skuValue.trim();
    const qty = Number(quantity);
    const unitValue = String(unit || "").trim();
    const customer = customerName.trim();
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
    if (hasLocationStockData && shipFrom) {
      const availableQty =
        selectedItemStockByLocation.size > 0
          ? Number(selectedItemStockByLocation.get(shipFrom) ?? 0)
          : Number(itemStockByLocation.get(`${matched.id}::${shipFrom}`) ?? 0);
      const queuedQty = queue
        .filter((row) => row.itemId === matched.id && row.shipFrom === shipFrom)
        .reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
      const remainingQty = Math.max(0, availableQty - queuedQty);
      if (remainingQty <= 0) {
        setFormError(`No available stock left for ${matched.sku} in "${shipFrom}".`);
        return;
      }
      if (qty > remainingQty) {
        setFormError(`Quantity exceeds available stock. Remaining in "${shipFrom}": ${remainingQty}.`);
        return;
      }
    } else if (qty > Number(matched.current_stock ?? 0)) {
      setFormError("Quantity exceeds available stock for this SKU.");
      return;
    }
    if (!customer) {
      setFormError("Customer Name is required.");
      return;
    }
    if (!referenceNo.trim()) {
      setFormError("Reference No. is required.");
      return;
    }
    if (!deliveryDate) {
      setFormError("Delivery Date is required.");
      return;
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
          customerName: customer,
          referenceNo: referenceNo.trim(),
          shipFrom,
          shipTo,
          deliveryDate: deliveryDate || "",
          deliveredBy: deliveredBy.trim(),
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
  const batchTotalLabel =
    queueTotalQty === 0 ? "0 units" : queueTotalQty === 1 ? "1 unit" : `${queueTotalQty} units`;

  const handleReviewDone = async (submitForApproval) => {
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
      await onReviewDone({ lineCount: queue.length, unitCount: queueTotalQty, queue, submitForApproval });
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
      className={inline ? "w-full" : "fixed inset-0 z-[90] flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm"}
      role="dialog"
      aria-modal={inline ? undefined : "true"}
      aria-labelledby="deliver-manual-title"
      onClick={inline ? undefined : (e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={inline ? "w-full overflow-hidden max-h-[calc(100dvh-10rem)] flex flex-col md:flex-row" : "relative bg-surface-container-lowest w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[min(860px,94vh)] my-2"}
        onClick={inline ? undefined : (e) => e.stopPropagation()}
      >
        {step === "review" ? (
          <div className="flex-1 flex flex-col min-h-0 p-10 overflow-y-auto w-full">
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setStep("entry")}
                className="text-sm font-bold text-primary flex items-center gap-1 mb-4 hover:opacity-80"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Back to entry
              </button>
              <h2 id="deliver-manual-title" className="text-2xl font-extrabold tracking-tight text-on-surface mb-2 font-headline">
                Review delivery
              </h2>
              <p className="text-sm text-on-surface-variant">
                {queue.length} line{queue.length === 1 ? "" : "s"} · {queueTotalQty} unit{queueTotalQty === 1 ? "" : "s"} total
              </p>
            </div>
            <div className="rounded-2xl border border-outline-variant/20 overflow-hidden min-h-0">
              <div className="overflow-x-auto max-h-[min(360px,50vh)] overflow-y-auto">
                <table className="w-full text-left text-sm min-w-[720px]">
                  <thead className="sticky top-0 bg-surface-container-high/90 backdrop-blur-sm z-[1]">
                    <tr>
                      <th className="px-3 py-3 text-[10px] font-bold uppercase text-on-surface-variant">SKU</th>
                      <th className="px-3 py-3 text-[10px] font-bold uppercase text-on-surface-variant">Item</th>
                      <th className="px-3 py-3 text-[10px] font-bold uppercase text-on-surface-variant">Qty</th>
                      <th className="px-3 py-3 text-[10px] font-bold uppercase text-on-surface-variant">Unit</th>
                      <th className="px-3 py-3 text-[10px] font-bold uppercase text-on-surface-variant">Customer</th>
                      <th className="px-3 py-3 text-[10px] font-bold uppercase text-on-surface-variant">From</th>
                      <th className="px-3 py-3 text-[10px] font-bold uppercase text-on-surface-variant">Destination</th>
                      <th className="px-3 py-3 text-[10px] font-bold uppercase text-on-surface-variant">Date</th>
                      <th className="px-3 py-3 text-[10px] font-bold uppercase text-on-surface-variant">Carrier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {queue.map((row) => (
                      <tr key={row.id} className="bg-surface-container-lowest">
                        <td className="px-3 py-3 font-medium whitespace-nowrap">{row.sku}</td>
                        <td className="px-3 py-3 text-on-surface-variant max-w-[140px] truncate" title={row.itemName}>
                          {row.itemName}
                        </td>
                        <td className="px-3 py-3 font-semibold">{row.quantity}</td>
                        <td className="px-3 py-3 text-xs text-on-surface-variant whitespace-nowrap">{row.unit}</td>
                        <td className="px-3 py-3 text-xs max-w-[100px] truncate">{row.customerName}</td>
                        <td className="px-3 py-3 text-xs text-on-surface-variant max-w-[120px] truncate" title={row.shipFrom}>
                          {row.shipFrom}
                        </td>
                        <td className="px-3 py-3 text-xs text-on-surface-variant max-w-[120px] truncate" title={row.shipTo}>
                          {row.shipTo}
                        </td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap">{row.deliveryDate || "—"}</td>
                        <td className="px-3 py-3 text-xs max-w-[100px] truncate">{row.deliveredBy || "—"}</td>
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
                onClick={() => handleReviewDone(false)}
                disabled={saving}
                className="px-8 py-3.5 rounded-full font-bold text-sm bg-secondary-container text-on-secondary-container hover:brightness-95 transition-all"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() => handleReviewDone(true)}
                disabled={saving}
                className="px-10 py-3.5 rounded-full font-bold text-sm bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? "Saving..." : "Submit for Approval"}
              </button>
            </div>
          </div>
        ) : (
          <div className={`flex-1 ${dense ? "p-2" : "p-2"} overflow-hidden min-h-0 flex flex-col`}>
              <div className="mb-2">
                <h2 id="deliver-manual-title" className="text-base font-extrabold tracking-tight text-on-surface mb-1 font-headline">
                  Manual Item Entry
                </h2>
              </div>
              {formError ? <p className="mb-2 text-sm text-red-600 dark:text-red-400 font-medium">{formError}</p> : null}
              <div className="mt-1 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.05)] flex-1 min-h-0 flex flex-col">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary/60">Manual Input Preview Table</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{queue.length} items</span>
                </div>
                <div className="mb-1.5 grid grid-cols-1 gap-1 md:grid-cols-4">
                  <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                    <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Ship-From</label>
                    <select value={shipFrom} onChange={(e) => { setShipFrom(e.target.value); setFormError(""); }} className="h-5 w-full appearance-none rounded-md border-none bg-white px-1.5 text-[10px]">
                      <option value="">Select...</option>
                      {shipFromOptions.map((loc) => <option key={`dmf-${loc}`} value={loc}>{loc}</option>)}
                    </select>
                  </div>
                  <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                    <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Delivery Address</label>
                    <input value={shipTo} onChange={(e) => setShipTo(e.target.value)} className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                  </div>
                  <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                    <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Delivery Date</label>
                    <input value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} type="date" className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                  </div>
                  <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                    <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Customer</label>
                    <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-slate-200">
                  <div className="h-full min-h-[260px] overflow-x-auto overflow-y-hidden">
                    <table className="w-full min-w-[920px] table-fixed text-left text-[10px]">
                      <thead className="sticky top-0 z-10 bg-slate-100">
                        <tr>
                          <th className="w-[16%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">SKU-Code</th>
                          <th className="w-[16%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Item Name</th>
                          <th className="w-[10%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">UOM</th>
                          <th className="w-[10%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Quantity</th>
                          <th className="w-[16%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Delivered By</th>
                          <th className="w-[14%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Reference</th>
                          <th className="w-[8%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 bg-white">
                        {pagedQueue.map((row) => (
                          <tr key={row.id}>
                            <td className="truncate px-2 py-1 font-medium">{row.sku}</td>
                            <td className="truncate px-2 py-1">{row.itemName}</td>
                            <td className="px-2 py-1">{row.unit}</td>
                            <td className="px-2 py-1 text-center font-semibold">{row.quantity}</td>
                            <td className="truncate px-2 py-1">{row.deliveredBy || "—"}</td>
                            <td className="truncate px-2 py-1">{row.referenceNo}</td>
                            <td className="px-2 py-1 text-center">
                              <button type="button" onClick={() => removeQueueLine(row.id)} className="rounded-full p-0.5 hover:bg-slate-100" aria-label={`Remove ${row.sku}`}>
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50/70">
                          <td className="px-1.5 py-1">
                            <select value={skuValue} onChange={(e) => applySkuSelection(e.target.value)} onKeyDown={handleManualEntryKeyDown} className="h-6 w-full appearance-none rounded-md border-none bg-white px-1.5 text-[10px]">
                              <option value="">Select SKU...</option>
                              {availableSkuOptions.map((item) => <option key={item.id} value={item.sku}>{item.sku}</option>)}
                            </select>
                          </td>
                          <td className="px-1.5 py-1"><input value={itemName} onChange={(e) => setItemName(e.target.value)} onKeyDown={handleManualEntryKeyDown} readOnly={itemNameLocked} className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px]" /></td>
                          <td className="px-1.5 py-1"><input value={unit} readOnly onKeyDown={handleManualEntryKeyDown} className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px] text-slate-800" /></td>
                          <td className="px-1.5 py-1"><input value={quantity} onChange={(e) => setQuantity(e.target.value)} onKeyDown={handleManualEntryKeyDown} type="number" min="1" max={remainingQtyForSelected != null ? remainingQtyForSelected : undefined} className="h-6 w-full rounded-md border-none bg-white px-1.5 text-center text-[10px]" /></td>
                          <td className="px-1.5 py-1"><input value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} onKeyDown={handleManualEntryKeyDown} className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px]" /></td>
                          <td className="px-1.5 py-1"><input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} onKeyDown={handleManualEntryKeyDown} className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px]" /></td>
                          <td className="px-1.5 py-1 text-center text-[9px] font-semibold text-primary/80">Enter</td>
                        </tr>
                        {Array.from({ length: Math.max(0, MANUAL_PAGE_SIZE - pagedQueue.length - 1) }).map((_, idx) => (
                          <tr key={`deliver-empty-row-${idx}`} className="bg-white">
                            <td className="px-2 py-1 text-[10px] text-slate-300">—</td><td className="px-2 py-1 text-[10px] text-slate-300">—</td><td className="px-2 py-1 text-[10px] text-slate-300">—</td><td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td><td className="px-2 py-1 text-[10px] text-slate-300">—</td><td className="px-2 py-1 text-[10px] text-slate-300">—</td><td className="px-2 py-1"></td>
                          </tr>
                        ))}
                      </tbody>
                      {queue.length > 0 ? (
                        <tfoot>
                          <tr className="sticky bottom-0 z-10 bg-slate-700 text-white">
                            <td className="px-2 py-1.5 text-[10px] font-semibold" colSpan={3}>Totals</td>
                            <td className="px-2 py-1.5 text-center font-semibold">{queueTotalQty}</td>
                            <td className="px-2 py-1.5" colSpan={2}></td>
                            <td className="px-2 py-1.5 text-right"><button type="button" onClick={() => setQueue([])} className="rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-white/25">Clear</button></td>
                          </tr>
                        </tfoot>
                      ) : null}
                    </table>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-on-surface-variant">Total Quantity: <span className="font-semibold text-on-surface">{queueTotalQty} units</span></span>
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
                    <input className="h-5 rounded-md border-none bg-slate-100 px-1.5 text-[9px]" type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,image/jpeg,image/png,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAttachmentSelect(f); e.target.value = ""; }} />
                    <button
                      type="button"
                      onClick={() => handleReviewDone(true)}
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
            className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors z-10"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function DeliverBatchModal({ open, onClose, onReviewDone, inline = false, compact = false }) {
  const dense = inline || compact;
  useModalA11y(open && !inline, onClose);
  const { user } = useAuth();
  const locations = useDistinctLocations(open);
  const [customerName, setCustomerName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [shipFrom, setShipFrom] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveredBy, setDeliveredBy] = useState("");
  const [attachmentPath, setAttachmentPath] = useState("");
  const [attachMsg, setAttachMsg] = useState("");
  const [rows, setRows] = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [fileMsg, setFileMsg] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inventoryBySku, setInventoryBySku] = useState(new Map());

  useEffect(() => {
    if (!open) return;
    setCustomerName("");
    setReferenceNo("");
    setShipFrom("");
    setShipTo("");
    setDeliveryDate("");
    setDeliveredBy("");
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
      const quantityRaw = valueFromRow(source, ["quantity delivered", "quantity", "qty"]);
      const quantity = Number(quantityRaw);
      const rowIssues = [];
      if (!sku) rowIssues.push("SKU is required.");
      if (!itemName) rowIssues.push("Item Name is required.");
      if (!Number.isFinite(quantity) || quantity <= 0) rowIssues.push("Quantity Delivered must be > 0.");
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
      const { path } = await uploadAttachment(user.id, file, "delivery-docs");
      setAttachmentPath(path);
      setAttachMsg(`Uploaded: ${path}`);
    } catch (e) {
      setAttachmentPath("");
      setAttachMsg(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (submitForApproval) => {
    setFormError("");
    if (!customerName.trim()) return setFormError("Customer Name is required.");
    if (!referenceNo.trim()) return setFormError("Reference No. is required.");
    if (!deliveryDate) return setFormError("Delivery Date is required.");
    if (rows.length === 0) return setFormError("Upload a CSV or Excel file first.");
    if (rowErrors.length > 0) return setFormError("Fix row validation errors before confirming.");
    const queue = rows.map((row) => ({
      id: row.id,
      itemId: row.matched.id,
      sku: row.sku,
      itemName: row.itemName || row.matched.name || row.sku,
      quantity: row.quantity,
      unit: String(row.matched.unit_of_measure || "unit").trim() || "unit",
      customerName: customerName.trim(),
      referenceNo: referenceNo.trim(),
      shipFrom,
      shipTo,
      deliveryDate,
      deliveredBy: deliveredBy.trim(),
      attachmentPath: attachmentPath || "",
    }));
    setBusy(true);
    try {
      const totalUnits = queue.reduce((acc, row) => acc + Number(row.quantity || 0), 0);
      await onReviewDone?.({ lineCount: queue.length, unitCount: totalUnits, queue, submitForApproval });
      onClose();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open && !inline) return null;

  return (
    <div className={inline ? "w-full" : "fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 overflow-y-auto bg-on-surface/30 backdrop-blur-sm"} role="dialog" aria-modal={inline ? undefined : "true"} aria-labelledby="deliver-batch-title" onClick={inline ? undefined : (e) => e.target === e.currentTarget && onClose()}>
      <div className={inline ? "w-full overflow-hidden max-h-[calc(100dvh-10rem)]" : "relative z-10 w-full max-w-5xl bg-surface-container-lowest rounded-[2rem] shadow-2xl shadow-on-surface/10 flex flex-col overflow-hidden max-h-[min(840px,92vh)] my-4"} onClick={inline ? undefined : (e) => e.stopPropagation()}>
        <div className={`${dense ? "px-2 py-2" : "px-5 py-4"} flex justify-between items-center border-b border-outline-variant/10 gap-4 shrink-0`}>
          <h2 id="deliver-batch-title" className={`${dense ? "text-base" : "text-2xl"} font-extrabold tracking-tight text-on-surface font-headline`}>
            Batch Upload Delivery
          </h2>
          {!inline ? (
            <button type="button" onClick={onClose} className="h-10 w-10 flex items-center justify-center hover:bg-surface-container-high rounded-full transition-colors shrink-0" aria-label="Close">
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
                className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 py-1 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
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
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Delivery Routing</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Ship-From (Optional)</label>
                  <select value={shipFrom} onChange={(e) => setShipFrom(e.target.value)} className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 text-sm appearance-none">
                    <option value="">Select...</option>
                    {locations.map((loc) => (
                      <option key={`dbf-${loc}`} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Delivery Address (Optional)</label>
                  <select value={shipTo} onChange={(e) => setShipTo(e.target.value)} className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 text-sm appearance-none">
                    <option value="">Select...</option>
                    {locations.map((loc) => (
                      <option key={`dbt-${loc}`} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
              <section className="rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Delivery Details</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Delivery Date</label>
                  <input value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 text-sm" type="date" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Delivered By (Optional)</label>
                  <input value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 text-sm" type="text" />
                </div>
              </section>
              <section className="rounded-lg border border-outline-variant/20 bg-surface p-2 space-y-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Documents</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Customer Name</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 text-sm" type="text" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Reference No.</label>
                  <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 text-sm" type="text" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Attachment (Optional)</label>
                  <input
                    className="w-full h-8 bg-surface-container-highest border-none rounded-lg px-2.5 py-1 text-sm"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,image/jpeg,image/png,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Review Uploaded Items</span>
                <span className="px-3 py-1 bg-surface-container-high text-on-surface-variant text-[10px] font-bold rounded-full">{rows.length} rows</span>
              </div>
              <div className="overflow-auto min-h-0">
                <table className="w-full text-left min-w-[560px]">
                  <thead className="sticky top-0 bg-surface-bright z-10">
                    <tr className="text-[10px] text-outline font-bold uppercase tracking-widest">
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-on-surface-variant text-sm">
                          Upload a file to preview rows.
                        </td>
                      </tr>
                    ) : (
                      rows.slice(0, 50).map((row) => (
                        <tr key={row.id} className="bg-surface-container-lowest border-t border-outline-variant/10">
                          <td className="px-4 py-3">{row.sku}</td>
                          <td className="px-4 py-3">{row.itemName}</td>
                          <td className="px-4 py-3">{row.quantity}</td>
                          <td className="px-4 py-3 text-right">{row.matched?.id ? "OK" : "Unknown SKU"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {rowErrors.length > 0 ? (
                <div className="m-2 rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 space-y-1 max-h-36 overflow-y-auto">
                  {rowErrors.map((err) => (
                    <p key={err}>{err}</p>
                  ))}
                </div>
              ) : null}
              <div className="pt-1 flex justify-end gap-2">
                <button type="button" disabled={busy || rows.length === 0} onClick={() => handleConfirm(false)} className="h-8 px-5 rounded-full bg-secondary-container text-on-secondary-container font-bold text-sm disabled:opacity-50">
                  {busy ? "Processing..." : "Save Draft"}
                </button>
                <button type="button" disabled={busy || rows.length === 0} onClick={() => handleConfirm(true)} className="h-8 px-5 rounded-full bg-primary text-on-primary font-bold text-sm disabled:opacity-50">
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
