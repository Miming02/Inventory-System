import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { TransferScanModal, TransferManualModal, TransferBatchModal } from "./TransferModals";
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

function transferStatusBadge(status) {
  const s = (status || "").toLowerCase();
  if (s === "completed") {
    return (
      <span className="px-2 py-0.5 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 rounded-full text-[10px] font-semibold whitespace-nowrap">
        Completed
      </span>
    );
  }
  if (s === "in_transit") {
    return (
      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 rounded-full text-[10px] font-semibold whitespace-nowrap">
        In transit
      </span>
    );
  }
  if (s === "cancelled") {
    return (
      <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant rounded-full text-[10px] font-semibold whitespace-nowrap">
        Cancelled
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 rounded-full text-[10px] font-semibold whitespace-nowrap">
      {s || "Pending"}
    </span>
  );
}

export default function TransferInventory() {
  const { profile } = useAuth();
  const [activeModal, setActiveModal] = useState(null);
  const closeModal = useCallback(() => setActiveModal(null), []);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState("");
  const [recentRows, setRecentRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRecentLoading(true);
      setRecentError("");
      try {
        const { data, error } = await supabase
          .from("stock_transfers")
          .select("id, transfer_number, from_location, to_location, status, created_at, stock_transfer_items(count)")
          .order("created_at", { ascending: false })
          .limit(25);
        if (error) throw error;
        if (!cancelled) setRecentRows(data ?? []);
      } catch (e) {
        if (!cancelled) setRecentError(getErrorMessage(e));
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-surface text-on-surface min-h-dvh flex flex-col lg:h-dvh lg:max-h-dvh lg:overflow-hidden pb-24 md:pb-0">
      <header className="fixed top-0 w-full z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl bg-gradient-to-b from-white/80 to-transparent dark:from-slate-900/80 dark:to-transparent shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex justify-between items-center h-14 px-4 sm:px-6 lg:px-8 w-full max-w-[1320px] mx-auto">
          <div className="flex items-center gap-4 lg:gap-8 min-w-0">
            <Link
              to="/"
              className="text-lg sm:text-xl font-extrabold font-manrope text-blue-700 dark:text-blue-400 tracking-tight hover:opacity-80 transition-opacity shrink-0"
            >
              The Fluid Curator
            </Link>
            <nav className="hidden md:flex gap-4 lg:gap-6 items-center shrink-0 text-sm">
              <Link className="font-manrope font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors" to="/">
                Dashboard
              </Link>
              <Link className="font-manrope font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors" to="/inventory">
                Inventory
              </Link>
              <span className="font-manrope font-semibold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-0.5">
                Transfer
              </span>
              <Link className="font-manrope font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors" to="/receive">
                Receive
              </Link>
              <Link className="font-manrope font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors" to="/deliver">
                Deliver
              </Link>
              <Link className="font-manrope font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors" to="/count">
                Count
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 min-w-0">
            <div className="relative hidden lg:block">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                className="pl-9 pr-3 py-1.5 bg-surface-container-highest border-none rounded-full text-xs w-40 xl:w-52 focus:ring-2 focus:ring-primary/20"
                placeholder="Global Search..."
                type="search"
                aria-label="Global search"
              />
            </div>
            <button type="button" className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
            </button>
            <button type="button" className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <span className="material-symbols-outlined text-[22px]">settings</span>
            </button>
            <div className="ml-1 shrink-0 ring-2 ring-surface-container-high rounded-full">
              <UserAvatarOrIcon src={profile?.avatar_url} alt={headerUserLabel(profile)} size="md" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 w-full max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-24 md:pb-3 lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-hidden">
        <div className="shrink-0 mb-2 sm:mb-3 pt-2 lg:pt-1">
          <h1 className="text-xl sm:text-2xl font-extrabold font-manrope tracking-tight text-on-surface mb-0.5">Transfer Inventory</h1>
          <p className="text-on-surface-variant text-xs sm:text-sm max-w-2xl leading-snug line-clamp-2">
            Move items between locations and track inventory transfers with precision and real-time oversight.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveModal("scan")}
            className="group relative overflow-hidden bg-primary-container rounded-xl p-4 text-left transition-all hover:shadow-[0_8px_24px_-4px_rgba(0,71,141,0.15)] active:scale-[0.99] flex flex-col justify-between gap-3"
          >
            <div className="absolute top-0 right-0 p-1 opacity-10 pointer-events-none">
              <span className="material-symbols-outlined !text-5xl">transfer_within_a_station</span>
            </div>
            <div>
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center mb-2">
                <span
                  className="material-symbols-outlined text-white text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  barcode_scanner
                </span>
              </div>
              <h2 className="text-base font-bold font-manrope text-white mb-1">Scan SKU or Code</h2>
              <p className="text-blue-100 text-[11px] sm:text-xs leading-snug line-clamp-2">
                Quickly scan items and transfer them between locations using barcode or QR code.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-white font-semibold text-xs">
              <span>Activate Scanner</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal("manual")}
            className="group bg-surface-container-lowest rounded-xl p-4 text-left transition-all hover:shadow-[0_8px_24px_-4px_rgba(23,28,31,0.06)] active:scale-[0.99] flex flex-col justify-between gap-3 border border-outline-variant/10 dark:border-slate-700/50"
          >
            <div>
              <div className="w-10 h-10 bg-secondary-container rounded-lg flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-primary text-2xl">edit_note</span>
              </div>
              <h2 className="text-base font-bold font-manrope text-on-surface mb-1">Manual Input</h2>
              <p className="text-on-surface-variant text-[11px] sm:text-xs leading-snug line-clamp-2">
                Manually enter item details and transfer quantities between locations using guided forms.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
              <span>Open Form</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal("batch")}
            className="group bg-surface-container-lowest rounded-xl p-4 text-left transition-all hover:shadow-[0_8px_24px_-4px_rgba(23,28,31,0.06)] active:scale-[0.99] flex flex-col justify-between gap-3 border border-outline-variant/10 dark:border-slate-700/50 sm:col-span-2 lg:col-span-1"
          >
            <div>
              <div className="w-10 h-10 bg-surface-container-high rounded-lg flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-on-surface-variant text-2xl">upload_file</span>
              </div>
              <h2 className="text-base font-bold font-manrope text-on-surface mb-1">Batch Upload</h2>
              <p className="text-on-surface-variant text-[11px] sm:text-xs leading-snug line-clamp-2">
                Upload a CSV or spreadsheet to transfer multiple items at once for large warehouse moves.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
              <span>Select File</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </button>
        </div>

        <section className="flex flex-col flex-1 min-h-0 overflow-hidden bg-surface-container-low rounded-xl p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0">
            <div>
              <h3 className="text-base font-bold font-manrope text-on-surface leading-tight">Recent transfers</h3>
              <p className="text-on-surface-variant text-[11px] sm:text-xs">Mula sa stock_transfers (pinakabago)</p>
            </div>
            <button type="button" className="text-primary font-semibold text-xs hover:underline inline-flex items-center gap-0.5">
              View Activity Log
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </button>
          </div>
          <div className="bg-surface-container-lowest rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col border border-outline-variant/10">
            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 lg:overscroll-contain">
              <table className="w-full text-left border-collapse min-w-[480px]">
                <thead className="sticky top-0 z-[1] bg-surface-container-lowest shadow-sm">
                  <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 border-b border-surface-container">
                    <th className="px-3 sm:px-4 py-2 text-left">Transfer ID</th>
                    <th className="px-3 sm:px-4 py-2 text-left">From</th>
                    <th className="px-3 sm:px-4 py-2 text-left">To</th>
                    <th className="px-3 sm:px-4 py-2 text-left">Items</th>
                    <th className="px-3 sm:px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                  {recentError ? (
                    <tr>
                      <td colSpan={5} className="px-3 sm:px-4 py-4 text-error text-xs">
                        {recentError}
                      </td>
                    </tr>
                  ) : recentLoading ? (
                    <tr>
                      <td colSpan={5} className="px-3 sm:px-4 py-4 text-on-surface-variant text-xs">
                        Loading…
                      </td>
                    </tr>
                  ) : recentRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 sm:px-4 py-4 text-on-surface-variant text-xs">
                        Walang transfer record. Gumawa sa <code className="text-[10px]">stock_transfers</code> +{" "}
                        <code className="text-[10px]">stock_transfer_items</code> para lumitaw dito.
                      </td>
                    </tr>
                  ) : (
                    recentRows.map((t, i) => {
                      const cnt = Array.isArray(t.stock_transfer_items) ? t.stock_transfer_items[0]?.count : null;
                      const lineCount = cnt != null ? cnt : 0;
                      return (
                        <tr
                          key={t.id}
                          className={`hover:bg-surface-container-low/50 transition-colors ${i > 0 ? "border-t border-surface-container/30" : ""}`}
                        >
                          <td className="px-3 sm:px-4 py-2 font-medium">{t.transfer_number ?? t.id}</td>
                          <td className="px-3 sm:px-4 py-2 truncate max-w-[10rem]" title={t.from_location}>
                            {t.from_location}
                          </td>
                          <td className="px-3 sm:px-4 py-2 truncate max-w-[10rem]" title={t.to_location}>
                            {t.to_location}
                          </td>
                          <td className="px-3 sm:px-4 py-2">{lineCount} line(s)</td>
                          <td className="px-3 sm:px-4 py-2">{transferStatusBadge(t.status)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-4 right-4 max-w-[280px] p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl shadow-xl border border-white/20 z-30 hidden 2xl:block pointer-events-auto">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 rounded-lg shrink-0">
            <span className="material-symbols-outlined text-primary text-lg">info</span>
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-xs mb-0.5 font-headline">Transfer Guidelines</h4>
            <p className="text-[11px] text-on-surface-variant leading-snug">
              Scan items at both origin and destination to keep inventory accurate.
            </p>
          </div>
        </div>
      </div>

      <TransferScanModal open={activeModal === "scan"} onClose={closeModal} />
      <TransferManualModal open={activeModal === "manual"} onClose={closeModal} />
      <TransferBatchModal open={activeModal === "batch"} onClose={closeModal} />

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe pt-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg rounded-t-2xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)] border-t border-slate-100 dark:border-slate-800">
        <Link to="/receive" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">
          <span className="material-symbols-outlined">input</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Receive</span>
        </Link>
        <div className="flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-xl px-4 py-1">
          <span className="material-symbols-outlined text-primary">sync_alt</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Transfer</span>
        </div>
        <button type="button" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">
          <span className="material-symbols-outlined">precision_manufacturing</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Work</span>
        </button>
        <Link to="/deliver" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">
          <span className="material-symbols-outlined">local_shipping</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Deliver</span>
        </Link>
        <button type="button" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">
          <span className="material-symbols-outlined">fact_check</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Audit</span>
        </button>
      </nav>
    </div>
  );
}
