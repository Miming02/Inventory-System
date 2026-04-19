import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";
import { ItemThumbOrIcon } from "../../components/ItemThumbOrIcon";

const PAGE_SIZE = 10;

function headerUserLabel(p) {
  if (!p) return "";
  const fn = (p.first_name || "").trim();
  const ln = (p.last_name || "").trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
  return p.email || "";
}

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
    unit: row.unit_of_measure ?? "—",
    qty: Number.isFinite(stock) ? String(stock) : "0",
    qtyTone: low ? "tertiary" : "default",
    barTrack: low ? "bg-tertiary-fixed" : "bg-primary-fixed",
    barFill: low ? "bg-tertiary" : "bg-primary",
    barPct: `${barPctNum}%`,
    reorder: row.reorder_level != null ? String(row.reorder_level) : "—",
    reorderBadge: low ? `Low (≤${reorder})` : null,
    image_url: row.image_url || null,
  };
}

export default function InventoryItems() {
  const { profile } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rows, setRows] = useState([]);
  /** Total rows matching current search (for pagination). */
  const [filteredTotal, setFilteredTotal] = useState(0);
  /** All inventory rows (summary). */
  const [globalTotal, setGlobalTotal] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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
      .select("id,sku,name,description,unit_of_measure,current_stock,reorder_level,max_stock,image_url,location,categories(name)", {
        count: "exact",
      })
      .order("name", { ascending: true })
      .range(from, to);

    if (term.length > 0) {
      const p = `%${term}%`;
      listQuery = listQuery.or(`name.ilike.${p},sku.ilike.${p}`);
    }

    const [listRes, totalRes, lowRes] = await Promise.all([
      listQuery,
      supabase.from("inventory_items").select("*", { count: "exact", head: true }),
      supabase.from("inventory_items").select("*", { count: "exact", head: true }).lte("current_stock", 20),
    ]);

    if (listRes.error) {
      setLoadError(getErrorMessage(listRes.error));
      setRows([]);
      setFilteredTotal(0);
    } else {
      setRows((listRes.data ?? []).map(mapInventoryRow));
      setFilteredTotal(listRes.count ?? 0);
    }
    if (!totalRes.error) setGlobalTotal(totalRes.count ?? 0);
    if (!lowRes.error) setLowStockCount(lowRes.count ?? 0);

    setLoading(false);
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const pageStart = filteredTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, filteredTotal);

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen pb-20 md:pb-0">
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
              <span className="text-blue-700 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-1 cursor-default font-semibold">
                Items
              </span>
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-semibold" href="#">
                Purchase Orders
              </a>
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-semibold" href="#">
                Reporting
              </a>
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-semibold" href="#">
                Warehouses
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <button
              type="button"
              className="inline-flex bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 md:px-6 py-2 rounded-full font-semibold active:scale-95 transition-all text-sm shrink-0"
            >
              Create New
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
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">Inventory Items</h1>
            <p className="text-on-surface-variant mt-1">Manage all products and stock-keeping units</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group w-full md:w-auto">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">
                search
              </span>
              <input
                className="pl-10 pr-4 py-2.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all w-full md:w-64 text-sm"
                placeholder="Search inventory..."
                type="search"
                aria-label="Search inventory"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl hover:bg-surface-container-high transition-colors text-sm w-full md:w-auto justify-between md:justify-start"
              >
                <span>Category: All</span>
                <span className="material-symbols-outlined text-sm">expand_more</span>
              </button>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full font-semibold shadow-lg shadow-primary/10 active:scale-95 transition-all w-full sm:w-auto justify-center"
            >
              <span className="material-symbols-outlined">add</span>
              <span>Add Item</span>
            </button>
          </div>
        </div>

        {loadError ? (
          <div className="mb-6 rounded-2xl border border-error/30 bg-error-container/30 text-on-error-container px-4 py-3 text-sm">
            {loadError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-surface-container-low dark:bg-slate-800/40 p-6 rounded-3xl">
            <span className="text-xs font-semibold text-secondary uppercase tracking-widest mb-2 block">Active SKUs</span>
            <div className="font-headline text-3xl font-extrabold text-on-surface">
              {loading ? "…" : globalTotal.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-on-surface-variant font-medium">From Supabase inventory_items</div>
          </div>
          <div className="bg-surface-container-low dark:bg-slate-800/40 p-6 rounded-3xl">
            <span className="text-xs font-semibold text-tertiary uppercase tracking-widest mb-2 block">Low stock (≤20)</span>
            <div className="font-headline text-3xl font-extrabold text-tertiary">
              {loading ? "…" : lowStockCount.toLocaleString()}
            </div>
            <div className="mt-2 flex items-center text-xs text-tertiary font-medium">
              <span className="material-symbols-outlined text-sm mr-1">warning</span> Review reorder levels
            </div>
          </div>
          <div className="bg-surface-container-low dark:bg-slate-800/40 p-6 rounded-3xl">
            <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-2 block">Matching filter</span>
            <div className="font-headline text-3xl font-extrabold text-on-surface">
              {loading ? "…" : filteredTotal.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-on-surface-variant font-medium">Rows matching search + list</div>
          </div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-slate-900/50 rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-surface-container-low/50 dark:bg-slate-800/30">
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Item Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">SKU Code</th>
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Qty on Hand</th>
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Reorder Level</th>
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5 dark:divide-slate-700/50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant">
                      Loading inventory…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-on-surface-variant">
                      No items found. Add rows in Supabase or clear your search.
                    </td>
                  </tr>
                ) : null}
                {!loading &&
                  rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-container/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <ItemThumbOrIcon src={row.image_url} name={row.name} size="sm" />
                        <div>
                          <div className="font-semibold text-on-surface">{row.name}</div>
                          <div className="text-xs text-on-surface-variant">{row.subtitle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-on-surface-variant">{row.sku}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-xs font-medium rounded-full">
                        {row.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{row.unit}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-bold ${row.qtyTone === "tertiary" ? "text-tertiary" : "text-on-surface"}`}
                        >
                          {row.qty}
                        </span>
                        <div className={`w-16 h-1 ${row.barTrack} rounded-full overflow-hidden`}>
                          <div className={`${row.barFill} h-full rounded-full`} style={{ width: row.barPct }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {row.reorderBadge ? (
                        <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-bold rounded-full uppercase tracking-tighter">
                          {row.reorderBadge}
                        </span>
                      ) : (
                        <span className="text-sm text-on-surface-variant">{row.reorder}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-fixed rounded-lg transition-all"
                          aria-label="Edit item"
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button
                          type="button"
                          className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-lg transition-all"
                          aria-label="Delete item"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-surface-container-low/30 dark:bg-slate-800/30 border-t border-outline-variant/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-on-surface-variant text-center sm:text-left">
              {filteredTotal === 0
                ? "No items"
                : `Showing ${pageStart} to ${pageEnd} of ${filteredTotal.toLocaleString()} items`}
            </p>
            <div className="flex gap-3 items-center flex-wrap justify-center sm:justify-end">
              <span className="text-xs text-on-surface-variant font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="p-2 bg-surface-container-highest rounded-lg text-on-surface hover:bg-surface-container-high transition-colors active:scale-95 disabled:opacity-50"
                aria-label="Previous page"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button
                type="button"
                className="p-2 bg-surface-container-highest rounded-lg text-on-surface hover:bg-surface-container-high transition-colors active:scale-95 disabled:opacity-50"
                aria-label="Next page"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
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
    </div>
  );
}
