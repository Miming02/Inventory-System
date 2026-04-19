import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ScanItemsModal, ManualEntryModal, BatchUploadModal } from "./ReceiveModals";

export default function ReceiveInventory() {
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
            <button className="p-2 text-slate-500 hover:text-blue-600 transition-all active:opacity-80">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 text-slate-500 hover:text-blue-600 transition-all active:opacity-80">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-high border-2 border-primary-container">
              <img className="w-full h-full object-cover" alt="Manager profile avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBpER51ND7Mp_n0nTRrFbSifCTGRRrFZKuoWvnUt-6MCmhtLtg52L6GQD_H4_YTHUKabnGYJKpe9HUR9i3X1cwMWcYwz4ySdVtD1OsQq1XgvdeK1Q9XmdsAd4KlUU-MB0MYfyrmEsW654Xc9Xx3c1PTFhVgpfWoRGFXgyvVcvB5vHVgFocwg_Xa1xlDU8i70VfLJOdgxhxyYh7up4vq1ZPDZ_WSwwZ0l1IW7DaPLa3DgpR1_qzHL2DVQ0B0sLLLnM2wtHN9i6LUb9E" />
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
            <div className="bg-surface-container-lowest p-2.5 sm:p-3 rounded-lg flex flex-row items-center justify-between gap-2 sm:gap-3 group hover:bg-surface-bright transition-colors">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-on-surface text-sm leading-tight truncate">Nordic Lounge Chair (OAK-22)</p>
                  <p className="text-[10px] sm:text-xs text-on-surface-variant tracking-wide truncate">PO-99238 • NorthWoods Mfg.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right shrink-0">
                  <p className="font-bold text-on-surface text-xs sm:text-sm leading-none">+45</p>
                  <p className="text-[10px] text-on-surface-variant hidden sm:block">A-12</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                  In Stock
                </span>
                <button type="button" className="p-1 text-on-surface-variant hover:text-primary hidden sm:block">
                  <span className="material-symbols-outlined text-lg">more_vert</span>
                </button>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-2.5 sm:p-3 rounded-lg flex flex-row items-center justify-between gap-2 sm:gap-3 group hover:bg-surface-bright transition-colors">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">conveyor_belt</span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-on-surface text-sm leading-tight truncate">Glass Pendant Light (GLS-400)</p>
                  <p className="text-[10px] sm:text-xs text-on-surface-variant tracking-wide truncate">PO-99241 • Aurora Glass</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="font-bold text-on-surface text-xs sm:text-sm leading-none">+12</p>
                  <p className="text-[10px] text-on-surface-variant">QC</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                  Pending QC
                </span>
                <button type="button" className="p-1 text-on-surface-variant hover:text-primary hidden sm:block">
                  <span className="material-symbols-outlined text-lg">more_vert</span>
                </button>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-2.5 sm:p-3 rounded-lg flex flex-row items-center justify-between gap-2 sm:gap-3 group hover:bg-surface-bright transition-colors">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">package_2</span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-on-surface text-sm leading-tight truncate">Textured Wool Rug (RUG-09)</p>
                  <p className="text-[10px] sm:text-xs text-on-surface-variant tracking-wide truncate">PO-99245 • Textile Co.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="font-bold text-on-surface text-xs sm:text-sm leading-none">+200</p>
                  <p className="text-[10px] text-on-surface-variant">Dock 4</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                  In Stock
                </span>
                <button type="button" className="p-1 text-on-surface-variant hover:text-primary hidden sm:block">
                  <span className="material-symbols-outlined text-lg">more_vert</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ScanItemsModal open={activeModal === "scan"} onClose={closeModal} />
      <ManualEntryModal open={activeModal === "manual"} onClose={closeModal} />
      <BatchUploadModal open={activeModal === "batch"} onClose={closeModal} />

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe pt-2 bg-white/80 backdrop-blur-lg rounded-t-2xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)] border-t border-slate-100">
        <button className="flex flex-col items-center justify-center bg-blue-50 text-blue-700 rounded-xl px-4 py-1">
          <span className="material-symbols-outlined text-primary">input</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Receive</span>
        </button>
        <button className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50">
          <span className="material-symbols-outlined">sync_alt</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Transfer</span>
        </button>
        <button className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50">
          <span className="material-symbols-outlined">precision_manufacturing</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Work</span>
        </button>
        <button className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50">
          <span className="material-symbols-outlined">local_shipping</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Ship</span>
        </button>
        <button className="flex flex-col items-center justify-center text-slate-400 px-4 py-1 hover:bg-slate-50">
          <span className="material-symbols-outlined">fact_check</span>
          <span className="font-inter text-[10px] font-medium uppercase tracking-widest mt-1">Audit</span>
        </button>
      </nav>
    </div>
  );
}
