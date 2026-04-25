import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";

export default function ManageLocations() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [itemOptions, setItemOptions] = useState([]);
  const [useLegacyLocations, setUseLegacyLocations] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    seedItemId: "",
    seedQuantity: "0",
  });

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setUseLegacyLocations(false);
    const [locRes, itemsRes] = await Promise.all([
      supabase.from("inventory_item_locations").select("location,item_id,quantity,updated_at").order("location", { ascending: true }).limit(5000),
      supabase.from("inventory_items").select("id,sku,name").order("name", { ascending: true }).limit(1000),
    ]);

    const locTableMissing =
      !!locRes.error &&
      (getErrorMessage(locRes.error).includes("inventory_item_locations") ||
        locRes.error.code === "PGRST204" ||
        locRes.error.code === "42P01");

    if (locTableMissing) {
      setUseLegacyLocations(true);
      const legacyRes = await supabase
        .from("inventory_items")
        .select("id,location,current_stock,updated_at")
        .not("location", "is", null)
        .order("location", { ascending: true })
        .limit(5000);
      if (legacyRes.error) {
        setLoadError(getErrorMessage(legacyRes.error));
        setRows([]);
      } else {
        const grouped = new Map();
        for (const row of legacyRes.data ?? []) {
          const loc = (row.location || "").trim();
          if (!loc) continue;
          if (!grouped.has(loc)) {
            grouped.set(loc, {
              name: loc,
              itemIds: new Set(),
              totalQty: 0,
              updatedAt: row.updated_at || null,
            });
          }
          const entry = grouped.get(loc);
          entry.itemIds.add(row.id);
          entry.totalQty += Number(row.current_stock ?? 0);
          if (!entry.updatedAt || (row.updated_at && new Date(row.updated_at) > new Date(entry.updatedAt))) {
            entry.updatedAt = row.updated_at;
          }
        }
        setRows(
          [...grouped.values()]
            .map((row) => ({
              name: row.name,
              itemCount: row.itemIds.size,
              totalQty: row.totalQty,
              updatedAt: row.updatedAt,
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      }
    } else if (locRes.error) {
      setLoadError(getErrorMessage(locRes.error));
      setRows([]);
    } else {
      const grouped = new Map();
      for (const row of locRes.data ?? []) {
        const loc = (row.location || "").trim();
        if (!loc) continue;
        if (!grouped.has(loc)) {
          grouped.set(loc, {
            name: loc,
            itemIds: new Set(),
            totalQty: 0,
            updatedAt: row.updated_at || null,
          });
        }
        const entry = grouped.get(loc);
        entry.itemIds.add(row.item_id);
        entry.totalQty += Number(row.quantity ?? 0);
        if (!entry.updatedAt || (row.updated_at && new Date(row.updated_at) > new Date(entry.updatedAt))) {
          entry.updatedAt = row.updated_at;
        }
      }
      setRows(
        [...grouped.values()]
          .map((row) => ({
            name: row.name,
            itemCount: row.itemIds.size,
            totalQty: row.totalQty,
            updatedAt: row.updatedAt,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    }
    if (!itemsRes.error) setItemOptions(itemsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(term));
  }, [rows, search]);

  const openAddModal = () => {
    setEditingLocation(null);
    setFormData({
      name: "",
      seedItemId: itemOptions[0]?.id || "",
      seedQuantity: "0",
    });
    setShowAddModal(true);
  };

  const openEditModal = (row) => {
    setEditingLocation(row);
    setFormData({
      name: row.name,
      seedItemId: itemOptions[0]?.id || "",
      seedQuantity: "0",
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingLocation(null);
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    const newName = formData.name.trim();
    if (!newName) return;
    setLoadError("");

    if (editingLocation) {
      const { error } = useLegacyLocations
        ? await supabase.from("inventory_items").update({ location: newName, updated_at: new Date().toISOString() }).eq("location", editingLocation.name)
        : await supabase
            .from("inventory_item_locations")
            .update({ location: newName, updated_at: new Date().toISOString() })
            .eq("location", editingLocation.name);
      if (error) {
        setLoadError(getErrorMessage(error));
        return;
      }
    } else {
      if (!formData.seedItemId) {
        setLoadError("Select a seed item first.");
        return;
      }
      const quantity = Number(formData.seedQuantity || 0);
      if (Number.isNaN(quantity) || quantity < 0) {
        setLoadError("Seed quantity must be 0 or higher.");
        return;
      }
      const { error } = useLegacyLocations
        ? await supabase.from("inventory_items").update({ location: newName, updated_at: new Date().toISOString() }).eq("id", formData.seedItemId)
        : await supabase.from("inventory_item_locations").upsert(
            {
              item_id: formData.seedItemId,
              location: newName,
              quantity,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "item_id,location" }
          );
      if (error) {
        setLoadError(getErrorMessage(error));
        return;
      }
    }

    closeModal();
    await loadLocations();
  };

  const handleDeleteLocation = async (row) => {
    if (row.totalQty > 0) {
      setLoadError(`Cannot delete "${row.name}" because it still has stock (${row.totalQty}).`);
      return;
    }
    const ok = window.confirm(`Delete location "${row.name}"?`);
    if (!ok) return;
    const { error } = useLegacyLocations
      ? await supabase.from("inventory_items").update({ location: null, updated_at: new Date().toISOString() }).eq("location", row.name)
      : await supabase.from("inventory_item_locations").delete().eq("location", row.name);
    if (error) {
      setLoadError(getErrorMessage(error));
      return;
    }
    await loadLocations();
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
            Add Location
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
                  <h1 className="text-xl sm:text-2xl font-extrabold font-manrope tracking-tight text-on-surface mb-0.5">Locations</h1>
                </div>

        <div className="bg-surface-container-low rounded-xl p-3 mb-3 flex flex-col md:flex-row gap-3 shrink-0">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-base">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border-none bg-surface-container-lowest py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20"
              placeholder="Search location..."
            />
          </div>
        </div>

        {loadError ? (
          <div className="mb-3 rounded-xl border border-error/40 bg-error-container/30 px-4 py-2 text-xs text-on-surface">{loadError}</div>
        ) : null}
        <section className="bg-surface-container-lowest rounded-xl shadow-[0_8px_24px_-4px_rgba(23,28,31,0.06)] overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-auto min-h-0 flex-1">
            <table className="w-full min-w-[820px] text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Location</th>
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Item Count</th>
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Stock Qty</th>
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Updated</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-on-surface-variant">
                      Loading locations...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-on-surface-variant">
                      No locations found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                  <tr key={row.name} className="hover:bg-surface-bright transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary-fixed text-primary">
                          <span className="material-symbols-outlined !text-base">warehouse</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold">{row.name}</p>
                          <p className="text-xs text-on-surface-variant">
                            {useLegacyLocations ? "From legacy item location field" : "From per-location inventory balances"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-on-surface">{row.itemCount}</td>
                    <td className="px-3 py-3 text-sm text-on-surface">{row.totalQty}</td>
                    <td className="px-3 py-3 text-sm text-on-surface-variant">{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => openEditModal(row)} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-bright">
                          <span className="material-symbols-outlined !text-base">edit_note</span>
                        </button>
                        <button type="button" onClick={() => handleDeleteLocation(row)} className="rounded-lg p-1.5 text-error hover:bg-error-container/50">
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
          <button type="button" aria-label="Close modal backdrop" className="absolute inset-0 bg-on-background/30 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative z-[101] w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/60 bg-surface shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)]">
            <div className="px-8 pb-4 pt-8">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-headline text-2xl sm:text-3xl font-extrabold tracking-tight text-on-background mb-1.5">
                    {editingLocation ? "Rename Location" : "Add Location"}
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    {editingLocation
                      ? "Update location name across per-location stock records."
                      : "Create a location entry linked to one inventory item."}
                  </p>
                </div>
                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-full p-2 text-outline transition-all hover:bg-surface-container-high">
                  <span className="material-symbols-outlined !text-base">close</span>
                </button>
              </div>
            </div>

            <form className="space-y-5 px-8 pb-8" onSubmit={handleSaveLocation}>
              <div className="space-y-1.5">
                <label className="block px-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Location Name *</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm text-on-surface transition-all placeholder:text-outline-variant focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. Main Warehouse"
                  required
                />
              </div>

              {!editingLocation ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block px-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Seed Item *</label>
                  <select
                    value={formData.seedItemId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, seedItemId: e.target.value }))}
                    className="w-full appearance-none rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                    required
                  >
                    <option value="" disabled>
                      Select item...
                    </option>
                    {itemOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku ? `${item.sku} - ${item.name}` : item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block px-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Initial Qty</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.seedQuantity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, seedQuantity: e.target.value }))}
                    className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm text-on-surface transition-all placeholder:text-outline-variant focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                    placeholder="0"
                  />
                </div>
              </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="rounded-full px-6 py-2.5 text-sm font-semibold text-secondary transition-all hover:bg-secondary-container/30">
                  Cancel
                </button>
                <button type="submit" className="rounded-full bg-gradient-to-r from-primary to-primary-container px-8 py-2.5 text-sm font-bold text-on-primary shadow-lg transition-all hover:shadow-primary/30">
                  {editingLocation ? "Update Location" : "Save Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
