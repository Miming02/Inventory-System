import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { ScanItemsModal, ManualEntryModal, BatchUploadModal } from "./ReceiveModals";
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

export default function ReceiveInventory() {
  const { profile } = useAuth();
  const [activeModal, setActiveModal] = useState(null);
  const closeModal = useCallback(() => setActiveModal(null), []);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState("");
  const [recentReceipts, setRecentReceipts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRecentLoading(true);
      setRecentError("");
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      try {
        const { data: moves, error: mErr } = await supabase
          .from("stock_movements")
          .select(
            "id, quantity, created_at, reference_type, reference_id, to_location, notes, inventory_items ( name, sku )"
          )
          .eq("movement_type", "in")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(15);
        if (mErr) throw mErr;
        const list = moves ?? [];
        const purchaseIds = [
          ...new Set(
            list.filter((m) => m.reference_type === "purchase" && m.reference_id).map((m) => m.reference_id)
          ),
        ];
        let poById = new Map();
        if (purchaseIds.length > 0) {
          const { data: pos, error: pErr } = await supabase
            .from("purchase_orders")
            .select("id, po_number, suppliers ( name )")
            .in("id", purchaseIds);
          if (!pErr && pos) {
            poById = new Map(pos.map((p) => [p.id, p]));
          }
        }
        if (!cancelled) {
          setRecentReceipts(
            list.map((m) => {
              const item = m.inventory_items;
              const itemName = Array.isArray(item) ? item[0]?.name : item?.name;
              const sku = Array.isArray(item) ? item[0]?.sku : item?.sku;
              const po = m.reference_id && m.reference_type === "purchase" ? poById.get(m.reference_id) : null;
              const poNum = po?.po_number;
              const sup = po?.suppliers;
              const supName = Array.isArray(sup) ? sup[0]?.name : sup?.name;
              const sub = [poNum, supName].filter(Boolean).join(" • ") || (m.reference_type ?? "Inbound");
              return {
                id: m.id,
                title: itemName || sku || "Item",
                sub,
                qty: m.quantity ?? 0,
                loc: m.to_location || "—",
                created_at: m.created_at,
              };
            })
          );
        }
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
      <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl bg-gradient-to-b from-white/80 to-transparent">
        <div className="flex justify-between items-center px-4 sm:px-6 lg:px-8 h-14 w-full max-w-[1320px] mx-auto">
          <div className="flex items-center gap-6 lg:gap-8 min-w-0">
            <Link
              to="/"
              className="text-lg sm:text-xl font-extrabold font-manrope text-blue-700 tracking-tight hover:opacity-80 transition-opacity shrink-0"
            >
              The Fluid Curator
            </Link>
            <nav className="hidden md:flex gap-6 items-center">
              <Link className="font-manrope tracking-tight font-semibold text-slate-500 hover:text-blue-500 transition-colors duration-300" to="/inventory">
                Inventory
              </Link>
              <Link className="font-manrope tracking-tight font-semibold text-slate-500 hover:text-blue-500 transition-colors duration-300" to="/transfer">
                Transfer
              </Link>
              <Link className="font-manrope tracking-tight font-semibold text-blue-600 border-b-2 border-blue-600 pb-0.5" to="/receive">
                Receive
              </Link>
              <Link className="font-manrope tracking-tight font-semibold text-slate-500 hover:text-blue-500 transition-colors duration-300" to="/deliver">
                Deliver
              </Link>
              <Link className="font-manrope tracking-tight font-semibold text-slate-500 hover:text-blue-500 transition-colors duration-300" to="/count">
                Count
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:text-blue-600 transition-all active:opacity-80">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 text-slate-500 hover:text-blue-600 transition-all active:opacity-80">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="rounded-full border-2 border-primary-container bg-surface-container-high">
              <UserAvatarOrIcon src={profile?.avatar_url} alt={headerUserLabel(profile)} size="md" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 w-full max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-24 md:pb-3 lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-hidden">
        <div className="shrink-0 mb-2 sm:mb-3 pt-2 lg:pt-1">
          <h1 className="text-xl sm:text-2xl font-extrabold font-manrope tracking-tight text-on-surface mb-0.5">Receive Inventory</h1>
          <p className="text-on-surface-variant text-xs sm:text-sm max-w-2xl leading-snug line-clamp-2">
            Streamline your supply chain by logging incoming stock. Choose a method below to begin the curation process.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveModal("scan")}
            className="group relative overflow-hidden bg-primary-container rounded-xl p-4 text-left transition-all hover:shadow-[0_8px_24px_-4px_rgba(0,71,141,0.15)] active:scale-[0.99] flex flex-col justify-between gap-3"
          >
            <div className="absolute top-0 right-0 p-1 opacity-10 pointer-events-none">
              <span className="material-symbols-outlined !text-5xl">qr_code_scanner</span>
            </div>
            <div>
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-white text-2xl">qr_code_scanner</span>
              </div>
              <h2 className="text-base font-bold font-manrope text-white mb-1">Scan SKU or Code</h2>
              <p className="text-blue-100 text-[11px] sm:text-xs leading-snug line-clamp-2">
                Instantly identify products using your camera or handheld scanner for precise inventory tracking.
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
            className="group bg-surface-container-lowest rounded-xl p-4 text-left transition-all hover:shadow-[0_8px_24px_-4px_rgba(23,28,31,0.06)] active:scale-[0.99] flex flex-col justify-between gap-3 border border-outline-variant/10"
          >
            <div>
              <div className="w-10 h-10 bg-secondary-container rounded-lg flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-primary text-2xl">edit_note</span>
              </div>
              <h2 className="text-base font-bold font-manrope text-on-surface mb-1">Manual Input</h2>
              <p className="text-on-surface-variant text-[11px] sm:text-xs leading-snug line-clamp-2">
                For items without scannable codes. Enter stock details, quantities, and storage locations manually.
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
            className="group bg-surface-container-lowest rounded-xl p-4 text-left transition-all hover:shadow-[0_8px_24px_-4px_rgba(23,28,31,0.06)] active:scale-[0.99] flex flex-col justify-between gap-3 border border-outline-variant/10 sm:col-span-2 lg:col-span-1"
          >
            <div>
              <div className="w-10 h-10 bg-surface-container-high rounded-lg flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-on-surface-variant text-2xl">upload_file</span>
              </div>
              <h2 className="text-base font-bold font-manrope text-on-surface mb-1">Batch Upload</h2>
              <p className="text-on-surface-variant text-[11px] sm:text-xs leading-snug line-clamp-2">
                Processing a large shipment? Upload CSV or manifest files to receive multiple SKUs at once.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
              <span>Select File</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </button>
        </div>

        <div className="bg-surface-container-low rounded-xl p-3 sm:p-4 flex flex-col flex-1 min-h-0 lg:min-h-0 overflow-hidden">
          <div className="flex flex-row flex-wrap justify-between items-center gap-2 mb-2 shrink-0">
            <div>
              <h3 className="text-base font-bold font-manrope text-on-surface leading-tight">Recent Receipts</h3>
              <p className="text-on-surface-variant text-[11px] sm:text-xs">Last 24 hours of inbound movement</p>
            </div>
            <button type="button" className="text-primary font-semibold text-xs hover:underline decoration-2 underline-offset-2">
              View All Logs
            </button>
          </div>
          <div className="space-y-2 overflow-y-auto min-h-0 flex-1 lg:overscroll-contain pr-0.5">
            {recentError ? (
              <p className="text-xs text-error px-1 py-2">{recentError}</p>
            ) : recentLoading ? (
              <p className="text-xs text-on-surface-variant px-1 py-2">Loading recent receipts…</p>
            ) : recentReceipts.length === 0 ? (
              <p className="text-xs text-on-surface-variant px-1 py-2">
                Walang inbound movement sa nakaraang 24 oras. Mag-insert ng <code className="text-[10px]">stock_movements</code> (type{" "}
                <code className="text-[10px]">in</code>) sa Supabase para lumitaw dito ang real data.
              </p>
            ) : (
              recentReceipts.map((r) => (
                <div
                  key={r.id}
                  className="bg-surface-container-lowest p-2.5 sm:p-3 rounded-lg flex flex-row items-center justify-between gap-2 sm:gap-3 group hover:bg-surface-bright transition-colors"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-on-surface text-sm leading-tight truncate">{r.title}</p>
                      <p className="text-[10px] sm:text-xs text-on-surface-variant tracking-wide truncate">{r.sub}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right shrink-0">
                      <p className="font-bold text-on-surface text-xs sm:text-sm leading-none">+{r.qty}</p>
                      <p className="text-[10px] text-on-surface-variant hidden sm:block">{r.loc}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                      Received
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <ScanItemsModal open={activeModal === "scan"} onClose={closeModal} />
      <ManualEntryModal open={activeModal === "manual"} onClose={closeModal} />
      <BatchUploadModal open={activeModal === "batch"} onClose={closeModal} />

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe pt-2 bg-white/80 backdrop-blur-lg rounded-t-2xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)] border-t border-slate-100">
        <div className="flex flex-col items-center justify-center bg-blue-50 text-blue-700 rounded-xl px-4 py-1">
          <span className="material-symbols-outlined text-primary">input</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Receive</span>
        </div>
        <Link to="/transfer" className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined">sync_alt</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Transfer</span>
        </Link>
        <Link to="/inventory" className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined">inventory_2</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Stock</span>
        </Link>
        <Link to="/deliver" className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined">local_shipping</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Deliver</span>
        </Link>
        <Link to="/count" className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined">fact_check</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Count</span>
        </Link>
      </nav>
    </div>
  );
}
