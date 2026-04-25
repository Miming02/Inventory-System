import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { NotificationBell } from "../../components/NotificationBell";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";
import { uploadAttachment } from "../../lib/storageUpload";

function formatMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(v);
}

function profileDisplayName(profile) {
  if (!profile) return "Inventory user";
  const firstName = String(profile.first_name || "").trim();
  const lastName = String(profile.last_name || "").trim();
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
  return profile.email || "Inventory user";
}

function poStatusMeta(status) {
  const s = String(status || "").toLowerCase();
  if (s === "draft") return { label: "Draft", className: "bg-slate-100 text-slate-700" };
  if (s === "sent") return { label: "Pending Approval", className: "bg-amber-100 text-amber-700" };
  if (s === "confirmed") return { label: "Approved", className: "bg-emerald-100 text-emerald-700" };
  if (s === "cancelled") return { label: "Rejected", className: "bg-rose-100 text-rose-700" };
  return { label: status || "Unknown", className: "bg-slate-100 text-slate-700" };
}

function buildPoNotes({ location, attachmentPath, remarks }) {
  const lines = [];
  if (location) lines.push(`Location: ${location}`);
  if (attachmentPath) lines.push(`Attachment: ${attachmentPath}`);
  if (remarks) lines.push(`Remarks: ${remarks}`);
  return lines.join("\n") || null;
}

function displayItemCode(item) {
  const sku = String(item?.sku || "").trim();
  const name = String(item?.name || "").trim();
  return sku || name || "No code";
}

function supplierLabel(supplier) {
  const name = String(supplier?.name || "").trim();
  if (name) return name;
  return `Supplier ${String(supplier?.id || "").slice(0, 8)}`;
}

