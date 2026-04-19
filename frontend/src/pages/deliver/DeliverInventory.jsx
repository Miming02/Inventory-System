import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { DeliverScanModal, DeliverManualModal, DeliverBatchModal } from "./DeliverModals";

export default function DeliverInventory() {
  const [activeModal, setActiveModal] = useState(null);
  const closeModal = useCallback(() => setActiveModal(null), []);

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
              <a className="font-manrope tracking-tight font-semibold text-slate-500 hover:text-blue-500 transition-colors duration-300" href="#">Inventory</a>
              <a className="font-manrope tracking-tight font-semibold text-slate-500 hover:text-blue-500 transition-colors duration-300" href="#">Transfer</a>
              <a className="font-manrope tracking-tight font-semibold text-slate-500 hover:text-blue-500 transition-colors duration-300" href="#">Production</a>
              <a className="font-manrope tracking-tight font-semibold text-slate-500 hover:text-blue-500 transition-colors duration-300" href="#">Dispatch</a>
              <a className="font-manrope tracking-tight font-semibold text-slate-500 hover:text-blue-500 transition-colors duration-300" href="#">Audit</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:text-blue-600 transition-all active:opacity-80" type="button">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 text-slate-500 hover:text-blue-600 transition-all active:opacity-80" type="button">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-high border-2 border-primary-container">
              <img className="w-full h-full object-cover" alt="Manager profile avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0LCd9E4nE7ywQHcRnVBxfEj2BPODwcH7L-wupSdcIyd4UzjZGfDvK5vdcTy3NdOISI1VVdBiNpWDHJEIOaLYBJczG99HtJaQzMYr1LP5uHQ-YKbYo7B_I6eG8RZ1mneWyQ1clK7aWayb5mJ_0mjD08RCd8_ShqbLizlbVu7V44UBa56deKwoV7a0Jtoz17c-24hCzA3PbiyIhZfCPO-q3qeP9nWgBApsNaT8nSQryhcgMW7YhgjapT2THHivtZOkE9l-HxnmyKBQ" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 w-full max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-24 md:pb-3 lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-hidden">
        <div className="shrink-0 mb-2 sm:mb-3 pt-2 lg:pt-1">
          <h1 className="text-xl sm:text-2xl font-extrabold font-manrope tracking-tight text-on-surface mb-0.5">Deliver Inventory</h1>
          <p className="text-on-surface-variant text-xs sm:text-sm max-w-2xl leading-snug line-clamp-2">
            Send items to external parties and track outgoing deliveries with professional precision.
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
                Scan items quickly and deliver them using barcode or QR code. Perfect for high-volume dispatching.
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
                Manually enter item details and delivery information for curated, bespoke shipments.
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
                Upload a CSV or spreadsheet to deliver multiple items at once. Optimized for large scale logistics.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
              <span>Select File</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </button>
        </div>

        <div className="bg-surface-container-low rounded-xl p-3 sm:p-4 shrink-0">
          <div className="relative overflow-hidden rounded-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold font-manrope text-on-surface leading-tight">Need a delivery summary?</h3>
                <p className="text-on-surface-variant text-[11px] sm:text-xs mt-0.5 line-clamp-2">
                  Access your recently completed deliveries and manifests in the reporting dashboard.
                </p>
              </div>
              <button type="button" className="shrink-0 px-4 py-2 text-xs sm:text-sm bg-surface-container-lowest text-primary border border-outline-variant/30 rounded-full font-semibold transition-all hover:bg-white hover:shadow-md self-start sm:self-center">
                View Reports
              </button>
            </div>
          </div>
        </div>
      </main>

      <DeliverScanModal open={activeModal === "scan"} onClose={closeModal} />
      <DeliverManualModal open={activeModal === "manual"} onClose={closeModal} />
      <DeliverBatchModal open={activeModal === "batch"} onClose={closeModal} />

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe pt-2 bg-white/80 backdrop-blur-lg rounded-t-2xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)] border-t border-slate-100">
        <Link to="/receive" className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined">input</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Receive</span>
        </Link>
        <button type="button" className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined">sync_alt</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Transfer</span>
        </button>
        <button type="button" className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined">precision_manufacturing</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Work</span>
        </button>
        <div className="flex flex-col items-center justify-center bg-blue-50 text-blue-700 rounded-xl px-4 py-1">
          <span className="material-symbols-outlined text-primary">local_shipping</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Ship</span>
        </div>
        <button type="button" className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50 rounded-xl">
          <span className="material-symbols-outlined">fact_check</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Audit</span>
        </button>
      </nav>
    </div>
  );
}
