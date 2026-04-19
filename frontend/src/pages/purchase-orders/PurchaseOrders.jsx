import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";

function headerUserLabel(p) {
  if (!p) return "";
  const fn = (p.first_name || "").trim();
  const ln = (p.last_name || "").trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
  return p.email || "";
}

/** @param {string | null | undefined} status */
function statusBadgeClass(status) {
  const s = (status || "").toLowerCase();
  if (s === "draft" || s === "sent") return "text-tertiary bg-tertiary-fixed";
  if (s === "confirmed") return "text-primary bg-primary-fixed";
  if (s === "received") return "text-secondary bg-secondary-fixed";
  if (s === "cancelled") return "text-error bg-error-container";
  return "text-on-surface-variant bg-surface-container-high";
}

function formatMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function CreatePOModal({ open, onClose, supplierOptions }) {
  const [formData, setFormData] = useState({
    supplier: "",
    items: [],
    expectedDate: "",
    priority: "medium",
    notes: ""
  });
  const [newItem, setNewItem] = useState({
    sku: "",
    name: "",
    quantity: "",
    unitPrice: ""
  });

  const addItem = () => {
    if (newItem.sku && newItem.name && newItem.quantity && newItem.unitPrice) {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, { ...newItem, id: Date.now() }]
      }));
      setNewItem({ sku: "", name: "", quantity: "", unitPrice: "" });
    }
  };

  const removeItem = (id) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice)), 0).toFixed(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle PO creation logic here
    console.log("Creating PO:", formData);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-on-surface/30 backdrop-blur-sm">
      <div className="bg-surface-container-lowest w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-surface-container">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-on-surface font-headline">Create Purchase Order</h2>
            <p className="text-sm text-on-surface-variant">Generate a new purchase order for supplier</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Supplier</label>
              <select
                value={formData.supplier}
                onChange={(e) => setFormData((prev) => ({ ...prev, supplier: e.target.value }))}
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                required
              >
                <option value="">Select Supplier</option>
                {(supplierOptions ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Expected Delivery Date</label>
              <input
                type="date"
                value={formData.expectedDate}
                onChange={(e) => setFormData(prev => ({ ...prev, expectedDate: e.target.value }))}
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-bold text-on-surface mb-4">Order Items</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <input
                type="text"
                placeholder="SKU"
                value={newItem.sku}
                onChange={(e) => setNewItem(prev => ({ ...prev, sku: e.target.value }))}
                className="bg-surface-container-highest border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm"
              />
              <input
                type="text"
                placeholder="Item Name"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                className="bg-surface-container-highest border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm"
              />
              <input
                type="number"
                placeholder="Quantity"
                value={newItem.quantity}
                onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                className="bg-surface-container-highest border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm"
              />
              <input
                type="number"
                placeholder="Unit Price"
                value={newItem.unitPrice}
                onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: e.target.value }))}
                className="bg-surface-container-highest border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-sm"
              />
            </div>
            
            <button
              type="button"
              onClick={addItem}
              className="px-4 py-2 bg-primary text-on-primary rounded-xl font-semibold hover:bg-primary-container transition-all text-sm mb-4"
            >
              Add Item
            </button>

            {formData.items.length > 0 && (
              <div className="bg-surface-container rounded-xl p-4">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                      <th className="pb-2">SKU</th>
                      <th className="pb-2">Item</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">Unit Price</th>
                      <th className="pb-2">Total</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high">
                    {formData.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 text-sm">{item.sku}</td>
                        <td className="py-2 text-sm">{item.name}</td>
                        <td className="py-2 text-sm">{item.quantity}</td>
                        <td className="py-2 text-sm">${item.unitPrice}</td>
                        <td className="py-2 text-sm font-semibold">${(parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2)}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="p-1 text-error hover:bg-error-container rounded transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" className="pt-3 text-sm font-semibold text-on-surface-variant">Total:</td>
                      <td className="pt-3 text-lg font-bold text-on-surface">${calculateTotal()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes or instructions..."
              rows={3}
              className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-surface-container text-on-surface rounded-xl font-semibold hover:bg-surface-container-high transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl font-semibold shadow-lg shadow-primary/10 hover:shadow-xl transition-all"
            >
              Create Purchase Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PurchaseOrders() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("orders");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [_selectedPO, setSelectedPO] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [poRows, setPoRows] = useState([]);
  const [supplierRows, setSupplierRows] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    pending: 0,
    inTransit: 0,
    totalValue: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const startMonth = new Date();
    startMonth.setDate(1);
    startMonth.setHours(0, 0, 0, 0);
    const startMonthIso = startMonth.toISOString();

    try {
      const [
        poRes,
        totalHead,
        pendingHead,
        transitHead,
        amountsRes,
        monthRes,
        supRes,
        poMetaRes,
      ] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select(
            `
            id,
            po_number,
            status,
            priority,
            total_amount,
            created_at,
            expected_delivery_date,
            suppliers ( name ),
            purchase_order_items ( count )
          `
          )
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("purchase_orders").select("*", { count: "exact", head: true }),
        supabase
          .from("purchase_orders")
          .select("*", { count: "exact", head: true })
          .in("status", ["draft", "sent"]),
        supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
        supabase.from("purchase_orders").select("total_amount"),
        supabase.from("purchase_orders").select("id", { count: "exact", head: true }).gte("created_at", startMonthIso),
        supabase.from("suppliers").select("id, name, email, phone").order("name"),
        supabase.from("purchase_orders").select("supplier_id, created_at"),
      ]);

      if (poRes.error) throw poRes.error;
      if (supRes.error) throw supRes.error;

      setPoRows(poRes.data ?? []);

      const totalValue =
        amountsRes.data?.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0) ?? 0;

      setStats({
        total: totalHead.count ?? 0,
        thisMonth: monthRes.count ?? 0,
        pending: pendingHead.error ? 0 : pendingHead.count ?? 0,
        inTransit: transitHead.error ? 0 : transitHead.count ?? 0,
        totalValue,
      });

      const suppliersList = supRes.data ?? [];
      const meta = poMetaRes.data ?? [];
      const poCountBySupplier = new Map();
      const lastOrderBySupplier = new Map();
      for (const row of meta) {
        const sid = row.supplier_id;
        if (!sid) continue;
        poCountBySupplier.set(sid, (poCountBySupplier.get(sid) ?? 0) + 1);
        const cur = lastOrderBySupplier.get(sid);
        const t = row.created_at ? new Date(row.created_at).getTime() : 0;
        if (!cur || t > cur) lastOrderBySupplier.set(sid, t);
      }
      setSupplierRows(
        suppliersList.map((s) => ({
          ...s,
          poCount: poCountBySupplier.get(s.id) ?? 0,
          lastOrder: lastOrderBySupplier.get(s.id)
            ? new Date(lastOrderBySupplier.get(s.id)).toISOString().slice(0, 10)
            : "—",
        }))
      );
    } catch (e) {
      setLoadError(getErrorMessage(e));
      setPoRows([]);
      setSupplierRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen pb-20 md:pb-0">
      <header className="fixed top-0 w-full z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm font-['Manrope'] antialiased tracking-tight">
        <div className="flex justify-between items-center h-16 px-4 md:px-8 max-w-[1920px] mx-auto">
          <div className="flex items-center gap-6 lg:gap-8 min-w-0">
            <Link
              to="/"
              className="text-lg font-extrabold tracking-tighter text-slate-900 dark:text-white shrink-0 hover:opacity-90 transition-opacity"
            >
              The Fluid Curator
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-semibold" href="#">
                Dashboard
              </a>
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-semibold" href="#">
                Inventory
              </a>
              <span className="text-blue-700 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-1 cursor-default font-semibold">
                Purchase Orders
              </span>
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-semibold" href="#">
                Suppliers
              </a>
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-semibold" href="#">
                Reports
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 md:px-6 py-2 rounded-full font-semibold active:scale-95 transition-all text-sm shrink-0"
            >
              Create PO
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="p-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-lg transition-all text-on-surface-variant active:scale-95"
              >
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button
                type="button"
                className="p-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-lg transition-all text-on-surface-variant active:scale-95"
              >
                <span className="material-symbols-outlined">settings</span>
              </button>
            </div>
            <UserAvatarOrIcon
              src={profile?.avatar_url}
              alt={headerUserLabel(profile)}
              size="md"
              className="border border-outline-variant"
            />
          </div>
        </div>
      </header>

      <main className="pt-24 pb-20 md:pb-8 px-4 md:px-8 max-w-[1920px] mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">Purchase Orders</h1>
            <p className="text-on-surface-variant mt-1">Manage supplier orders and track inventory procurement</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group w-full md:w-auto">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">
                search
              </span>
              <input
                className="pl-10 pr-4 py-2.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all w-full md:w-64 text-sm"
                placeholder="Search POs..."
                type="search"
                aria-label="Search purchase orders"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl hover:bg-surface-container-high transition-colors text-sm w-full md:w-auto justify-between md:justify-start"
              >
                <span>Status: All</span>
                <span className="material-symbols-outlined text-sm">expand_more</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-1 mb-8 bg-surface-container-highest p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "orders"
                ? "bg-surface text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Purchase Orders
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "suppliers"
                ? "bg-surface text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Suppliers
          </button>
        </div>

        {loadError ? (
          <div className="mb-6 rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-on-surface">
            {loadError}
          </div>
        ) : null}

        {activeTab === "orders" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-surface-container-low dark:bg-slate-800/40 p-6 rounded-3xl">
                <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-2 block">Total POs</span>
                <div className="font-headline text-3xl font-extrabold text-on-surface">
                  {loading ? "—" : stats.total}
                </div>
                <div className="mt-2 text-xs text-on-surface-variant font-medium">This month: {loading ? "—" : stats.thisMonth}</div>
              </div>
              <div className="bg-surface-container-low dark:bg-slate-800/40 p-6 rounded-3xl">
                <span className="text-xs font-semibold text-tertiary uppercase tracking-widest mb-2 block">Pending</span>
                <div className="font-headline text-3xl font-extrabold text-tertiary">{loading ? "—" : stats.pending}</div>
                <div className="mt-2 text-xs text-tertiary font-medium">Draft or sent</div>
              </div>
              <div className="bg-surface-container-low dark:bg-slate-800/40 p-6 rounded-3xl">
                <span className="text-xs font-semibold text-secondary uppercase tracking-widest mb-2 block">In Transit</span>
                <div className="font-headline text-3xl font-extrabold text-secondary">{loading ? "—" : stats.inTransit}</div>
                <div className="mt-2 text-xs text-on-surface-variant font-medium">Status: confirmed</div>
              </div>
              <div className="bg-surface-container-low dark:bg-slate-800/40 p-6 rounded-3xl">
                <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-2 block">Total Value</span>
                <div className="font-headline text-3xl font-extrabold text-on-surface">
                  {loading ? "—" : formatMoney(stats.totalValue)}
                </div>
                <div className="mt-2 text-xs text-on-surface-variant font-medium">Sum of all PO totals</div>
              </div>
            </div>

            <div className="bg-surface-container-lowest dark:bg-slate-900/50 rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-surface-container-low/50 dark:bg-slate-800/30">
                      <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">PO Number</th>
                      <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Supplier</th>
                      <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Items</th>
                      <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total</th>
                      <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Order Date</th>
                      <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Expected</th>
                      <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5 dark:divide-slate-700/50">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant text-sm">
                          Loading purchase orders…
                        </td>
                      </tr>
                    ) : poRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant text-sm">
                          Walang purchase order sa database. Magdagdag ng suppliers at PO sa Supabase o gamitin ang Create PO (line items ay susunod pa).
                        </td>
                      </tr>
                    ) : (
                      poRows.map((po) => {
                        const itemCount =
                          Array.isArray(po.purchase_order_items) && po.purchase_order_items[0]?.count != null
                            ? po.purchase_order_items[0].count
                            : 0;
                        const supplierName = po.suppliers?.name ?? "—";
                        const st = (po.status || "").toLowerCase();
                        const priorityHigh = (po.priority || "").toLowerCase() === "high";
                        return (
                          <tr key={po.id} className="hover:bg-surface-container/30 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-on-surface">{po.po_number ?? po.id}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-on-surface">{supplierName}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${statusBadgeClass(st)}`}>
                                  {st || "—"}
                                </span>
                                {priorityHigh ? (
                                  <span className="px-2 py-0.5 bg-error-container text-on-error-container text-[10px] font-bold rounded-full">
                                    High Priority
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-on-surface-variant">{itemCount}</td>
                            <td className="px-6 py-4 font-semibold text-on-surface">{formatMoney(po.total_amount)}</td>
                            <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDate(po.created_at)}</td>
                            <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDate(po.expected_delivery_date)}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-fixed rounded-lg transition-all"
                                  aria-label="View PO"
                                  onClick={() => setSelectedPO(po)}
                                >
                                  <span className="material-symbols-outlined">visibility</span>
                                </button>
                                <button
                                  type="button"
                                  className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-fixed rounded-lg transition-all"
                                  aria-label="Edit PO"
                                >
                                  <span className="material-symbols-outlined">edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-lg transition-all"
                                  aria-label="Delete PO"
                                >
                                  <span className="material-symbols-outlined">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === "suppliers" && (
          <div className="bg-surface-container-lowest dark:bg-slate-900/50 rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-surface-container-low/50 dark:bg-slate-800/30">
                    <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Supplier Name</th>
                    <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total POs</th>
                    <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Last Order</th>
                    <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5 dark:divide-slate-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant text-sm">
                        Loading suppliers…
                      </td>
                    </tr>
                  ) : supplierRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant text-sm">
                        Walang supplier record. Magdagdag sa table na <code className="text-xs">suppliers</code> sa Supabase.
                      </td>
                    </tr>
                  ) : (
                    supplierRows.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-surface-container/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-on-surface">{supplier.name}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{supplier.email ?? "—"}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{supplier.phone ?? "—"}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{supplier.poCount}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{supplier.lastOrder}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-fixed rounded-lg transition-all"
                            aria-label="View Supplier"
                          >
                            <span className="material-symbols-outlined">visibility</span>
                          </button>
                          <button
                            type="button"
                            className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-fixed rounded-lg transition-all"
                            aria-label="Edit Supplier"
                          >
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button
                            type="button"
                            className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-lg transition-all"
                            aria-label="Delete Supplier"
                          >
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <CreatePOModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        supplierOptions={supplierRows.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
