import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { uploadAttachment } from "../../lib/storageUpload";
import { getErrorMessage } from "../../lib/errors";
import { supabase } from "../../lib/supabase";
import { useDistinctLocations } from "../../lib/useDistinctLocations";
import { SkuAutocompleteInput } from "../../components/SkuAutocompleteInput";

const RECEIVE_CONDITIONS = [
  { value: "received", label: "Received" },
  { value: "damaged", label: "Damaged" },
  { value: "returned", label: "Return" },
];

function draftStorageKey(mode) {
  return `receive-draft:${mode}`;
}

function workflowStatusForRole() {
  return "Pending Approval";
}

function workflowActionLabel() {
  return "Submit for Approval";
}

const WHITE_FIELD_THEME = "[&_input]:!bg-white [&_select]:!bg-white [&_textarea]:!bg-white";

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

function buildReceivedByDefault(profile, user) {
  const first = String(profile?.first_name || "").trim();
  const last = String(profile?.last_name || "").trim();
  const fullName = `${first} ${last}`.trim();
  const roleName = String(profile?.role_name || "").trim();
  const email = String(user?.email || "").trim();
  const identity = fullName || email || "";
  if (identity && roleName) return `${identity} (${roleName})`;
  return identity || roleName || "";
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

function extractLocationFromPoNotes(notesText) {
  const text = String(notesText || "");
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*Location\s*:\s*(.+)\s*$/i);
    if (match?.[1]) return String(match[1]).trim();
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

function TagIssueModal({ open, maxQty, defaultReason, onClose, onConfirm }) {
  const [issueQty, setIssueQty] = useState("");
  const [issueReason, setIssueReason] = useState(defaultReason || "Damaged");
  const [issueNotes, setIssueNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setIssueQty(String(maxQty || ""));
    setIssueReason(defaultReason || "Damaged");
    setIssueNotes("");
    setError("");
  }, [open, maxQty, defaultReason]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/30 p-3" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
        <h3 className="text-base font-bold text-on-surface">Tag Return / Damaged</h3>
        <p className="mt-1 text-xs text-on-surface-variant">Set affected quantity and reason before adding this item.</p>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        <div className="mt-3 space-y-2">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Quantity Affected</label>
            <input value={issueQty} onChange={(e) => setIssueQty(e.target.value)} type="number" min="0" className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Reason</label>
            <select value={issueReason} onChange={(e) => setIssueReason(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm">
              <option value="Damaged">Damaged</option>
              <option value="Return">Return</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Notes</label>
            <textarea value={issueNotes} onChange={(e) => setIssueNotes(e.target.value)} className="w-full min-h-16 rounded-lg border border-slate-200 bg-white p-2 text-sm" />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-full bg-slate-100 px-4 text-sm font-semibold">Cancel</button>
          <button
            type="button"
            onClick={() => {
              const qty = Number(issueQty);
              const max = Number(maxQty || 0);
              if (!Number.isFinite(qty) || qty <= 0) return setError("Enter a valid affected quantity.");
              if (qty > max) return setError(`Affected quantity cannot exceed ${max}.`);
              onConfirm({ issueQuantity: qty, issueReason, issueNotes: issueNotes.trim() });
            }}
            className="h-9 rounded-full bg-primary px-4 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScanItemsModal({ open, onClose, onReviewDone, inline = false, compact = false }) {
  const dense = compact;
  const inlineTight = inline && !compact;
  useModalA11y(open, onClose);
  const { user, profile, role } = useAuth();
  const locations = useDistinctLocations(open);
  const [step, setStep] = useState("entry");
  const [inventoryOptions, setInventoryOptions] = useState([]);
  const [skuValue, setSkuValue] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState("1");
  const [location, setLocation] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [supplier, setSupplier] = useState("");
  const [deliveryBy, setDeliveryBy] = useState("");
  const [description, setDescription] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [remarks, setRemarks] = useState("");
  const [conditionTag, setConditionTag] = useState("received");
  const [attachmentPath, setAttachmentPath] = useState("");
  const [attachmentMsg, setAttachmentMsg] = useState("");
  const [queue, setQueue] = useState([]);
  const [formError, setFormError] = useState("");
  const [draftMsg, setDraftMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [pendingIssueQty, setPendingIssueQty] = useState(0);
  const [pendingIssueReason, setPendingIssueReason] = useState("Damaged");
  const [pendingAddRow, setPendingAddRow] = useState(null);

  useEffect(() => {
    if (!open) return;
    setStep("entry");
    setSkuValue("");
    setSelectedItem(null);
    setQuantity("1");
    setLocation("");
    setReceivedDate("");
    setReceivedBy(buildReceivedByDefault(profile, user));
    setSupplier("");
    setDeliveryBy("");
    setDescription("");
    setUnitCost("");
    setRemarks("");
    setConditionTag("received");
    setAttachmentPath("");
    setAttachmentMsg("");
    setQueue([]);
    setFormError("");
    setDraftMsg("");
    setSaving(false);
    setIssueModalOpen(false);
    setPendingIssueQty(0);
    setPendingIssueReason("Damaged");
    setPendingAddRow(null);
    void supabase
      .from("inventory_items")
      .select("id,sku,name,unit_of_measure,is_active")
      .neq("is_active", false)
      .order("name", { ascending: true })
      .limit(3000)
      .then(({ data }) => {
        setInventoryOptions((data ?? []).map((row) => ({ ...row, sku: String(row.sku || ""), name: String(row.name || "") })));
      });
    try {
      const raw = window.localStorage.getItem(draftStorageKey("scan"));
      if (raw) {
        const parsed = JSON.parse(raw);
        setQueue(Array.isArray(parsed?.queue) ? parsed.queue : []);
        setLocation(String(parsed?.location || ""));
        setReceivedDate(String(parsed?.receivedDate || ""));
        setReceivedBy(String(parsed?.receivedBy || buildReceivedByDefault(profile, user)));
        setSupplier(String(parsed?.supplier || ""));
        setDeliveryBy(String(parsed?.deliveryBy || ""));
      }
    } catch {
      // ignore invalid drafts
    }
  }, [open, profile, user]);

  const queueTotalQty = queue.reduce((acc, row) => acc + Number(row.quantity || 0), 0);
  const queueTotalCost = queue.reduce((acc, row) => acc + Number(row.lineCost || 0), 0);

  const handleAttachmentSelect = async (file) => {
    if (!file || !user?.id) return;
    setAttachmentMsg("");
    try {
      const { path } = await uploadAttachment(user.id, file, "receive-docs");
      setAttachmentPath(path);
      setAttachmentMsg(`Uploaded: ${path}`);
    } catch (e) {
      setAttachmentPath("");
      setAttachmentMsg(getErrorMessage(e));
    }
  };

  const appendQueueRow = (matched, qty, issueInfo = null) => {
    const parsedUnitCost = Number(unitCost || 0);
    setQueue((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        itemId: matched.id,
        sku: matched.sku,
        itemName: matched.name || matched.sku,
        quantity: qty,
        unit: String(matched.unit_of_measure || "unit").trim() || "unit",
        location,
        receivedDate: receivedDate || "",
        receivedBy: receivedBy.trim(),
        supplier: supplier.trim(),
        supplierName: supplier.trim(),
        deliveryBy: deliveryBy.trim(),
        description: description.trim(),
        unitCost: Number.isFinite(parsedUnitCost) ? parsedUnitCost : 0,
        lineCost: (Number.isFinite(parsedUnitCost) ? parsedUnitCost : 0) * qty,
        remarks: remarks.trim(),
        conditionTag,
        issueQuantity: Number(issueInfo?.issueQuantity || 0),
        issueReason: issueInfo?.issueReason || "",
        issueNotes: issueInfo?.issueNotes || "",
        workflowStatus: workflowStatusForRole(),
        attachmentPath: attachmentPath || "",
      },
    ]);
    setSkuValue("");
    setSelectedItem(null);
    setQuantity("1");
    setUnitCost("");
    setRemarks("");
    setConditionTag("received");
  };

  const handleAddItem = () => {
    setFormError("");
    const matched = selectedItem || inventoryOptions.find((opt) => String(opt.sku || "").toLowerCase() === skuValue.trim().toLowerCase());
    const qty = Number(quantity);
    if (!matched?.id) return setFormError("Scan or select a valid SKU.");
    if (!Number.isFinite(qty) || qty <= 0) return setFormError("Quantity must be greater than 0.");
    if (!location) return setFormError("Location is required.");
    if (!receivedBy.trim()) return setFormError("Received By is required.");
    if (conditionTag === "damaged" || conditionTag === "returned") {
      setPendingAddRow({ matched, qty });
      setPendingIssueQty(qty);
      setPendingIssueReason(conditionTag === "damaged" ? "Damaged" : "Return");
      setIssueModalOpen(true);
      return;
    }
    appendQueueRow(matched, qty);
  };

  const handleFinalize = async (submitIntent = "submit") => {
    if (queue.length === 0) {
      setFormError("Add at least one scanned item before finalizing.");
      return;
    }
    setSaving(true);
    try {
      await onReviewDone?.({
        sourceType: "scan",
        submitIntent,
        header: { supplier, receivedBy, receivedDate, location, attachmentPath, remarks },
        lineCount: queue.length,
        unitCount: queueTotalQty,
        totalCost: queueTotalCost,
        queue,
        workflowStatus: submitIntent === "draft" ? "Draft" : "Pending Approval",
      });
      setQueue([]);
      setStep("entry");
      setSkuValue("");
      setSelectedItem(null);
      setQuantity("1");
      setDescription("");
      setUnitCost("");
      setRemarks("");
      setConditionTag("received");
      setAttachmentPath("");
      setAttachmentMsg("");
      setFormError("");
      setDraftMsg("");
      try {
        window.localStorage.removeItem(draftStorageKey("scan"));
      } catch {
        // ignore storage errors
      }
      onClose();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (queue.length > 0) {
      setSaving(true);
      try {
        await handleFinalize("draft");
        setDraftMsg("Draft saved.");
      } finally {
        setSaving(false);
      }
      return;
    }
    try {
      window.localStorage.setItem(
        draftStorageKey("scan"),
        JSON.stringify({ queue, location, receivedDate, receivedBy, supplier, deliveryBy, savedAt: new Date().toISOString() })
      );
      setDraftMsg("Draft saved.");
    } catch {
      setDraftMsg("Unable to save draft on this browser.");
    }
  };

  if (!open) return null;

  return (
    <div
      className={
        inline
          ? "w-full"
          : "fixed inset-0 z-[90] flex items-center justify-center p-4 bg-on-surface/30 backdrop-blur-sm"
      }
      role="dialog"
      aria-modal={inline ? undefined : "true"}
      aria-labelledby="scan-items-title"
      onClick={inline ? undefined : (e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={
          inline
            ? `w-full h-full min-h-0 overflow-hidden flex flex-col ${WHITE_FIELD_THEME}`
            : `bg-surface-container-lowest w-full max-w-5xl max-h-[min(921px,92vh)] rounded-3xl shadow-2xl overflow-hidden flex flex-col ${WHITE_FIELD_THEME}`
        }
        onClick={inline ? undefined : (e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between border-b border-outline-variant/15 ${
            dense ? "p-2" : inlineTight ? "px-2.5 py-2" : "p-5"
          }`}
        >
          <div>
            <h2
              id="scan-items-title"
              className={`${dense ? "text-base" : inlineTight ? "text-lg" : "text-2xl"} font-extrabold tracking-tight text-on-surface font-headline`}
            >
              Scan SKU or Code
            </h2>
          </div>
          {!inline ? (
            <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors shrink-0" aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          ) : null}
        </div>
        {step === "review" ? (
          <div className={`${dense ? "p-2" : "p-5"} overflow-y-auto`}>
            <div className="rounded-2xl border border-outline-variant/20 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-high/90">
                  <tr>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">SKU</th>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">Item</th>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">Qty</th>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">Location</th>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">Condition</th>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant text-right">Unit Cost</th>
                    <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {queue.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3 font-medium">{row.sku}</td>
                      <td className="px-3 py-3">{row.itemName}</td>
                      <td className="px-3 py-3 font-semibold">{row.quantity}</td>
                      <td className="px-3 py-3">{row.location}</td>
                      <td className="px-3 py-3 capitalize">{row.conditionTag || "received"}</td>
                      <td className="px-3 py-3 text-right">{Number(row.unitCost || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right font-semibold">{Number(row.lineCost || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-container-high/40">
                    <td className="px-3 py-2 font-semibold text-xs" colSpan={2}>
                      Totals
                    </td>
                    <td className="px-3 py-2 font-semibold">{queueTotalQty}</td>
                    <td className="px-3 py-2" colSpan={2}></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right font-semibold">{queueTotalCost.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {formError ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
            {draftMsg ? <p className="mt-2 text-xs text-on-surface-variant">{draftMsg}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={handleSaveDraft} className="px-7 py-3 rounded-full font-bold text-sm bg-surface-container-high text-on-surface">
                Save
              </button>
              <button type="button" onClick={() => setStep("entry")} className="px-7 py-3 rounded-full font-bold text-sm bg-secondary-container text-on-secondary-container">
                Edit list
              </button>
              <button type="button" disabled={saving} onClick={handleFinalize} className="px-9 py-3 rounded-full font-bold text-sm bg-gradient-to-r from-primary to-primary-container text-on-primary disabled:opacity-50">
                {saving ? "Saving..." : workflowActionLabel()}
              </button>
            </div>
          </div>
        ) : (
          <div className={`${dense ? "p-2 sm:p-2.5" : inlineTight ? "p-2.5" : "p-5"} overflow-y-auto`}>
            {formError ? <p className="mb-2 text-sm text-red-600 dark:text-red-400">{formError}</p> : null}

            <div className="mb-1.5 space-y-1">
              <SkuAutocompleteInput
                options={inventoryOptions.map((opt) => ({ sku: opt.sku, name: opt.name }))}
                value={skuValue}
                onChange={setSkuValue}
                onSelect={(opt) => {
                  if (!opt) return setSelectedItem(null);
                  const matched = inventoryOptions.find((row) => row.sku === opt.sku) || null;
                  setSelectedItem(matched);
                }}
                inputClassName={`${dense ? "h-8 rounded-lg px-2.5 text-sm" : inlineTight ? "h-8 rounded-lg px-2.5 text-xs" : "rounded-2xl py-3 px-4"} w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20`}
                placeholder="Scan barcode / type SKU..."
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-1.5">
              <section className={`rounded-lg border border-outline-variant/20 bg-surface ${inlineTight ? "p-1.5" : "p-2"} space-y-1`}>
                <h3 className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-bold uppercase tracking-[0.16em] text-primary/60`}>Taxonomy &amp; Location</h3>
                <div className="space-y-1">
                  <label className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wider text-on-surface-variant`}>Quantity</label>
                  <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${dense ? "h-8 rounded-lg px-2.5 text-sm" : inlineTight ? "h-8 rounded-lg px-2.5 text-xs" : "rounded-2xl py-3 px-4"} w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20`} type="number" min="0" />
                </div>
                <div className="space-y-1">
                  <label className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wider text-on-surface-variant`}>Location/Storage/Warehouse</label>
                  <select value={location} onChange={(e) => setLocation(e.target.value)} className={`${dense ? "h-8 rounded-lg px-2.5 text-sm" : inlineTight ? "h-8 rounded-lg px-2.5 text-xs" : "rounded-2xl py-3 px-4"} w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20 appearance-none`}>
                    <option value="">Select location...</option>
                    {locations.map((loc) => (
                      <option key={`scan-loc-${loc}`} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section className={`rounded-lg border border-outline-variant/20 bg-surface ${inlineTight ? "p-1.5" : "p-2"} space-y-1`}>
                <h3 className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-bold uppercase tracking-[0.16em] text-primary/60`}>Dates &amp; Receiving</h3>
                <div className="space-y-1">
                  <label className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wider text-on-surface-variant`}>Received Date</label>
                  <input value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={`${dense ? "h-8 rounded-lg px-2.5 text-sm" : inlineTight ? "h-8 rounded-lg px-2.5 text-xs" : "rounded-2xl py-3 px-4"} w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20`} type="date" />
                </div>
                <div className="space-y-1">
                  <label className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wider text-on-surface-variant`}>Received By</label>
                  <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className={`${dense ? "h-8 rounded-lg px-2.5 text-sm" : inlineTight ? "h-8 rounded-lg px-2.5 text-xs" : "rounded-2xl py-3 px-4"} w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20`} type="text" />
                </div>
              </section>

              <section className={`rounded-lg border border-outline-variant/20 bg-surface ${inlineTight ? "p-1.5" : "p-2"} space-y-1`}>
                <h3 className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-bold uppercase tracking-[0.16em] text-primary/60`}>Supplier &amp; Dispatch</h3>
                <div className="space-y-1">
                  <label className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wider text-on-surface-variant`}>Supplier (Optional)</label>
                  <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`${dense ? "h-8 rounded-lg px-2.5 text-sm" : inlineTight ? "h-8 rounded-lg px-2.5 text-xs" : "rounded-2xl py-3 px-4"} w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20`} type="text" />
                </div>
                <div className="space-y-1">
                  <label className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wider text-on-surface-variant`}>Delivery By (Optional)</label>
                  <input value={deliveryBy} onChange={(e) => setDeliveryBy(e.target.value)} className={`${dense ? "h-8 rounded-lg px-2.5 text-sm" : inlineTight ? "h-8 rounded-lg px-2.5 text-xs" : "rounded-2xl py-3 px-4"} w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20`} type="text" />
                </div>
              </section>
            </div>

            <div className="mt-1.5 grid grid-cols-1 xl:grid-cols-3 gap-1.5">
              <section className={`rounded-lg border border-outline-variant/20 bg-surface ${inlineTight ? "p-1.5" : "p-2"} space-y-1`}>
                <label className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wider text-on-surface-variant`}>Description</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} className={`${dense ? "h-8 rounded-lg px-2.5 text-sm" : inlineTight ? "h-8 rounded-lg px-2.5 text-xs" : "rounded-2xl py-3 px-4"} w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20`} type="text" placeholder="Optional item description" />
              </section>
              <section className={`rounded-lg border border-outline-variant/20 bg-surface ${inlineTight ? "p-1.5" : "p-2"} space-y-1`}>
                <label className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wider text-on-surface-variant`}>Unit Cost</label>
                <input value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={`${dense ? "h-8 rounded-lg px-2.5 text-sm" : inlineTight ? "h-8 rounded-lg px-2.5 text-xs" : "rounded-2xl py-3 px-4"} w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20`} type="number" min="0" step="0.01" placeholder="0.00" />
              </section>
              <section className={`rounded-lg border border-outline-variant/20 bg-surface ${inlineTight ? "p-1.5" : "p-2"} space-y-1`}>
                <label className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wider text-on-surface-variant`}>Status Tag</label>
                <select value={conditionTag} onChange={(e) => setConditionTag(e.target.value)} className={`${dense ? "h-8 rounded-lg px-2.5 text-sm" : inlineTight ? "h-8 rounded-lg px-2.5 text-xs" : "rounded-2xl py-3 px-4"} w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20 appearance-none`}>
                  {RECEIVE_CONDITIONS.map((opt) => (
                    <option key={`scan-cond-${opt.value}`} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </section>
            </div>

            <div className={`mt-1.5 rounded-lg border border-outline-variant/20 bg-surface ${inlineTight ? "p-1.5" : "p-2"} space-y-1`}>
              <label className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wider text-on-surface-variant`}>Remarks (Optional)</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className={`w-full ${inlineTight ? "min-h-12 text-xs" : "min-h-16 text-sm"} rounded-lg bg-surface-container-highest border-none p-2 focus:ring-2 focus:ring-primary/20`}
                placeholder="Add comments for special handling, damages, or return notes"
              />
            </div>

            <div className={`mt-1.5 rounded-lg border border-outline-variant/20 bg-surface ${inlineTight ? "p-1.5" : "p-2"} space-y-1`}>
              <label className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wider text-on-surface-variant`}>Attachment (Optional)</label>
              <input
                className={`${dense ? "h-8 rounded-lg px-2.5 py-1 text-sm" : inlineTight ? "h-8 rounded-lg px-2.5 py-1 text-xs" : "rounded-2xl py-3 px-4"} w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20`}
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

            <div className={`mt-1.5 flex flex-col md:flex-row ${dense ? "gap-2" : inlineTight ? "gap-2 pt-1" : "gap-3 pt-2"}`}>
              <button type="button" onClick={handleAddItem} className={`flex-1 bg-surface-container-high text-on-secondary-container ${inlineTight ? "h-8 text-xs" : "h-8 text-sm"} px-4 rounded-full font-bold flex items-center justify-center gap-2`}>
                <span className="material-symbols-outlined text-[18px]">playlist_add</span>
                Add Item to List
              </button>
              <button type="button" onClick={() => setStep("review")} disabled={queue.length === 0} className={`flex-1 bg-gradient-to-r from-primary to-primary-container text-on-primary ${inlineTight ? "h-8 text-xs" : "h-8 text-sm"} px-4 rounded-full font-bold flex items-center justify-center gap-2 disabled:opacity-50`}>
                <span className="material-symbols-outlined text-[18px]">fact_check</span>
                Proceed to Review List ({queue.length})
              </button>
            </div>
          </div>
        )}
      </div>
      <TagIssueModal
        open={issueModalOpen}
        maxQty={pendingIssueQty}
        defaultReason={pendingIssueReason}
        onClose={() => setIssueModalOpen(false)}
        onConfirm={(issueInfo) => {
          if (!pendingAddRow) return;
          appendQueueRow(pendingAddRow.matched, pendingAddRow.qty, issueInfo);
          setIssueModalOpen(false);
          setPendingAddRow(null);
        }}
      />
    </div>
  );
}