function CreatePOPageForm({ supplierOptions, inventoryItemOptions, onCreated, createdByProfile }) {
  const PAGE_SIZE = 12;
  const [formData, setFormData] = useState({
    supplier: "",
    location: "",
    referenceNo: "",
    attachmentPath: "",
    items: [],
    expectedDate: "",
    remarks: "",
  });
  const [newItem, setNewItem] = useState({
    inventoryItemId: "",
    sku: "",
    name: "",
    description: "",
    unit: "",
    quantity: "",
    unitPrice: "",
  });
  const [submittingAction, setSubmittingAction] = useState("");
  const [attachmentMsg, setAttachmentMsg] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [itemError, setItemError] = useState("");
  const [itemsPage, setItemsPage] = useState(1);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierMenuOpen, setSupplierMenuOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [itemMenuOpen, setItemMenuOpen] = useState(false);
  const selectedSupplier = useMemo(
    () => (supplierOptions ?? []).find((s) => String(s.id) === String(formData.supplier)) || null,
    [supplierOptions, formData.supplier]
  );
  const selectedInventoryItem = useMemo(
    () => (inventoryItemOptions ?? []).find((item) => String(item.id) === String(newItem.inventoryItemId)) || null,
    [inventoryItemOptions, newItem.inventoryItemId]
  );

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    const selectedLabel = selectedSupplier ? supplierLabel(selectedSupplier).trim().toLowerCase() : "";
    if (q && selectedLabel && q === selectedLabel) return supplierOptions ?? [];
    if (!q) return supplierOptions ?? [];
    return (supplierOptions ?? []).filter((s) => supplierLabel(s).toLowerCase().includes(q));
  }, [supplierOptions, supplierQuery, selectedSupplier]);

  const filteredInventoryItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    const selectedCode = selectedInventoryItem ? displayItemCode(selectedInventoryItem).trim().toLowerCase() : "";
    if (q && selectedCode && q === selectedCode) return inventoryItemOptions ?? [];
    if (!q) return inventoryItemOptions ?? [];
    return (inventoryItemOptions ?? []).filter((item) => {
      const sku = String(item?.sku || "").toLowerCase();
      const name = String(item?.name || "").toLowerCase();
      return sku.includes(q) || name.includes(q);
    });
  }, [inventoryItemOptions, itemQuery, selectedInventoryItem]);

  useEffect(() => {
    const selected = (supplierOptions ?? []).find((s) => String(s.id) === String(formData.supplier));
    setSupplierQuery(selected ? supplierLabel(selected) : "");
  }, [formData.supplier, supplierOptions]);

  useEffect(() => {
    const selected = (inventoryItemOptions ?? []).find((item) => String(item.id) === String(newItem.inventoryItemId));
    setItemQuery(selected ? displayItemCode(selected) : "");
  }, [newItem.inventoryItemId, inventoryItemOptions]);

  const handleInventoryItemChange = (selectedId) => {
    const selectedItem = (inventoryItemOptions ?? []).find((item) => String(item.id) === String(selectedId));
    if (!selectedItem) {
      setNewItem((prev) => ({
        ...prev,
        inventoryItemId: "",
        sku: "",
        name: "",
        description: "",
        unit: "",
      }));
      return;
    }
    setNewItem((prev) => ({
      ...prev,
      inventoryItemId: String(selectedItem.id),
      sku: String(selectedItem.sku || "").trim(),
      name: selectedItem.name ?? "",
      description: "",
      unit: selectedItem.unit_of_measure ?? "unit",
      unitPrice: prev.unitPrice || String(selectedItem.unit_cost ?? ""),
    }));
  };

  const addItem = () => {
    setItemError("");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expected = formData.expectedDate ? new Date(`${formData.expectedDate}T00:00:00`) : null;
    if (!formData.supplier) return setItemError("Supplier is required before adding items.");
    if (!String(formData.location || "").trim()) return setItemError("Location is required before adding items.");
    if (!expected || Number.isNaN(expected.getTime())) return setItemError("Expected delivery date is required before adding items.");
    if (expected < today) return setItemError("Expected delivery date cannot be in the past.");
    const qty = Number(newItem.quantity);
    const price = Number(newItem.unitPrice);
    if (!newItem.inventoryItemId) return setItemError("Select an item first.");
    if (!Number.isFinite(qty) || qty <= 0) return setItemError("Quantity must be greater than 0.");
    if (!Number.isFinite(price) || price <= 0) return setItemError("Unit cost is required and must be greater than 0.");
    if (!String(newItem.unit || "").trim()) return setItemError("Unit is required.");

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...newItem,
          sku: String(newItem.sku || "").trim() || String(newItem.name || "").trim(),
          id: crypto.randomUUID(),
        },
      ],
    }));
    setItemsPage(Math.max(1, Math.ceil((formData.items.length + 1) / PAGE_SIZE)));
    setNewItem({ inventoryItemId: "", sku: "", name: "", description: "", unit: "", quantity: "", unitPrice: "" });
    setItemQuery("");
    setItemMenuOpen(false);
  };

  const handleManualEntryKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addItem();
  };

  const removeItem = (id) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  };

  const calculateTotalQty = () => {
    return formData.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  };

  const itemPageCount = Math.max(1, Math.ceil(formData.items.length / PAGE_SIZE));
  const pagedItems = useMemo(() => {
    const start = (itemsPage - 1) * PAGE_SIZE;
    return formData.items.slice(start, start + PAGE_SIZE);
  }, [formData.items, itemsPage]);

  useEffect(() => {
    setItemsPage((prev) => Math.min(prev, itemPageCount));
  }, [itemPageCount]);

  const resetForm = () => {
    setFormData({
      supplier: "",
      location: "",
      referenceNo: "",
      attachmentPath: "",
      items: [],
      expectedDate: "",
      remarks: "",
    });
    setNewItem({ inventoryItemId: "", sku: "", name: "", description: "", unit: "", quantity: "", unitPrice: "" });
    setAttachmentMsg("");
    setSubmitError("");
    setItemError("");
    setItemsPage(1);
    setSupplierQuery("");
    setSupplierMenuOpen(false);
    setItemQuery("");
    setItemMenuOpen(false);
  };

  const handleAttachmentSelect = async (file) => {
    if (!file || !createdByProfile?.id) return;
    try {
      const { path } = await uploadAttachment(createdByProfile.id, file, "po-docs");
      setFormData((prev) => ({ ...prev, attachmentPath: path }));
      setAttachmentMsg(`Uploaded: ${path}`);
    } catch (err) {
      setAttachmentMsg(getErrorMessage(err));
      setFormData((prev) => ({ ...prev, attachmentPath: "" }));
    }
  };

  const handleSubmit = async (e, submitIntent = "submit") => {
    e.preventDefault();
    setSubmitError("");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expected = formData.expectedDate ? new Date(`${formData.expectedDate}T00:00:00`) : null;
    if (!formData.supplier) {
      setSubmitError("Supplier is required.");
      return;
    }
    if (!expected || Number.isNaN(expected.getTime())) {
      setSubmitError("Expected delivery date is required.");
      return;
    }
    if (expected < today) {
      setSubmitError("Expected delivery date cannot be in the past.");
      return;
    }
    if (formData.items.length === 0) {
      setSubmitError("Add at least one item.");
      return;
    }

    setSubmittingAction(submitIntent);
    try {
      const poNumber = String(formData.referenceNo || "").trim() || `PO-${Date.now()}`;
      const totalAmount = calculateTotal();
      const status = submitIntent === "submit" ? "sent" : "draft";
      const { data: poRow, error: poErr } = await supabase
        .from("purchase_orders")
        .insert({
          po_number: poNumber,
          supplier_id: formData.supplier,
          status,
          expected_delivery_date: formData.expectedDate,
          total_amount: totalAmount,
          notes: buildPoNotes({
            location: String(formData.location || "").trim(),
            attachmentPath: String(formData.attachmentPath || "").trim(),
            remarks: String(formData.remarks || "").trim(),
          }),
          created_by: createdByProfile?.id || null,
        })
        .select("id,po_number,status")
        .single();
      if (poErr) throw poErr;

      const poId = poRow?.id;
      const rows = formData.items.map((item) => ({
        po_id: poId,
        item_id: item.inventoryItemId,
        quantity_ordered: Number(item.quantity),
        unit_price: Number(item.unitPrice),
        notes: String(item.description || "").trim() || null,
      }));
      const { error: itemErr } = await supabase.from("purchase_order_items").insert(rows);
      if (itemErr) throw itemErr;

      if (onCreated) {
        await onCreated({
          poId,
          poNumber: poRow?.po_number || poNumber,
          status: poRow?.status || status,
          itemCount: formData.items.length,
          totalAmount,
        });
      }
      resetForm();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
      return;
    } finally {
      setSubmittingAction("");
    }
  };

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between rounded-xl bg-primary px-3 py-2.5 text-white">
        <div>
          <h2 className="text-sm font-extrabold tracking-tight text-white font-headline">Create Purchase Order</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-3 h-full min-h-0 flex flex-col gap-2.5 overflow-hidden">
        <div className="mt-1 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.05)] flex-1 min-h-0 flex flex-col">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary/60">Manual Input Preview Table</h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {formData.items.length} items
            </span>
          </div>
          <div className="mb-1.5 grid grid-cols-1 gap-1 md:grid-cols-4">
            <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
              <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Supplier</label>
              <div className="relative">
                <input
                  value={supplierQuery}
                  onChange={(e) => {
                    setSupplierQuery(e.target.value);
                    setSupplierMenuOpen(true);
                    setFormData((prev) => ({ ...prev, supplier: "" }));
                  }}
                  onFocus={() => setSupplierMenuOpen(true)}
                  onBlur={() => window.setTimeout(() => setSupplierMenuOpen(false), 120)}
                  className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[11px] text-slate-900 focus:ring-1 focus:ring-primary/20"
                  placeholder="Select supplier"
                  required
                />
                <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-500">
                  expand_more
                </span>
                {supplierMenuOpen ? (
                  <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {filteredSuppliers.length ? (
                      filteredSuppliers.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={() => {
                            setFormData((prev) => ({ ...prev, supplier: String(s.id) }));
                            setSupplierQuery(supplierLabel(s));
                            setSupplierMenuOpen(false);
                          }}
                          className="w-full px-2 py-1 text-left text-[11px] text-slate-900 hover:bg-slate-100"
                        >
                          {supplierLabel(s)}
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-1 text-[11px] text-slate-500">No suppliers available</div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
              <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Location</label>
              <input
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px] focus:ring-1 focus:ring-primary/20"
                placeholder="Warehouse"
              />
            </div>
            <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
              <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Expected Date</label>
              <input
                type="date"
                value={formData.expectedDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, expectedDate: e.target.value }))}
                min={new Date().toISOString().split("T")[0]}
                className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px] focus:ring-1 focus:ring-primary/20"
                required
              />
            </div>
            <div className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50/70 p-1">
              <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Created By</label>
              <input value={profileDisplayName(createdByProfile)} readOnly className="h-5 w-full rounded-md border-none bg-white px-1.5 text-[10px] focus:ring-1 focus:ring-primary/20" />
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
                {pagedItems.map((item) => (
                  <tr key={item.id}>
                    <td className="truncate px-2 py-1 font-medium">{displayItemCode(item)}</td>
                    <td className="truncate px-2 py-1">{item.name || "—"}</td>
                    <td className="truncate px-2 py-1">{item.description || "—"}</td>
                    <td className="px-2 py-1">{item.unit || "unit"}</td>
                    <td className="px-2 py-1 text-center font-semibold">{item.quantity}</td>
                    <td className="px-2 py-1">{formatMoney(item.unitPrice)}</td>
                    <td className="px-2 py-1 text-right font-semibold">
                      {formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0))}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="rounded-full p-0.5 hover:bg-slate-100"
                        aria-label={`Remove ${item.name || "item"}`}
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50/70">
                  <td className="px-1.5 py-1">
                    <div className="relative">
                      <input
                        value={itemQuery}
                        onChange={(e) => {
                          setItemQuery(e.target.value);
                          setItemMenuOpen(true);
                          handleInventoryItemChange("");
                        }}
                        onFocus={() => setItemMenuOpen(true)}
                        onBlur={() => window.setTimeout(() => setItemMenuOpen(false), 120)}
                        onKeyDown={handleManualEntryKeyDown}
                        className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[11px] text-slate-900 focus:ring-1 focus:ring-primary/20"
                        placeholder="Select PO/SKU..."
                      />
                      <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-500">
                        expand_more
                      </span>
                      {itemMenuOpen ? (
                        <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                          {filteredInventoryItems.length ? (
                            filteredInventoryItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onMouseDown={() => {
                                  setItemQuery(displayItemCode(item));
                                  handleInventoryItemChange(String(item.id));
                                  setItemMenuOpen(false);
                                }}
                                className="w-full px-2 py-1 text-left text-[11px] text-slate-900 hover:bg-slate-100"
                              >
                                {displayItemCode(item)}
                              </button>
                            ))
                          ) : (
                            <div className="px-2 py-1 text-[11px] text-slate-500">No inventory items available</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-1.5 py-1">
                    <input value={newItem.name} readOnly onKeyDown={handleManualEntryKeyDown} className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      value={newItem.description}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
                      onKeyDown={handleManualEntryKeyDown}
                      className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px] focus:ring-1 focus:ring-primary/20"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input value={newItem.unit} readOnly onKeyDown={handleManualEntryKeyDown} className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px]" />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, quantity: e.target.value }))}
                      onKeyDown={handleManualEntryKeyDown}
                      className="h-6 w-full rounded-md border-none bg-white px-1.5 text-center text-[10px] focus:ring-1 focus:ring-primary/20"
                      placeholder="0"
                      required
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={newItem.unitPrice}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, unitPrice: e.target.value }))}
                      onKeyDown={handleManualEntryKeyDown}
                      className="h-6 w-full rounded-md border-none bg-white px-1.5 text-[10px] focus:ring-1 focus:ring-primary/20"
                      placeholder="0.00"
                      required
                    />
                  </td>
                  <td className="px-1.5 py-1 text-right font-semibold">
                    {formatMoney(Number(newItem.quantity || 0) * Number(newItem.unitPrice || 0))}
                  </td>
                  <td className="px-1.5 py-1 text-center text-[9px] font-semibold text-primary/80">Enter</td>
                </tr>
                {Array.from({ length: Math.max(0, PAGE_SIZE - pagedItems.length - 1) }).map((_, idx) => (
                  <tr key={`po-empty-row-${idx}`} className="bg-white">
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
              {formData.items.length > 0 ? (
                <tfoot>
                    <tr className="sticky bottom-0 z-10 bg-slate-700 text-white">
                    <td className="px-2 py-1.5 text-[10px] font-semibold" colSpan={4}>
                      Totals
                    </td>
                    <td className="px-2 py-1.5 text-center font-semibold">{calculateTotalQty()}</td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5 text-right font-semibold">{formatMoney(calculateTotal())}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, items: [] }))}
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
          {itemError ? <p className="mt-1 text-[10px] font-medium text-red-600">{itemError}</p> : null}
          <div className="mt-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-on-surface-variant">
                Total Quantity: <span className="font-semibold text-on-surface">{calculateTotalQty()} units</span>
              </span>
              {formData.items.length > PAGE_SIZE ? (
                <div className="flex items-center gap-1 text-[9px]">
                  <button
                    type="button"
                    onClick={() => setItemsPage((p) => Math.max(1, p - 1))}
                    disabled={itemsPage <= 1}
                    className="h-5 rounded-md bg-slate-100 px-1.5 font-semibold text-slate-700 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="text-on-surface-variant">
                    Page {itemsPage} of {itemPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setItemsPage((p) => Math.min(itemPageCount, p + 1))}
                    disabled={itemsPage >= itemPageCount}
                    className="h-5 rounded-md bg-slate-100 px-1.5 font-semibold text-slate-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Reference No</label>
              <input
                value={formData.referenceNo}
                onChange={(e) => setFormData((prev) => ({ ...prev, referenceNo: e.target.value }))}
                className="h-5 rounded-md border-none bg-slate-100 px-1.5 text-[9px]"
                placeholder="Auto if empty"
              />
              <label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Attachment</label>
              <input
                className="h-5 rounded-md border-none bg-slate-100 px-1.5 text-[9px]"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAttachmentSelect(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={(e) => void handleSubmit(e, "submit")}
                disabled={Boolean(submittingAction) || formData.items.length === 0}
                className="h-6 rounded-full bg-primary px-2.5 text-[9px] font-bold text-white disabled:opacity-45"
              >
                {submittingAction === "submit" ? "Submitting..." : `Submit for Approval (${formData.items.length})`}
              </button>
            </div>
          </div>
          {attachmentMsg ? <p className="mt-1 text-[10px] text-on-surface-variant">{attachmentMsg}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Remarks</label>
          <textarea
            value={formData.remarks}
            onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
            placeholder="Additional notes or instructions..."
            rows={1}
            className="w-full rounded-lg border-none bg-surface-container-highest px-3 py-2 text-xs transition-all resize-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {submitError ? (
          <div className="rounded-xl border border-error/30 bg-error-container/30 px-3 py-2 text-xs text-on-surface">
            {submitError}
          </div>
        ) : null}
      </form>
    </div>
  );
}

export default function PurchaseOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, role } = useAuth();
  const [poSuccess, setPoSuccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [supplierRows, setSupplierRows] = useState([]);
  const [inventoryItemOptions, setInventoryItemOptions] = useState([]);
  const [poRows, setPoRows] = useState([]);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("create");
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [supRes, inventoryRes, poRes] = await Promise.all([
        supabase.from("suppliers").select("id, name, email, phone").order("name"),
        supabase
          .from("inventory_items")
          .select("id, sku, name, unit_cost, unit_of_measure")
          .neq("is_active", false)
          .order("name")
          .limit(500),
        supabase
          .from("purchase_orders")
          .select("id,po_number,status,created_at,supplier_id,expected_delivery_date,total_amount,suppliers(name)")
          .order("created_at", { ascending: false })
          .limit(40),
      ]);
      if (supRes.error) throw supRes.error;
      if (inventoryRes.error) throw inventoryRes.error;
      if (poRes.error) throw poRes.error;
      setSupplierRows(supRes.data ?? []);
      setInventoryItemOptions(inventoryRes.data ?? []);
      setPoRows(poRes.data ?? []);
    } catch (e) {
      setLoadError(getErrorMessage(e));
      setSupplierRows([]);
      setInventoryItemOptions([]);
      setPoRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!poSuccess) return undefined;
    const t = window.setTimeout(() => setPoSuccess(null), 5000);
    return () => window.clearTimeout(t);
  }, [poSuccess]);

  const supplierOptions = useMemo(
    () => supplierRows.map((s) => ({ id: s.id, name: s.name })),
    [supplierRows]
  );

  return (
    <div className="min-h-dvh overflow-hidden bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed pb-0">
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

      <main className="mx-auto w-full max-w-[1500px] px-2 pb-4 pt-[4.2rem] sm:px-3 lg:px-4">
        <section className="relative rounded-2xl border border-outline-variant/20 bg-white p-2 sm:p-3">
          <Link
            to="/dashboard"
            className="absolute right-3 top-[0.85rem] z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-all hover:bg-white/20"
            aria-label="Close"
            title="Close"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </Link>
          {loadError ? (
            <div className="mb-3 rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-on-surface">
              {loadError}
            </div>
          ) : null}
          {loading ? (
            <div className="rounded-xl border border-outline-variant/15 bg-white/80 px-4 py-3 text-sm text-on-surface-variant">
              Loading suppliers and items...
            </div>
          ) : (
            <div className="h-full min-h-0 overflow-hidden">
              <CreatePOPageForm
                supplierOptions={supplierOptions}
                inventoryItemOptions={inventoryItemOptions}
                createdByProfile={profile}
                onCreated={async (created) => {
                  await loadData();
                  if (created?.poNumber) setPoSuccess(created);
                }}
              />
            </div>
          )}
        </section>
      </main>

      {poSuccess ? (
        <div className="fixed bottom-6 left-1/2 z-[120] w-[min(100%-2rem,560px)] -translate-x-1/2 pointer-events-auto">
          <div className="flex items-start gap-3 rounded-3xl border border-green-200/80 bg-white/95 p-4 pr-3 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.2)] backdrop-blur-xl">
            <div className="shrink-0 rounded-2xl bg-green-50 p-2">
              <span className="material-symbols-outlined text-2xl text-green-700">check_circle</span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-headline text-sm font-bold text-on-surface">
                {String(poSuccess.status || "").toLowerCase() === "sent" ? "Purchase order submitted for approval" : "Purchase order saved as draft"}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {poSuccess.poNumber} · {poSuccess.itemCount} item{poSuccess.itemCount === 1 ? "" : "s"}
              </p>
              {String(poSuccess.status || "").toLowerCase() === "confirmed" && poSuccess.poId ? (
                <Link to={`/receive?po=${poSuccess.poId}`} className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline">
                  Confirm delivery now
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setPoSuccess(null)}
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
