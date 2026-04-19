import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { ItemThumbOrIcon } from "../../components/ItemThumbOrIcon";

function DiffBadge({ diff }) {
  if (diff > 0) {
    return (
      <span className="px-3 py-1 bg-primary-fixed text-primary rounded-full text-sm font-bold">+{diff}</span>
    );
  }
  if (diff < 0) {
    return (
      <span className="px-3 py-1 bg-error-container text-on-error-container rounded-full text-sm font-bold">{diff}</span>
    );
  }
  return (
    <span className="px-3 py-1 bg-surface-container text-on-surface-variant rounded-full text-sm font-bold">0</span>
  );
}

export default function CountInventory() {
  const { profile } = useAuth();
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [items, setItems] = useState([]);
  const [counted, setCounted] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const countedByLabel = useMemo(() => {
    const fn = (profile?.first_name || "").trim();
    const ln = (profile?.last_name || "").trim();
    if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
    return profile?.email || "—";
  }, [profile]);

  const loadLocations = useCallback(async () => {
    const { data, error: e } = await supabase
      .from("inventory_items")
      .select("location")
      .not("location", "is", null)
      .limit(2500);
    if (e) return;
    const set = new Set();
    for (const row of data ?? []) {
      const v = (row.location || "").trim();
      if (v) set.add(v);
    }
    setLocations([...set].sort((a, b) => a.localeCompare(b)));
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let q = supabase
        .from("inventory_items")
        .select("id,sku,name,current_stock,image_url,location,categories(name)")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(150);
      if (selectedLocation) {
        q = q.eq("location", selectedLocation);
      }
      const { data, error: e } = await q;
      if (e) throw e;
      const list = data ?? [];
      setItems(list);
      const init = {};
      for (const row of list) {
        init[row.id] = Number(row.current_stock ?? 0);
      }
      setCounted(init);
    } catch (err) {
      setError(getErrorMessage(err));
      setItems([]);
      setCounted({});
    } finally {
      setLoading(false);
    }
  }, [selectedLocation]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const { netVariance, displayed } = useMemo(() => {
    let sum = 0;
    for (const row of items) {
      const sys = Number(row.current_stock ?? 0);
      const c = counted[row.id];
      const n = c === undefined || Number.isNaN(Number(c)) ? sys : Number(c);
      sum += n - sys;
    }
    return { netVariance: sum, displayed: items.length };
  }, [items, counted]);

  const setCountFor = (id, raw) => {
    const n = raw === "" ? NaN : Number(raw);
    setCounted((prev) => ({ ...prev, [id]: Number.isNaN(n) ? prev[id] : n }));
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <header className="fixed top-0 left-0 w-full z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between px-4 md:px-8 py-4 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-6 md:gap-8 min-w-0">
            <Link to="/" className="text-xl font-extrabold tracking-tighter text-slate-900 dark:text-white font-manrope shrink-0">
              The Fluid Curator
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link
                to="/"
                className="text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-slate-100 transition-colors font-manrope"
              >
                Dashboard
              </Link>
              <Link
                to="/inventory"
                className="text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-slate-100 transition-colors font-manrope"
              >
                Inventory
              </Link>
              <span className="text-blue-600 dark:text-blue-400 font-bold border-b-2 border-blue-600 dark:border-blue-400 pb-1 font-manrope">
                Count
              </span>
            </nav>
          </div>
        </div>
      </header>

      <main className="pt-28 pb-44 md:pb-32 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface font-manrope tracking-tight mb-2">Inventory Count</h1>
          <p className="text-on-surface-variant font-medium">
            Data mula sa <code className="text-xs">inventory_items</code> — ihambing ang physical count sa system qty.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm">{error}</div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
          <div className="md:col-span-6 bg-surface-container-low p-5 rounded-3xl flex flex-col gap-3">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Quick Scan</label>
            <div className="flex gap-2">
              <div className="relative flex-grow min-w-0">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">barcode_scanner</span>
                <input
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border-none rounded-full text-on-surface focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/50 shadow-sm"
                  placeholder="Hanapin sa listahan (SKU) — full scan flow susunod"
                  type="text"
                  disabled
                />
              </div>
              <button
                type="button"
                disabled
                className="px-6 py-4 bg-surface-container-high text-on-surface-variant rounded-full font-bold shrink-0 whitespace-nowrap cursor-not-allowed"
              >
                Scan
              </button>
            </div>
          </div>
          <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-low p-5 rounded-3xl flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Location</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="bg-transparent border-none p-0 text-on-surface font-semibold focus:ring-0 cursor-pointer w-full"
              >
                <option value="">All locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-surface-container-low p-5 rounded-3xl flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Date</label>
              <input
                className="bg-transparent border-none p-0 text-on-surface font-semibold focus:ring-0 cursor-pointer w-full"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="bg-surface-container-low p-5 rounded-3xl flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Counted by</label>
              <span className="text-on-surface font-semibold truncate">{countedByLabel}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-[2rem] shadow-xl shadow-on-surface/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-6 md:px-8 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Item</th>
                  <th className="px-4 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">SKU</th>
                  <th className="px-4 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant text-right">System Qty</th>
                  <th className="px-4 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant text-center">Counted</th>
                  <th className="px-6 md:px-8 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant text-right">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-on-surface-variant text-sm">
                      Loading…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-on-surface-variant text-sm">
                      Walang item para sa filter na ito. Subukan ang ibang location o magdagdag ng inventory.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const sys = Number(row.current_stock ?? 0);
                    const c = counted[row.id] ?? sys;
                    const diff = Number(c) - sys;
                    const cat = row.categories && typeof row.categories === "object" ? row.categories.name : null;
                    return (
                      <tr key={row.id} className="group hover:bg-surface-container-low/30 transition-colors">
                        <td className="px-6 md:px-8 py-6">
                          <div className="flex items-center gap-4">
                            <ItemThumbOrIcon src={row.image_url} name={row.name ?? "Item"} size="md" />
                            <div>
                              <p className="font-bold text-on-surface font-manrope">{row.name}</p>
                              <p className="text-sm text-on-surface-variant">{cat ?? row.location ?? "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-6 font-mono text-sm font-medium text-on-secondary-container">{row.sku}</td>
                        <td className="px-4 py-6 text-right font-bold text-on-surface">{sys}</td>
                        <td className="px-4 py-6 text-center">
                          <input
                            className="w-24 px-4 py-2 bg-surface-container rounded-xl border-none text-center font-bold text-primary focus:ring-2 focus:ring-primary/20"
                            type="number"
                            min={0}
                            value={counted[row.id] ?? ""}
                            onChange={(e) => setCountFor(row.id, e.target.value)}
                          />
                        </td>
                        <td className="px-6 md:px-8 py-6 text-right">
                          <DiffBadge diff={diff} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-surface-container-low px-6 md:px-8 py-4 flex justify-between items-center flex-wrap gap-3">
            <p className="text-sm font-bold text-on-surface-variant">
              Showing {displayed} item{displayed === 1 ? "" : "s"} (max 150)
            </p>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total net variance</span>
              <span className={`text-lg font-extrabold ${netVariance === 0 ? "text-on-surface" : netVariance < 0 ? "text-error" : "text-primary"}`}>
                {netVariance > 0 ? `+${netVariance}` : netVariance} units
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed left-0 right-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg shadow-[0_-4px_20px_rgba(0,0,0,0.05)] bottom-0 md:bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-on-surface-variant text-center md:text-left">
            Ang <strong>Save / Confirm</strong> ay mag-i-insert pa sa <code className="text-[10px]">stock_counts</code> — UI pa lang ang count grid.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled
              className="px-6 py-3 bg-secondary-container text-on-secondary-container rounded-full font-bold opacity-60 cursor-not-allowed"
            >
              Save count
            </button>
            <button
              type="button"
              disabled
              className="px-6 py-3 bg-primary text-on-primary rounded-full font-extrabold opacity-60 cursor-not-allowed"
            >
              Confirm adjustment
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