export function ManualEntryModal({ open, onClose, onReviewDone, inline = false, compact = false, initialPoId = "" }) {
  const MANUAL_PAGE_SIZE = 22;
  const dense = compact;
  const inlineTight = inline && !compact;
  useModalA11y(open, onClose);
  const { user, profile, role } = useAuth();
  const [skuValue, setSkuValue] = useState("");
  const [selectedPoLineId, setSelectedPoLineId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemNameLocked, setItemNameLocked] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [baseUnit, setBaseUnit] = useState("");
  const [location, setLocation] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [supplier, setSupplier] = useState("");
  const [poOptions, setPoOptions] = useState([]);
  const [poLoading, setPoLoading] = useState(false);
  const [pendingQtyByPoLine, setPendingQtyByPoLine] = useState(new Map());
  const [deliveryBy, setDeliveryBy] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [remarks, setRemarks] = useState("");
  const [conditionTag, setConditionTag] = useState("received");
  const [queue, setQueue] = useState([]);
  const [step, setStep] = useState("entry");
  const [formError, setFormError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [draftMsg, setDraftMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [pendingIssueQty, setPendingIssueQty] = useState(0);
  const [pendingIssueReason, setPendingIssueReason] = useState("Damaged");
  const [pendingAddPayload, setPendingAddPayload] = useState(null);
  const [attachmentPath, setAttachmentPath] = useState("");
  const [attachmentMsg, setAttachmentMsg] = useState("");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [queuePage, setQueuePage] = useState(1);

  useEffect(() => {
    if (!open) return;
    setSkuValue("");
    setSelectedPoLineId("");
    setItemName("");
    setItemDescription("");
    setItemNameLocked(false);
    setQuantity("");
    setUnit("");
    setBaseUnit("");
    setLocation("");
    setReceivedDate("");
    setReceivedBy(buildReceivedByDefault(profile, user));
    setSupplier("");
    setPoOptions([]);
    setPoLoading(false);
    setPendingQtyByPoLine(new Map());
    setDeliveryBy("");
    setUnitCost("");
    setRemarks("");
    setConditionTag("received");
    setQueue([]);
    setStep("entry");
    setFormError("");
    setReviewError("");
    setDraftMsg("");
    setSaving(false);
    setAttachmentPath("");
    setAttachmentMsg("");
    setUploadingAttachment(false);
    setQueuePage(1);
    setIssueModalOpen(false);
    setPendingIssueQty(0);
    setPendingIssueReason("Damaged");
    setPendingAddPayload(null);
    let active = true;
    setPoLoading(true);
    Promise.all([
      supabase
        .from("purchase_orders")
        .select(
          "id,po_number,status,supplier_id,expected_delivery_date,created_at,notes,suppliers(name),purchase_order_items(id,item_id,quantity_ordered,quantity_received,unit_price,inventory_items(sku,name))"
        )
        .in("status", ["confirmed", "sent"])
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("receive_transaction_items")
        .select("po_line_id,quantity,receive_transactions!inner(status)")
        .not("po_line_id", "is", null)
        .eq("receive_transactions.status", "pending_approval")
        .limit(4000),
    ])
      .then(([poRes, pendingRes]) => {
        if (!active) return;
        setPoOptions(poRes.data ?? []);
        const nextMap = new Map();
        for (const row of pendingRes.data ?? []) {
          const poLineId = String(row.po_line_id || "");
          if (!poLineId) continue;
          const qty = Number(row.quantity || 0);
          if (!Number.isFinite(qty) || qty <= 0) continue;
          nextMap.set(poLineId, (nextMap.get(poLineId) || 0) + qty);
        }
        setPendingQtyByPoLine(nextMap);
      })
      .finally(() => {
        if (!active) return;
        setPoLoading(false);
      });
    try {
      const raw = window.localStorage.getItem(draftStorageKey("manual"));
      if (raw) {
        const parsed = JSON.parse(raw);
        setQueue(Array.isArray(parsed?.queue) ? parsed.queue : []);
      }
    } catch {
      // ignore bad draft
    }
    return () => {
      active = false;
    };
  }, [open, profile, user]);

  const handleAttachmentSelect = async (file) => {
    if (!user?.id || !file) return;
    setAttachmentMsg("");
    setUploadingAttachment(true);
    try {
      const { path } = await uploadAttachment(user.id, file, "receive-docs");
      setAttachmentPath(path);
      setAttachmentMsg(`Uploaded: ${path}`);
    } catch (e) {
      setAttachmentPath("");
      setAttachmentMsg(getErrorMessage(e));
    } finally {
      setUploadingAttachment(false);
    }
  };

  const availablePoLines = useMemo(() => {
    const lines = [];
    for (const po of poOptions) {
      const poSupplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
      for (const line of po.purchase_order_items ?? []) {
        const inv = Array.isArray(line.inventory_items) ? line.inventory_items[0] : line.inventory_items;
        const ordered = Number(line.quantity_ordered ?? 0);
        const received = Number(line.quantity_received ?? 0);
        const pendingApprovalQty = Number(pendingQtyByPoLine.get(String(line.id || "")) || 0);
        const remaining = Math.max(0, ordered - received - pendingApprovalQty);
        if (!line.id || !line.item_id || remaining <= 0) continue;
        lines.push({
          lineId: line.id,
          poId: po.id,
          poNumber: po.po_number,
          poExpectedDate: po.expected_delivery_date || "",
          poLocation: extractLocationFromPoNotes(po.notes),
          supplierId: po.supplier_id || null,
          supplierName: poSupplier?.name || "",
          itemId: line.item_id,
          sku: String(inv?.sku || "").trim(),
          itemName: inv?.name || "",
          remainingQty: remaining,
          unitPrice: Number(line.unit_price ?? 0),
        });
      }
    }
    return lines;
  }, [poOptions, pendingQtyByPoLine]);

  const queuedPoLineIds = useMemo(() => {
    return new Set(
      queue
        .map((row) => String(row.poLineId || "").trim())
        .filter(Boolean)
    );
  }, [queue]);

  const selectablePoLines = useMemo(() => {
    return availablePoLines.filter((line) => !queuedPoLineIds.has(String(line.lineId)));
  }, [availablePoLines, queuedPoLineIds]);

  const selectedPoLine = availablePoLines.find((line) => String(line.lineId) === String(selectedPoLineId));

  const handleSelectPoLine = (lineId) => {
    setSelectedPoLineId(lineId);
    const picked = availablePoLines.find((line) => String(line.lineId) === String(lineId));
    if (!picked) return;
    setSkuValue(String(picked.sku || "").trim() || String(picked.itemName || "").trim());
    setItemName(picked.itemName || "");
    setItemDescription(picked.itemName || "");
    setItemNameLocked(true);
    setSupplier(picked.supplierName || "");
    setLocation(picked.poLocation || "");
    setQuantity(String(picked.remainingQty ?? ""));
    setUnitCost(Number.isFinite(Number(picked.unitPrice)) ? String(Number(picked.unitPrice)) : "");
    if (!receivedDate && picked.poExpectedDate) setReceivedDate(picked.poExpectedDate);
  };

  useEffect(() => {
    if (!open || !initialPoId) return;
    if (!availablePoLines.length) return;
    if (selectedPoLineId) return;
    const firstLine = availablePoLines.find((line) => line.poId === initialPoId);
    if (firstLine?.lineId) {
      setSelectedPoLineId(firstLine.lineId);
    }
  }, [open, initialPoId, availablePoLines, selectedPoLineId]);

  useEffect(() => {
    if (!selectedPoLine) return;
    setSkuValue(String(selectedPoLine.sku || "").trim() || String(selectedPoLine.itemName || "").trim());
    setItemName(selectedPoLine.itemName || "");
    setItemDescription(selectedPoLine.itemName || "");
    setItemNameLocked(true);
    setSupplier(selectedPoLine.supplierName || "");
    setLocation(selectedPoLine.poLocation || "");
    setQuantity(String(selectedPoLine.remainingQty));
    setUnitCost(
      Number.isFinite(Number(selectedPoLine.unitPrice))
        ? String(Number(selectedPoLine.unitPrice))
        : ""
    );
    if (!receivedDate && selectedPoLine.poExpectedDate) setReceivedDate(selectedPoLine.poExpectedDate);
  }, [selectedPoLine, quantity, receivedDate]);

  useEffect(() => {
    if (!open) return;
    if (!selectedPoLine?.itemId) {
      setBaseUnit("");
      setUnit("");
      return;
    }
    let active = true;
    void supabase
      .from("inventory_items")
      .select("unit_of_measure")
      .eq("id", selectedPoLine.itemId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const uom = String(data?.unit_of_measure || "").trim();
        setBaseUnit(uom);
        // Keep manual receive rows aligned with item base UOM to avoid invalid conversions.
        setUnit(uom);
      });
    return () => {
      active = false;
    };
  }, [open, selectedPoLine?.itemId]);

  const appendManualQueueRow = (matched, qty, unitValue, issueInfo = null) => {
    const parsedUnitCost = Number(unitCost || 0);
    setQueue((q) => [
      ...q,
      {
        id: crypto.randomUUID(),
        itemId: matched.id,
        sku: skuValue.trim() || String(matched.sku || "").trim() || String(matched.name || "").trim() || "N/A",
        itemName: itemName.trim() || matched.name || skuValue.trim(),
        description: itemDescription.trim(),
        quantity: qty,
        unit: unitValue,
        location,
        receivedDate: receivedDate || "",
        receivedBy: receivedBy.trim(),
        supplierId: selectedPoLine?.supplierId ?? null,
        supplierName: selectedPoLine?.supplierName || "",
        poId: selectedPoLine?.poId || null,
        poNumber: selectedPoLine?.poNumber || "",
        poLineId: selectedPoLine?.lineId || null,
        deliveryBy: deliveryBy.trim(),
        unitCost: Number.isFinite(parsedUnitCost) ? parsedUnitCost : 0,
        lineCost: qty * (Number.isFinite(parsedUnitCost) ? parsedUnitCost : 0),
        remarks: remarks.trim(),
        conditionTag,
        issueQuantity: Number(issueInfo?.issueQuantity || 0),
        issueReason: issueInfo?.issueReason || "",
        issueNotes: issueInfo?.issueNotes || "",
        workflowStatus: workflowStatusForRole(),
        attachmentPath: attachmentPath || "",
      },
    ]);
    setSkuValue("");
    setItemName("");
    setItemDescription("");
    setItemNameLocked(false);
    setQuantity("");
    setUnitCost("");
    setRemarks("");
    setConditionTag("received");
    setSelectedPoLineId("");
  };

  const handleAddItem = () => {
    setFormError("");
    const sku = skuValue.trim() || String(selectedPoLine?.sku || "").trim() || String(selectedPoLine?.itemName || "").trim();
    const qty = Number(quantity);
    const unitValue = String(unit || "").trim();
    if (!selectedPoLineId) return setFormError("Select a PO item / SKU.");
    if (!selectedPoLine) return setFormError("Selected PO item is invalid.");
    if (queue.some((row) => String(row.poLineId) === String(selectedPoLine.lineId))) {
      return setFormError("This PO item is already in the table.");
    }
    const matched = {
      id: selectedPoLine.itemId,
      sku: selectedPoLine.sku || "",
      name: selectedPoLine.itemName || "",
    };
    if (!matched?.id) return setFormError("Selected PO line is missing inventory item.");
    if (!Number.isFinite(qty) || qty <= 0) return setFormError("Enter a quantity greater than 0.");
    if (!unitValue) return setFormError("Unit is required.");
    if (!location) return setFormError("Location is required.");
    if (!receivedBy.trim()) return setFormError("Received By is required.");
    if (conditionTag === "damaged" || conditionTag === "returned") {
      setPendingAddPayload({ matched, qty, unitValue });
      setPendingIssueQty(qty);
      setPendingIssueReason(conditionTag === "damaged" ? "Damaged" : "Return");
      setIssueModalOpen(true);
      return;
    }
    const openQty = Number(selectedPoLine.remainingQty ?? 0);
    if (qty > openQty) {
      return setFormError(`Quantity exceeds remaining PO quantity (${openQty}).`);
    }
    appendManualQueueRow(matched, qty, unitValue);
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
  const queueTotalCost = queue.reduce((acc, row) => acc + Number(row.lineCost || 0), 0);
  const queuePageCount = Math.max(1, Math.ceil(queue.length / MANUAL_PAGE_SIZE));
  const pagedQueue = useMemo(() => {
    const start = (queuePage - 1) * MANUAL_PAGE_SIZE;
    return queue.slice(start, start + MANUAL_PAGE_SIZE);
  }, [queue, queuePage]);

  useEffect(() => {
    setQueuePage((prev) => Math.min(prev, queuePageCount));
  }, [queuePageCount]);

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
      await onReviewDone({
        sourceType: "manual",
        submitIntent,
        header: { supplier, receivedBy, receivedDate, location, attachmentPath, remarks },
        lineCount: queue.length,
        unitCount: queueTotalQty,
        totalCost: queueTotalCost,
        queue,
        workflowStatus: submitIntent === "draft" ? "Draft" : "Pending Approval",
      });
      setQueue([]);
      setStep("entry");
      setSelectedPoLineId("");
      setSkuValue("");
      setItemName("");
      setItemNameLocked(false);
      setQuantity("");
      setUnit("");
      setBaseUnit("");
      setLocation("");
      setReceivedDate("");
      setSupplier("");
      setDeliveryBy("");
      setUnitCost("");
      setRemarks("");
      setConditionTag("received");
      setAttachmentPath("");
      setAttachmentMsg("");
      setFormError("");
      setReviewError("");
      setDraftMsg("");
      try {
        window.localStorage.removeItem(draftStorageKey("manual"));
      } catch {
        // ignore storage errors
      }
      onClose();
    } catch (e) {
      const message = getErrorMessage(e);
      setReviewError(message);
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (queue.length > 0) {
      setSaving(true);
      try {
        await handleReviewDone("draft");
        setDraftMsg("Draft saved.");
      } finally {
        setSaving(false);
      }
      return;
    }
    try {
      window.localStorage.setItem(draftStorageKey("manual"), JSON.stringify({ queue, savedAt: new Date().toISOString() }));
      setDraftMsg("Draft saved.");
    } catch {
      setDraftMsg("Unable to save draft on this browser.");
    }
  };

  if (!open) return null;

  return (
    <div
      className={
        inline
          ? "w-full h-full min-h-0"
          : "fixed inset-0 z-[90] flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-md"
      }
      role="dialog"
      aria-modal={inline ? undefined : "true"}
      aria-labelledby="manual-entry-title"
      onClick={inline ? undefined : (e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={
          inline
            ? `w-full h-full min-h-0 overflow-hidden flex flex-col md:flex-row ${WHITE_FIELD_THEME}`
            : `bg-surface-container-lowest w-full max-w-6xl max-h-[min(880px,94vh)] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-outline-variant/20 ${WHITE_FIELD_THEME}`
        }
        onClick={inline ? undefined : (e) => e.stopPropagation()}
      >
        {step === "review" ? (
          <div className={`flex-1 ${dense ? "p-2" : inlineTight ? "p-3" : "p-8"} overflow-y-auto min-h-0`}>
            <h2
              id="manual-entry-title"
              className={`${dense ? "text-base" : inlineTight ? "text-lg" : "text-2xl"} font-headline font-extrabold text-on-surface tracking-tight`}
            >
              Review receive entries
            </h2>
            <p className="text-sm text-on-surface-variant mt-1 mb-5">
              {queue.length} line{queue.length === 1 ? "" : "s"} · {queueTotalQty} unit{queueTotalQty === 1 ? "" : "s"} total
            </p>
            <div className="rounded-2xl border border-outline-variant/20 overflow-hidden">
              <div className="overflow-x-auto max-h-[min(360px,50vh)] overflow-y-auto">
                <table className="w-full text-left text-sm min-w-[720px]">
                  <thead className="sticky top-0 bg-surface-container-high/90">
                    <tr>
                      <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">SKU</th>
                      <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">Item</th>
                      <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">Description</th>
                      <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">UOM</th>
                      <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant">Qty</th>
                      <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant text-right">Unit Cost</th>
                      <th className="px-3 py-3 text-[10px] uppercase text-on-surface-variant text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {queue.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-3 font-medium">{row.sku}</td>
                        <td className="px-3 py-3 text-on-surface-variant">{row.itemName}</td>
                        <td className="px-3 py-3 text-xs text-on-surface-variant">{row.description || "—"}</td>
                        <td className="px-3 py-3 text-xs text-on-surface-variant">{row.unit}</td>
                        <td className="px-3 py-3 font-semibold">{row.quantity}</td>
                        <td className="px-3 py-3 text-right">{Number(row.unitCost || 0).toFixed(2)}</td>
                        <td className="px-3 py-3 text-right font-semibold">{Number(row.lineCost || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-container-high/40">
                      <td className="px-3 py-2 font-semibold text-xs" colSpan={2}>
                        Totals
                      </td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 font-semibold">{queueTotalQty}</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right font-semibold">{queueTotalCost.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            {reviewError ? <p className="mt-4 text-sm text-red-600 dark:text-red-400 font-medium">{reviewError}</p> : null}
            {draftMsg ? <p className="mt-2 text-xs text-on-surface-variant">{draftMsg}</p> : null}
            <div className={`${dense ? "mt-2" : "mt-8"} flex flex-wrap gap-2 justify-end`}>
              <button type="button" onClick={handleSaveDraft} disabled={saving} className={`${dense ? "h-8 px-4" : "px-8 py-3.5"} rounded-full font-bold text-sm bg-surface-container-high text-on-surface`}>
                Save
              </button>
              <button type="button" onClick={() => setStep("entry")} disabled={saving} className={`${dense ? "h-8 px-4" : "px-8 py-3.5"} rounded-full font-bold text-sm bg-secondary-container text-on-secondary-container`}>
                Edit queue
              </button>
              <button
                type="button"
                onClick={handleReviewDone}
                disabled={saving}
                className={`${dense ? "h-8 px-5" : "px-10 py-3.5"} rounded-full font-bold text-sm bg-gradient-to-r from-primary to-primary-container text-on-primary disabled:opacity-50`}
              >
                {saving ? "Saving..." : workflowActionLabel()}
              </button>
            </div>
          </div>
        ) : (
          <div className={`flex-1 ${dense ? "p-1.5" : inlineTight ? "p-2" : "p-2"} overflow-hidden min-h-0 flex flex-col`}>
              {formError ? <p className="mb-1.5 text-xs text-red-600 dark:text-red-400 font-medium">{formError}</p> : null}
              <div className="mt-1 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.05)] flex-1 min-h-0 flex flex-col">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary/60">Manual Input Preview Table</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{queue.length} items</span>
                </div>
                <div className="mb-1.5 grid grid-cols-1 gap-1 md:grid-cols-4">
                  <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                    <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Supplier</label>
                    <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px] focus:ring-1 focus:ring-primary/20" />
                  </div>
                  <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                    <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Location</label>
                    <input
                      value={location}
                      readOnly
                      className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px] text-slate-800 focus:ring-1 focus:ring-primary/20"
                      placeholder="Auto-filled from selected PO"
                    />
                  </div>
                  <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                    <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Received Date</label>
                    <input value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} type="date" className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px] focus:ring-1 focus:ring-primary/20" />
                  </div>
                  <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
                    <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Received By</label>
                    <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px] focus:ring-1 focus:ring-primary/20" />
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-slate-200">
                  <div className="h-full min-h-[260px] overflow-x-auto overflow-y-hidden">
                  <table className="w-full min-w-[920px] table-fixed text-left text-[10px]">
                    <thead className="sticky top-0 z-10 bg-slate-100">
                      <tr>
                        <th className="w-[18%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">SKU-Code</th>
                        <th className="w-[18%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Item Name</th>
                        <th className="w-[18%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Item Description</th>
                        <th className="w-[8%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">UOM</th>
                        <th className="w-[8%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Quantity</th>
                        <th className="w-[10%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant">Unit Cost</th>
                        <th className="w-[10%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-right">Cost</th>
                        <th className="w-[10%] px-2 py-1.5 text-[9px] uppercase text-on-surface-variant text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 bg-white">
                      {pagedQueue.map((row) => (
                        <tr key={row.id}>
                          <td className="truncate px-2 py-1 font-medium">{row.sku}</td>
                          <td className="truncate px-2 py-1">{row.itemName}</td>
                          <td className="truncate px-2 py-1">{row.description || "—"}</td>
                          <td className="px-2 py-1">{row.unit}</td>
                          <td className="px-2 py-1 text-center font-semibold">{row.quantity}</td>
                          <td className="px-2 py-1">{Number(row.unitCost || 0).toFixed(2)}</td>
                          <td className="px-2 py-1 text-right font-semibold">{Number(row.lineCost || 0).toFixed(2)}</td>
                          <td className="px-2 py-1 text-center">
                            <button type="button" onClick={() => removeQueueLine(row.id)} className="rounded-full p-0.5 hover:bg-slate-100" aria-label={`Remove ${row.sku}`}>
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50/70">
                        <td className="px-1.5 py-1">
                          <select
                            value={selectedPoLineId}
                            onChange={(e) => handleSelectPoLine(e.target.value)}
                            onKeyDown={handleManualEntryKeyDown}
                            className="h-6 w-full appearance-none rounded-md border-none bg-white px-1.5 text-[10px] text-slate-900 focus:ring-1 focus:ring-primary/20"
                          >
                            <option value="">{poLoading ? "Loading..." : "Select PO/SKU..."}</option>
                            {selectedPoLineId && !availablePoLines.some((line) => String(line.lineId) === String(selectedPoLineId)) ? (
                              <option value={selectedPoLineId}>
                                {String(skuValue || "").trim() || String(itemName || "").trim() || "Selected item"}
                              </option>
                            ) : null}
                            {selectablePoLines.map((line) => (
                              <option key={line.lineId} value={String(line.lineId)}>
                                {String(line.sku || "").trim() || String(line.itemName || "").trim() || "No SKU"}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1.5 py-1">
                          <input value={itemName} readOnly onKeyDown={handleManualEntryKeyDown} className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                        </td>
                        <td className="px-1.5 py-1">
                          <input value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} onKeyDown={handleManualEntryKeyDown} className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px] focus:ring-1 focus:ring-primary/20" />
                        </td>
                        <td className="px-1.5 py-1 text-center">
                          <input
                            value={unit}
                            readOnly
                            onKeyDown={handleManualEntryKeyDown}
                            className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px] text-slate-800 focus:ring-1 focus:ring-primary/20"
                          />
                        </td>
                        <td className="px-1.5 py-1">
                          <input value={quantity} readOnly onKeyDown={handleManualEntryKeyDown} className="h-6 w-full rounded-md border-none bg-white px-1.5 text-center text-[10px]" />
                        </td>
                        <td className="px-1.5 py-1">
                          <input value={unitCost} readOnly onKeyDown={handleManualEntryKeyDown} className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                        </td>
                        <td className="px-1.5 py-1 text-right font-semibold">{(Number(quantity || 0) * Number(unitCost || 0)).toFixed(2)}</td>
                        <td className="px-1.5 py-1 text-center text-[9px] font-semibold text-primary/80">
                          Enter
                        </td>
                      </tr>
                      {Array.from({ length: Math.max(0, MANUAL_PAGE_SIZE - pagedQueue.length - 1) }).map((_, idx) => (
                        <tr key={`empty-row-${idx}`} className="bg-white">
                          <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1 text-right text-[10px] text-slate-300">—</td>
                          <td className="px-2 py-1"></td>
                        </tr>
                      ))}
                    </tbody>
                    {queue.length > 0 ? (
                      <tfoot>
                        <tr className="sticky bottom-0 z-10 bg-slate-700 text-white">
                          <td className="px-2 py-1.5 text-[10px] font-semibold" colSpan={4}>
                            Totals
                          </td>
                          <td className="px-2 py-1.5 text-center font-semibold">{queueTotalQty}</td>
                          <td className="px-2 py-1.5"></td>
                          <td className="px-2 py-1.5 text-right font-semibold">{queueTotalCost.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() => setQueue([])}
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
                      Total Quantity: <span className="font-semibold text-on-surface">{queueTotalQty} units</span>
                    </span>
                    {queue.length > MANUAL_PAGE_SIZE ? (
                      <div className="flex items-center gap-1 text-[9px]">
                        <button
                          type="button"
                          onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                          disabled={queuePage <= 1}
                          className="h-5 rounded-md bg-slate-100 px-1.5 font-semibold text-slate-700 disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <span className="text-on-surface-variant">
                          Page {queuePage} of {queuePageCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQueuePage((p) => Math.min(queuePageCount, p + 1))}
                          disabled={queuePage >= queuePageCount}
                          className="h-5 rounded-md bg-slate-100 px-1.5 font-semibold text-slate-700 disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Attachment</label>
                    <input
                      className="h-5 rounded-md border-none bg-slate-100 px-1.5 text-[9px]"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
                      disabled={uploadingAttachment}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleAttachmentSelect(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleReviewDone("submit")}
                      disabled={queue.length === 0 || saving}
                      className="h-6 rounded-full bg-primary px-2.5 text-[9px] font-bold text-white disabled:opacity-45"
                    >
                      {saving ? "Submitting..." : `${workflowActionLabel()} (${queue.length})`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
        )}
      </div>
      <TagIssueModal
        open={issueModalOpen}
        maxQty={pendingIssueQty}
        defaultReason={pendingIssueReason}
        onClose={() => setIssueModalOpen(false)}
        onConfirm={(issueInfo) => {
          if (!pendingAddPayload) return;
          appendManualQueueRow(
            pendingAddPayload.matched,
            pendingAddPayload.qty,
            pendingAddPayload.unitValue,
            issueInfo
          );
          setIssueModalOpen(false);
          setPendingAddPayload(null);
        }}
      />
    </div>
  );
}

export function BatchUploadModal({ open, onClose, onReviewDone, inline = false, compact = false }) {
  const dense = compact;
  const inlineTight = inline && !compact;
  useModalA11y(open, onClose);
  const { user, profile, role } = useAuth();
  const [receivedDate, setReceivedDate] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [supplier, setSupplier] = useState("");
  const [deliveryBy, setDeliveryBy] = useState("");
  const [attachmentPath, setAttachmentPath] = useState("");
  const [attachMsg, setAttachMsg] = useState("");
  const [rows, setRows] = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [csvMsg, setCsvMsg] = useState("");
  const [formError, setFormError] = useState("");
  const [draftMsg, setDraftMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [inventoryBySku, setInventoryBySku] = useState(new Map());

  useEffect(() => {
    if (!open) return;
    setReceivedDate("");
    setReceivedBy(buildReceivedByDefault(profile, user));
    setSupplier("");
    setDeliveryBy("");
    setAttachmentPath("");
    setAttachMsg("");
    setRows([]);
    setRowErrors([]);
    setCsvMsg("");
    setFormError("");
    setDraftMsg("");
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
    try {
      const raw = window.localStorage.getItem(draftStorageKey("batch"));
      if (raw) {
        const parsed = JSON.parse(raw);
        setRows(Array.isArray(parsed?.rows) ? parsed.rows : []);
      }
    } catch {
      // ignore bad draft
    }
  }, [open, profile, user]);

  const validateRows = (sourceRows) => {
    const normalizedRows = [];
    const errors = [];
    sourceRows.forEach((source, idx) => {
      const sku = String(valueFromRow(source, ["sku", "sku code", "sku_code"])).trim();
      const itemName = String(valueFromRow(source, ["item name", "item", "name"])).trim();
      const quantityRaw = valueFromRow(source, ["quantity", "qty"]);
      const unitCostRaw = valueFromRow(source, ["unit cost", "unit_cost", "price"]);
      const location = String(valueFromRow(source, ["location", "storage", "warehouse", "location/storage/warehouse"])).trim();
      const description = String(valueFromRow(source, ["description", "desc"])).trim();
      const conditionTag = String(valueFromRow(source, ["condition", "status", "tag"])).trim().toLowerCase() || "received";
      const remarks = String(valueFromRow(source, ["remarks", "comment", "comments", "notes"])).trim();
      const quantity = Number(quantityRaw);
      const unitCost = Number(unitCostRaw || 0);
      const rowIssues = [];
      if (!sku) rowIssues.push("SKU is required.");
      if (!itemName) rowIssues.push("Item Name is required.");
      if (!Number.isFinite(quantity) || quantity <= 0) rowIssues.push("Quantity must be > 0.");
      if (!location) rowIssues.push("Location is required.");
      if (!["received", "damaged", "returned"].includes(conditionTag)) {
        rowIssues.push("Condition must be received/damaged/returned.");
      }
      if ((conditionTag === "damaged" || conditionTag === "returned") && !remarks) {
        rowIssues.push("Remarks are required for damaged/returned rows.");
      }
      const matched = inventoryBySku.get(sku.toLowerCase());
      if (!matched?.id) rowIssues.push("SKU not found in inventory items.");
      normalizedRows.push({
        id: crypto.randomUUID(),
        sourceIndex: idx + 2,
        sku,
        itemName,
        quantity,
        unitCost: Number.isFinite(unitCost) ? unitCost : 0,
        lineCost: quantity * (Number.isFinite(unitCost) ? unitCost : 0),
        location,
        description,
        conditionTag,
        remarks,
        matched,
      });
      if (rowIssues.length > 0) errors.push(`Row ${idx + 2}: ${rowIssues.join(" ")}`);
    });
    return { normalizedRows, errors };
  };

  const handleTemplateUpload = async (file) => {
    setCsvMsg("");
    setFormError("");
    if (!file) return;
    setBusy(true);
    try {
      const parsedRows = await parseBatchFile(file);
      const { normalizedRows, errors } = validateRows(parsedRows);
      setRows(normalizedRows);
      setRowErrors(errors);
      setCsvMsg(`Loaded ${normalizedRows.length} row(s).`);
    } catch (e) {
      setRows([]);
      setRowErrors([]);
      setCsvMsg(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAttachmentUpload = async (file) => {
    setAttachMsg("");
    if (!user?.id || !file) return;
    setBusy(true);
    try {
      const { path } = await uploadAttachment(user.id, file, "receive-docs");
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
    if (!receivedBy.trim()) return setFormError("Received By is required.");
    if (!receivedDate) return setFormError("Received Date is required.");
    if (rows.length === 0) return setFormError("Upload a CSV or Excel file with rows.");
    if (rowErrors.length > 0) return setFormError("Fix row validation errors before confirming.");
    const queue = rows.map((row) => ({
      id: row.id,
      itemId: row.matched.id,
      sku: row.sku,
      itemName: row.itemName || row.matched.name || row.sku,
      quantity: row.quantity,
      unit: String(row.matched.unit_of_measure || "unit").trim() || "unit",
      location: row.location,
      description: row.description || "",
      unitCost: Number(row.unitCost || 0),
      lineCost: Number(row.lineCost || 0),
      remarks: row.remarks || "",
      conditionTag: row.conditionTag || "received",
      workflowStatus: workflowStatusForRole(),
      receivedDate,
      receivedBy: receivedBy.trim(),
      supplier: supplier.trim(),
      supplierName: supplier.trim(),
      deliveryBy: deliveryBy.trim(),
      attachmentPath: attachmentPath || "",
    }));
    setBusy(true);
    try {
      const totalUnits = queue.reduce((acc, row) => acc + Number(row.quantity || 0), 0);
      const totalCost = queue.reduce((acc, row) => acc + Number(row.lineCost || 0), 0);
      await onReviewDone?.({
        sourceType: "batch",
        submitIntent,
        header: { supplier, receivedBy, receivedDate, location: "", attachmentPath, remarks: "" },
        lineCount: queue.length,
        unitCount: totalUnits,
        totalCost,
        queue,
        workflowStatus: submitIntent === "draft" ? "Draft" : "Pending Approval",
      });
      setRows([]);
      setRowErrors([]);
      setCsvMsg("");
      setAttachmentPath("");
      setAttachMsg("");
      setFormError("");
      setDraftMsg("");
      try {
        window.localStorage.removeItem(draftStorageKey("batch"));
      } catch {
        // ignore storage errors
      }
      onClose();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    if (rows.length > 0) {
      setBusy(true);
      try {
        await handleConfirm("draft");
        setDraftMsg("Draft saved.");
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      window.localStorage.setItem(draftStorageKey("batch"), JSON.stringify({ rows, receivedDate, receivedBy, supplier, deliveryBy, savedAt: new Date().toISOString() }));
      setDraftMsg("Draft saved.");
    } catch {
      setDraftMsg("Unable to save draft on this browser.");
    }
  };

  if (!open) return null;

  return (
    <div
      className={
        inline
          ? "w-full"
          : "fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/30 backdrop-blur-md px-4"
      }
      role="dialog"
      aria-modal={inline ? undefined : "true"}
      aria-labelledby="batch-upload-title"
      onClick={inline ? undefined : (e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={
          inline
            ? `w-full h-full min-h-0 overflow-hidden flex flex-col ${WHITE_FIELD_THEME}`
            : `bg-surface-container-lowest w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden border border-white/50 flex flex-col max-h-[min(921px,92vh)] ${WHITE_FIELD_THEME}`
        }
        onClick={inline ? undefined : (e) => e.stopPropagation()}
      >
        <div
          className={`${
            dense ? "px-2 py-2" : inlineTight ? "px-2.5 py-2" : "px-6 py-5"
          } flex justify-between items-center bg-surface-bright/50 border-b border-surface-variant/20 gap-3 shrink-0`}
        >
          <h2
            id="batch-upload-title"
            className={`${dense ? "text-base" : inlineTight ? "text-base" : "text-2xl"} font-black font-manrope tracking-tight text-primary`}
          >
            Batch Upload
          </h2>
          {!inline ? (
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-high transition-colors shrink-0" aria-label="Close">
              <span className="material-symbols-outlined text-on-surface-variant">close</span>
            </button>
          ) : null}
        </div>
        <div className={`flex-1 overflow-y-auto min-h-0 ${dense ? "px-2 py-2" : inlineTight ? "px-2.5 py-2" : "px-6 py-5"}`}>
          {formError ? <p className="mb-3 text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
          {draftMsg ? <p className="mb-3 text-xs text-on-surface-variant">{draftMsg}</p> : null}
          <div className={`rounded-lg border border-outline-variant/20 bg-surface ${inlineTight ? "p-1.5" : "p-2"} space-y-1 mb-2`}>
            <label className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-widest text-on-surface-variant`}>File Upload (CSV/Excel)</label>
            <input
              className={`w-full ${inlineTight ? "h-7 text-xs" : "h-8 text-sm"} bg-surface-container-highest border-none rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-primary/20`}
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleTemplateUpload(f);
                e.target.value = "";
              }}
            />
            {csvMsg ? <p className="text-xs text-on-surface-variant">{csvMsg}</p> : null}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-2 mb-2">
            <section className={`rounded-lg border border-outline-variant/20 bg-surface ${inlineTight ? "p-1.5" : "p-2"} space-y-1.5`}>
              <h3 className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-bold uppercase tracking-[0.16em] text-primary/60`}>Receiving Details</h3>
              <div className="space-y-1">
                <label className={`${inlineTight ? "text-[9px]" : "text-[10px]"} font-semibold uppercase tracking-widest text-on-surface-variant`}>Received Date</label>
                <input value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={`w-full ${inlineTight ? "h-7 text-xs" : "h-8 text-sm"} bg-surface-container-highest border-none rounded-lg px-2.5 focus:ring-2 focus:ring-primary/20`} type="date" />
              </div>
              <div className="space-y-1">
                <label className={`${inlineTight ? "text-[9px]" : "text-[10px]"} font-semibold uppercase tracking-widest text-on-surface-variant`}>Received By</label>
                <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className={`w-full ${inlineTight ? "h-7 text-xs" : "h-8 text-sm"} bg-surface-container-highest border-none rounded-lg px-2.5 focus:ring-2 focus:ring-primary/20`} type="text" />
              </div>
            </section>

            <section className={`rounded-lg border border-outline-variant/20 bg-surface ${inlineTight ? "p-1.5" : "p-2"} space-y-1.5`}>
              <h3 className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-bold uppercase tracking-[0.16em] text-primary/60`}>Supplier & Delivery</h3>
              <div className="space-y-1">
                <label className={`${inlineTight ? "text-[9px]" : "text-[10px]"} font-semibold uppercase tracking-widest text-on-surface-variant`}>Supplier (Optional)</label>
                <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`w-full ${inlineTight ? "h-7 text-xs" : "h-8 text-sm"} bg-surface-container-highest border-none rounded-lg px-2.5 focus:ring-2 focus:ring-primary/20`} type="text" />
              </div>
              <div className="space-y-1">
                <label className={`${inlineTight ? "text-[9px]" : "text-[10px]"} font-semibold uppercase tracking-widest text-on-surface-variant`}>Delivery By (Optional)</label>
                <input value={deliveryBy} onChange={(e) => setDeliveryBy(e.target.value)} className={`w-full ${inlineTight ? "h-7 text-xs" : "h-8 text-sm"} bg-surface-container-highest border-none rounded-lg px-2.5 focus:ring-2 focus:ring-primary/20`} type="text" />
              </div>
            </section>

            <section className={`rounded-lg border border-outline-variant/20 bg-surface ${inlineTight ? "p-1.5" : "p-2"} space-y-1.5`}>
              <h3 className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-bold uppercase tracking-[0.16em] text-primary/60`}>Documents</h3>
              <div className="space-y-1">
                <label className={`${inlineTight ? "text-[9px]" : "text-[10px]"} font-semibold uppercase tracking-widest text-on-surface-variant`}>Attachment (Optional)</label>
                <input
                  className={`w-full ${inlineTight ? "h-7 text-xs" : "h-8 text-sm"} bg-surface-container-highest border-none rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-primary/20`}
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

          <div className="space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className={`${inlineTight ? "text-[10px]" : "text-[11px]"} font-bold uppercase tracking-[0.16em] text-primary/60`}>Review Uploaded Items</h3>
              <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-black uppercase rounded-full">
                {rowErrors.length > 0 ? "Has Errors" : "Ready"}
              </span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-surface-variant/30 overflow-x-auto">
              <table className={`w-full text-left ${inlineTight ? "text-xs" : "text-sm"} min-w-[620px]`}>
                <thead className={`bg-surface-container-high text-on-surface-variant font-bold ${inlineTight ? "text-[9px]" : "text-[10px]"} uppercase tracking-wider`}>
                  <tr>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Unit Cost</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-variant/10 bg-surface-container-low/30">
                  {rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-on-surface-variant" colSpan={7}>
                        Upload a file to preview and validate rows.
                      </td>
                    </tr>
                  ) : (
                    rows.slice(0, 50).map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-mono text-primary font-medium">{row.sku}</td>
                        <td className="px-4 py-3">{row.itemName}</td>
                        <td className="px-4 py-3 text-right">{row.quantity}</td>
                        <td className="px-4 py-3">{row.location}</td>
                        <td className="px-4 py-3">{row.matched?.id ? "OK" : "Unknown SKU"}</td>
                        <td className="px-4 py-3 text-right">{Number(row.unitCost || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{Number(row.lineCost || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {rows.length > 0 ? (
                  <tfoot>
                    <tr className="bg-surface-container-high/30">
                      <td className="px-4 py-2 font-semibold text-xs" colSpan={2}>
                        Totals
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {rows.reduce((acc, row) => acc + Number(row.quantity || 0), 0)}
                      </td>
                      <td className="px-4 py-2" colSpan={2}></td>
                      <td className="px-4 py-2"></td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {rows.reduce((acc, row) => acc + Number(row.lineCost || 0), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
            {rows.length > 50 ? <p className="text-xs text-on-surface-variant italic">Showing first 50 of {rows.length} rows.</p> : null}
            {rowErrors.length > 0 ? (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 space-y-1 max-h-36 overflow-y-auto">
                {rowErrors.map((err) => (
                  <p key={err}>{err}</p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div
          className={`${
            dense ? "px-2 py-2" : inlineTight ? "px-2.5 py-2" : "px-6 py-5"
          } bg-surface-container-low border-t border-surface-variant/20 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 shrink-0`}
        >
          <button type="button" onClick={onClose} className={`text-on-surface-variant hover:text-on-surface font-bold text-sm ${dense ? "px-3 py-1.5" : "px-6 py-2"} transition-all`}>
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={handleSaveDraft} className={`${dense ? "h-8 px-4" : inlineTight ? "h-8 px-5" : "px-7 py-2.5"} rounded-full bg-surface-container-high text-on-surface font-bold text-sm disabled:opacity-50`}>
            Save
          </button>
          <button type="button" disabled={busy || rows.length === 0} onClick={handleConfirm} className={`${dense ? "h-8 px-5" : inlineTight ? "h-8 px-6" : "px-10 py-3"} rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-bold text-sm disabled:opacity-50`}>
            {busy ? "Processing..." : workflowActionLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}
