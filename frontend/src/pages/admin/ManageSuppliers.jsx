import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";

const emptyForm = {
  name: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  is_active: true,
};

export default function ManageSuppliers() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState(emptyForm);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setNotice("");
    const { data, error } = await supabase
      .from("suppliers")
      .select("id,name,contact_person,email,phone,address,is_active,created_at")
      .order("name", { ascending: true });
    if (error) {
      setLoadError(getErrorMessage(error));
      setSuppliers([]);
    } else {
      setSuppliers(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suppliers.filter((row) => {
      const activeMatches =
        statusFilter === "all" ||
        (statusFilter === "active" && row.is_active) ||
        (statusFilter === "inactive" && !row.is_active);
      if (!activeMatches) return false;
      if (!term) return true;
      return [row.name, row.contact_person, row.email, row.phone, row.address].some((v) =>
        (v || "").toLowerCase().includes(term)
      );
    });
  }, [suppliers, search, statusFilter]);

  const openAddModal = () => {
    setEditingSupplier(null);
    setFormData(emptyForm);
    setShowAddModal(true);
  };

  const openEditModal = (row) => {
    setEditingSupplier(row);
    setFormData({
      name: row.name || "",
      contact_person: row.contact_person || "",
      email: row.email || "",
      phone: row.phone || "",
      address: row.address || "",
      is_active: row.is_active ?? true,
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingSupplier(null);
    setFormData(emptyForm);
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    setLoadError("");
    const payload = {
      name: formData.name.trim(),
      contact_person: formData.contact_person.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      address: formData.address.trim() || null,
      is_active: formData.is_active,
    };
    const query = editingSupplier
      ? supabase.from("suppliers").update(payload).eq("id", editingSupplier.id)
      : supabase.from("suppliers").insert(payload);
    const { error } = await query;
    if (error) {
      setLoadError(getErrorMessage(error));
      return;
    }
    closeModal();
    await loadSuppliers();
  };

  const handleDeleteSupplier = async (supplierId) => {
    const ok = window.confirm("Delete this supplier?");
    if (!ok) return;
    setLoadError("");
    setNotice("");
    const { error } = await supabase.from("suppliers").delete().eq("id", supplierId);
    if (error) {
      // If supplier is referenced by other records (e.g. purchase_orders), fall back to deactivate.
      const message = getErrorMessage(error).toLowerCase();
      const fkBlocked =
        error.code === "23503" ||
        message.includes("foreign key") ||
        message.includes("reference") ||
        message.includes("purchase_orders");
      if (!fkBlocked) {
        setLoadError(getErrorMessage(error));
        return;
      }
      const deactivateRes = await supabase.from("suppliers").update({ is_active: false }).eq("id", supplierId);
      if (deactivateRes.error) {
        setLoadError(getErrorMessage(deactivateRes.error));
        return;
      }
      setNotice("Supplier is linked to transactions, so it was set to Inactive instead of deleted.");
    }
    await loadSuppliers();
  };

  return (
    <div className="bg-surface text-on-surface min-h-dvh flex flex-col lg:h-dvh lg:max-h-dvh lg:overflow-hidden pb-24 md:pb-0">
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-white/80 shadow-sm shadow-blue-900/5 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8 max-w-[1440px]">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-white shrink-0"
            >
              <span className="material-symbols-outlined !text-base">arrow_back</span>
              Dashboard
            </Link>
            <span className="text-lg sm:text-xl font-extrabold font-headline text-on-surface tracking-tight shrink-0 select-none">Inventory</span>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-primary-container px-4 py-2 text-xs font-bold text-on-primary shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined !text-base">add</span>
            Add Supplier
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-2 pb-24 pt-[4.4rem] sm:px-3 md:pb-3 lg:max-h-[calc(100dvh-4rem)] lg:overflow-hidden lg:px-4">
        <section className="px-1 py-2 sm:px-2 flex-1 min-h-0">
          <div className="relative mx-auto flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest to-surface shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            <Link
              to="/system-settings"
              className="absolute right-5 top-5 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-white/90 text-on-surface-variant shadow-sm transition-all hover:border-error/20 hover:bg-white hover:text-error"
              aria-label="Close"
              title="Close"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </Link>
            <section className="relative flex min-h-0 flex-1 flex-col overflow-auto bg-transparent p-4 sm:p-6 lg:p-8">
              <div className="mx-auto flex w-full max-w-[1180px] flex-1 min-h-0 flex-col">
                <div className="shrink-0 mb-3">
                  <h1 className="text-xl sm:text-2xl font-extrabold font-manrope tracking-tight text-on-surface mb-0.5">Suppliers</h1>
                  <p className="text-xs text-on-surface-variant">Manage supplier records and contact information</p>
                </div>

        <div className="bg-surface-container-low rounded-xl p-3 mb-3 flex flex-col md:flex-row gap-3 shrink-0">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-base">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border-none bg-surface-container-lowest py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20"
              placeholder="Search by name, contact, or email..."
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border-none bg-surface-container-lowest py-2.5 px-3 text-sm min-w-[160px] focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {notice ? (
          <div className="mb-3 rounded-xl border border-primary/20 bg-primary-fixed/40 px-4 py-2 text-xs text-on-surface">{notice}</div>
        ) : null}

        {loadError ? (
          <div className="mb-3 rounded-xl border border-error/40 bg-error-container/30 px-4 py-2 text-xs text-on-surface">{loadError}</div>
        ) : null}

        <section className="bg-surface-container-lowest rounded-xl shadow-[0_8px_24px_-4px_rgba(23,28,31,0.06)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto min-h-0 flex-1">
            <table className="w-full min-w-[900px] text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Supplier</th>
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Contact</th>
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Details</th>
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Location</th>
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-on-surface-variant">
                      Loading suppliers...
                    </td>
                  </tr>
                ) : filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-on-surface-variant">
                      No suppliers found.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-bright transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary text-sm font-bold">
                          {(row.name || "?")
                            .split(" ")
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface">{row.name}</p>
                          <p className="text-xs text-on-surface-variant">Created {new Date(row.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-semibold">{row.contact_person || "—"}</p>
                      <p className="text-xs text-on-surface-variant">Primary Contact</p>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <p className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined !text-sm text-primary">mail</span>
                        {row.email || "—"}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-on-surface-variant">
                        <span className="material-symbols-outlined !text-sm">call</span>
                        {row.phone || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs text-on-surface-variant">{row.address || "—"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold ${
                          row.is_active ? "bg-primary-fixed text-on-primary-fixed-variant" : "bg-surface-container-highest text-on-surface-variant"
                        }`}
                      >
                        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${row.is_active ? "bg-primary" : "bg-outline"}`} />
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => openEditModal(row)} className="rounded-lg p-1.5 text-on-secondary-container hover:bg-secondary-container">
                          <span className="material-symbols-outlined !text-base">edit</span>
                        </button>
                        <button type="button" onClick={() => handleDeleteSupplier(row.id)} className="rounded-lg p-1.5 text-error hover:bg-error-container">
                          <span className="material-symbols-outlined !text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </section>
              </div>
            </section>
          </div>
        </section>
      </main>

      {showAddModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" aria-label="Close modal backdrop" className="absolute inset-0 bg-on-surface/40 backdrop-blur-md" onClick={() => setShowAddModal(false)} />
          <div className="relative z-[101] w-full max-w-2xl overflow-hidden rounded-[2rem] bg-surface-bright shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)]">
            <div className="flex items-center justify-between bg-gradient-to-b from-white to-transparent px-8 pb-4 pt-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface">
                  {editingSupplier ? "Edit Supplier" : "Add Supplier"}
                </h2>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {editingSupplier ? "Update supplier profile details." : "Onboard a new strategic partner to the ecosystem."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined !text-base">close</span>
              </button>
            </div>

            <form className="space-y-6 px-8 pb-8" onSubmit={handleSaveSupplier}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block pl-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Supplier Name *</label>
                  <input value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20" placeholder="e.g. Nordic Glassworks" required />
                </div>
                <div className="space-y-1.5">
                  <label className="block pl-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Contact Person</label>
                  <input value={formData.contact_person} onChange={(e) => setFormData((prev) => ({ ...prev, contact_person: e.target.value }))} className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20" placeholder="e.g. Erik Sorenson" />
                </div>
                <div className="space-y-1.5">
                  <label className="block pl-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Email Address *</label>
                  <input value={formData.email} onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))} className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20" placeholder="contact@supplier.com" type="email" required />
                </div>
                <div className="space-y-1.5">
                  <label className="block pl-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Phone Number *</label>
                  <input value={formData.phone} onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))} className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20" placeholder="+63 9xx xxx xxxx" type="tel" required />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block pl-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Business Address</label>
                  <textarea value={formData.address} onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))} className="w-full resize-none rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20" placeholder="Street, City, Province, ZIP" rows={2} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block pl-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Status</label>
                  <select value={formData.is_active ? "active" : "inactive"} onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.value === "active" }))} className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full px-8 py-3 text-sm font-bold text-on-secondary-container transition-all hover:bg-secondary-container/50"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-full bg-gradient-to-r from-primary to-primary-container px-10 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-8px_rgba(0,71,141,0.4)]">
                  {editingSupplier ? "Update Supplier" : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
