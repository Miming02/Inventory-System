import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { ItemThumbOrIcon } from "../../components/ItemThumbOrIcon";

function DiffBadge({ diff }) {
  if (diff > 0) {
    return (
      <span className="px-2.5 py-0.5 bg-primary-fixed text-primary rounded-full text-xs font-bold">+{diff}</span>
    );
  }
  if (diff < 0) {
    return (
      <span className="px-2.5 py-0.5 bg-error-container text-on-error-container rounded-full text-xs font-bold">{diff}</span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 bg-surface-container text-on-surface-variant rounded-full text-xs font-bold">0</span>
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
  const [saving, setSaving] = useState(false);
  const [countSessionStatus, setCountSessionStatus] = useState("not_started");
  const [countSessionId, setCountSessionId] = useState(null);
  const [countNumber, setCountNumber] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

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

  const hasDiscrepancies = useMemo(
    () =>
      items.some((row) => {
        const sys = Number(row.current_stock ?? 0);
        const c = Number(counted[row.id] ?? sys);
        return c !== sys;
      }),
    [items, counted]
  );

  const createSession = useCallback(async () => {
    if (!selectedLocation) {
      setError("Location is required to create a count session.");
      return;
    }
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const now = new Date();
      const nextCountNumber = `CNT-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`;
      const { data, error: e } = await supabase
        .from("stock_counts")
        .insert({
          count_number: nextCountNumber,
          location: selectedLocation,
          status: "not_started",
          created_by: profile?.id ?? null,
          start_date: null,
          end_date: null,
          notes: "Count session created.",
        })
        .select("id,count_number,status")
        .single();
      if (e) throw e;
      setCountSessionId(data.id);
      setCountNumber(data.count_number || nextCountNumber);
      setCountSessionStatus(data.status || "not_started");
      setSaveMessage("Count session created.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [profile?.id, selectedLocation]);

  const startCounting = useCallback(async () => {
    if (!countSessionId) {
      await createSession();
      return;
    }
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const now = new Date().toISOString();
      const { error: e } = await supabase
        .from("stock_counts")
        .update({ status: "in_progress", start_date: now, updated_at: now })
        .eq("id", countSessionId);
      if (e) throw e;
      setCountSessionStatus("in_progress");
      setSaveMessage("Count started.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [countSessionId, createSession]);

  const saveProgress = useCallback(async () => {
    if (!countSessionId) {
      setError("Create a count session first.");
      return;
    }
    if (items.length === 0) {
      setError("No items to save for this count.");
      return;
    }
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const now = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("stock_counts")
        .update({ status: "in_progress", updated_at: now })
        .eq("id", countSessionId);
      if (upErr) throw upErr;

      // Re-save items snapshot (delete then insert). Requires delete policy (migration 023).
      const { error: delErr } = await supabase.from("stock_count_items").delete().eq("count_id", countSessionId);
      if (delErr) throw delErr;

      const payload = items.map((row) => {
        const systemQty = Number(row.current_stock ?? 0);
        const countedQty = Number(counted[row.id] ?? systemQty);
        const variance = countedQty - systemQty;
        return {
          count_id: countSessionId,
          item_id: row.id,
          system_quantity: systemQty,
          counted_quantity: countedQty,
          notes: variance === 0 ? null : `Variance: ${variance}`,
        };
      });
      const { error: insErr } = await supabase.from("stock_count_items").insert(payload);
      if (insErr) throw insErr;

      setCountSessionStatus("in_progress");
      setSaveMessage("Progress saved.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [countSessionId, counted, items]);

  const completeCount = useCallback(async () => {
    if (!countSessionId) {
      setError("Create a count session first.");
      return;
    }
    if (items.length === 0) {
      setError("No items to complete for this count.");
      return;
    }
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const now = new Date().toISOString();
      // Save latest snapshot first.
      const { error: delErr } = await supabase.from("stock_count_items").delete().eq("count_id", countSessionId);
      if (delErr) throw delErr;
      const payload = items.map((row) => {
        const systemQty = Number(row.current_stock ?? 0);
        const countedQty = Number(counted[row.id] ?? systemQty);
        const variance = countedQty - systemQty;
        return {
          count_id: countSessionId,
          item_id: row.id,
          system_quantity: systemQty,
          counted_quantity: countedQty,
          notes: variance === 0 ? null : `Variance: ${variance}`,
        };
      });
      const { error: insErr } = await supabase.from("stock_count_items").insert(payload);
      if (insErr) throw insErr;

      const { error: upErr } = await supabase
        .from("stock_counts")
        .update({
          status: "completed",
          end_date: now,
          updated_at: now,
          notes: hasDiscrepancies ? "Completed. Discrepancies found — requires review." : "Completed. No discrepancies.",
        })
        .eq("id", countSessionId);
      if (upErr) throw upErr;

      setCountSessionStatus("completed");
      setSaveMessage(hasDiscrepancies ? "Count completed. Pending review." : "Count completed. No discrepancies.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [countSessionId, counted, hasDiscrepancies, items]);

  return (
    <div className="min-h-dvh bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed pb-20 md:pb-0">
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
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-center px-2 pb-20 pt-[4.4rem] sm:px-3 lg:px-4 md:pb-2">
        <section className="px-1 py-2 sm:px-2">
          <div className="relative mx-auto w-full overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest to-surface shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            <Link
              to="/dashboard"
              className="absolute right-5 top-5 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-white/90 text-on-surface-variant shadow-sm transition-all hover:border-error/20 hover:bg-white hover:text-error"
              aria-label="Close"
              title="Close"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </Link>

            <div className="grid min-h-[calc(100dvh-7.2rem)] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="border-b border-outline-variant/10 bg-white/55 p-2 backdrop-blur-sm lg:border-b-0 lg:border-r">
                <p className="px-1 pb-3 text-xs font-bold uppercase tracking-[0.16em] text-primary/60">Count Actions</p>
                <div className="space-y-2">
                  <div className="w-full rounded-[1rem] border border-slate-200/70 bg-white/85 px-3 py-3 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Session</p>
                    <p className="mt-1 text-xs text-on-surface-variant">#{countNumber || "—"}</p>
                    <p className="mt-1 text-xs font-semibold capitalize">{countSessionStatus.replaceAll("_", " ")}</p>
                  </div>

                  <div className="w-full rounded-[1rem] border border-slate-200/70 bg-white/85 px-3 py-3 text-left space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Location</label>
                    <select
                      value={selectedLocation}
                      disabled={Boolean(countSessionId)}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full h-9 rounded-lg px-2.5 text-sm bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer disabled:opacity-60"
                    >
                      <option value="">Select location…</option>
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={saving || !selectedLocation || Boolean(countSessionId)}
                      onClick={() => void createSession()}
                      className="w-full h-9 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold disabled:opacity-50"
                    >
                      Create Session
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={saving || !selectedLocation}
                    onClick={() => void startCounting()}
                    className="w-full rounded-[1rem] border px-3 py-3 text-left transition-all border-slate-200/70 bg-white/85 text-on-surface shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_14px_30px_rgba(59,130,246,0.10)] disabled:opacity-50"
                  >
                    <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                    </span>
                    <span className="block text-[11px] font-semibold leading-tight tracking-wide">Start Count</span>
                  </button>

                  <button
                    type="button"
                    disabled={saving || !countSessionId || countSessionStatus === "not_started"}
                    onClick={() => void saveProgress()}
                    className="w-full rounded-[1rem] border px-3 py-3 text-left transition-all border-slate-200/70 bg-white/85 text-on-surface shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_14px_30px_rgba(59,130,246,0.10)] disabled:opacity-50"
                  >
                    <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[16px]">save</span>
                    </span>
                    <span className="block text-[11px] font-semibold leading-tight tracking-wide">Save Progress</span>
                  </button>

                  <button
                    type="button"
                    disabled={saving || !countSessionId || countSessionStatus === "not_started"}
                    onClick={() => void completeCount()}
                    className="w-full rounded-[1rem] border px-3 py-3 text-left transition-all border-slate-200/70 bg-white/85 text-on-surface shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_14px_30px_rgba(59,130,246,0.10)] disabled:opacity-50"
                  >
                    <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[16px]">fact_check</span>
                    </span>
                    <span className="block text-[11px] font-semibold leading-tight tracking-wide">Complete Count</span>
                  </button>
                </div>
              </aside>

              <section className="relative min-h-0 overflow-auto bg-transparent p-1.5 sm:p-2 lg:p-2.5">
                <div className="p-3 sm:p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Inventory Count</p>
                      <h1 className="text-2xl font-extrabold tracking-tight font-headline">Verify & correct stock</h1>
                      <p className="text-sm text-on-surface-variant">
                        Count does not change stock until review/reconciliation.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Status</p>
                      <p className="text-sm font-semibold capitalize">{countSessionStatus.replaceAll("_", " ")}</p>
                    </div>
                  </div>

                  {error ? (
                    <div className="mb-3 rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm">{error}</div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="rounded-2xl bg-surface-container-low p-4">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-secondary">Items</span>
                      <div className="font-headline text-2xl font-extrabold text-on-surface">{displayed}</div>
                    </div>
                    <div className="rounded-2xl bg-surface-container-low p-4">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-tertiary">Discrepancies</span>
                      <div className="font-headline text-2xl font-extrabold text-tertiary">{hasDiscrepancies ? "Yes" : "No"}</div>
                    </div>
                    <div className="rounded-2xl bg-surface-container-low p-4">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-primary">Net Difference</span>
                      <div className={`font-headline text-2xl font-extrabold ${netVariance === 0 ? "text-on-surface" : netVariance < 0 ? "text-error" : "text-primary"}`}>
                        {netVariance > 0 ? `+${netVariance}` : netVariance}
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-container-lowest rounded-2xl shadow-[0_8px_24px_-4px_rgba(23,28,31,0.06)] overflow-hidden flex-1 min-h-0 flex flex-col border border-outline-variant/10">
                    <div className="overflow-auto min-h-0 flex-1">
                      <table className="w-full text-left border-collapse min-w-[720px]">
                        <thead>
                          <tr className="bg-surface-container-low/50">
                            <th className="px-4 sm:px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Item</th>
                            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">SKU</th>
                            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">System Qty</th>
                            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Counted</th>
                            <th className="px-4 sm:px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Diff</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container">
                          {loading ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant text-sm">
                                Loading…
                              </td>
                            </tr>
                          ) : items.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant text-sm">
                                Select a location and start a count session.
                              </td>
                            </tr>
                          ) : (
                            items.map((row) => {
                              const sys = Number(row.current_stock ?? 0);
                              const c = counted[row.id] ?? sys;
                              const diff = Number(c) - sys;
                              const cat = row.categories && typeof row.categories === "object" ? row.categories.name : null;
                              const isMismatch = diff !== 0;
                              return (
                                <tr
                                  key={row.id}
                                  className={`group transition-colors ${isMismatch ? "bg-tertiary-fixed/10 hover:bg-tertiary-fixed/15" : "hover:bg-surface-container-low/30"}`}
                                >
                                  <td className="px-4 sm:px-5 py-3">
                                    <div className="flex items-center gap-3">
                                      <ItemThumbOrIcon src={row.image_url} name={row.name ?? "Item"} size="sm" />
                                      <div>
                                        <p className="text-sm font-bold text-on-surface font-manrope">{row.name}</p>
                                        <p className="text-xs text-on-surface-variant">{cat ?? row.location ?? "—"}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 font-mono text-xs font-medium text-on-secondary-container">{row.sku}</td>
                                  <td className="px-3 py-3 text-right text-sm font-bold text-on-surface">{sys}</td>
                                  <td className="px-3 py-3 text-center">
                                    <input
                                      disabled={countSessionStatus === "completed"}
                                      className="w-24 px-3 py-1.5 bg-surface-container rounded-lg border-none text-center text-sm font-bold text-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                                      type="number"
                                      min={0}
                                      value={counted[row.id] ?? ""}
                                      onChange={(e) => setCountFor(row.id, e.target.value)}
                                    />
                                  </td>
                                  <td className="px-4 sm:px-5 py-3 text-right">
                                    <DiffBadge diff={diff} />
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-surface-container-low px-4 sm:px-5 py-3 flex justify-between items-center flex-wrap gap-2">
                      {saveMessage ? <p className="text-sm font-semibold text-primary">{saveMessage}</p> : <span />}
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Counted by</p>
                        <p className="text-xs font-semibold truncate">{countedByLabel}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
