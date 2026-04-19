import { useEffect } from "react";
import { useDistinctLocations } from "../../lib/useDistinctLocations";

function useModalA11y(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
}

export function TransferScanModal({ open, onClose }) {
  useModalA11y(open, onClose);
  const locations = useDistinctLocations(open);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 overflow-y-auto bg-on-surface/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-scan-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-5xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="bg-surface-container-lowest rounded-3xl shadow-[0_12px_32px_-4px_rgba(23,28,31,0.06)] overflow-hidden">
          <div className="px-8 py-6 flex items-center justify-between bg-surface-bright">
            <div>
              <h1 id="transfer-scan-title" className="text-2xl font-extrabold tracking-tight text-on-surface font-headline">
                Scan Items
              </h1>
              <p className="text-sm text-on-surface-variant font-medium">Inventory Transfer Workflow</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-high transition-colors" aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
            <div className="lg:col-span-5 p-8 bg-surface-container-low">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Scan SKU or Code</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">barcode_scanner</span>
                    <input
                      className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium text-on-surface"
                      placeholder="Scan or type code..."
                      type="text"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Quantity</label>
                    <input
                      className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium text-on-surface"
                      type="number"
                      defaultValue={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Transfer Date</label>
                    <input
                      className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium text-on-surface"
                      type="date"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">From Location</label>
                    <select className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium text-on-surface appearance-none">
                      <option value="">Select location…</option>
                      {locations.map((loc) => (
                        <option key={`from-${loc}`} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                    {locations.length === 0 ? (
                      <p className="text-[10px] text-on-surface-variant">Walang `location` sa inventory — maglagay muna sa items.</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">To Location</label>
                    <select className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium text-on-surface appearance-none">
                      <option value="">Select location…</option>
                      {locations.map((loc) => (
                        <option key={`to-${loc}`} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Transfer By</label>
                  <p className="text-xs text-on-surface-variant px-1 leading-relaxed">
                    Kapag naka-wire na ang submit, gagamitin ang iyong session (<code className="text-[10px]">created_by</code> sa{" "}
                    <code className="text-[10px]">stock_transfers</code>).
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Attachment</label>
                  <div className="border-2 border-dashed border-outline-variant rounded-2xl p-6 flex flex-col items-center justify-center bg-surface-container-highest/50 hover:bg-surface-container-highest transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-primary mb-2">cloud_upload</span>
                    <p className="text-xs font-semibold text-on-surface">Click to upload manifest</p>
                    <p className="text-[10px] text-on-surface-variant mt-1">PDF, JPG up to 5MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full py-4 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
                >
                  Add to List
                </button>
              </div>
            </div>
            <div className="lg:col-span-7 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-on-surface font-headline">Scanned Items (0)</h2>
                <button type="button" className="text-xs font-bold text-primary uppercase tracking-wider">
                  Clear All
                </button>
              </div>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                <p className="text-sm text-on-surface-variant leading-relaxed p-2">
                  Walang mock list. Pag naka-submit na ang flow, lalabas dito ang lines mula sa iyong session bago i-save sa{" "}
                  <code className="text-xs">stock_transfers</code> / <code className="text-xs">stock_transfer_items</code>.
                </p>
              </div>
              <div className="mt-8 pt-8 border-t border-outline-variant/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Total Items</span>
                  <span className="text-xl font-extrabold text-on-surface font-headline">0 Units</span>
                </div>
                <button
                  type="button"
                  className="px-10 py-4 bg-secondary-container text-on-secondary-container rounded-full font-bold hover:bg-secondary-fixed transition-colors active:scale-95 flex items-center justify-center gap-2"
                >
                  Proceed to Review
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 text-center">
          <p className="text-xs text-on-surface-variant font-medium">
            Use external scanner for faster entry. Keyboard shortcut:{" "}
            <kbd className="px-2 py-1 bg-surface-container-highest rounded-lg text-on-surface font-bold">⌘ + S</kbd>
          </p>
        </div>
      </div>
    </div>
  );
}

export function TransferManualModal({ open, onClose }) {
  useModalA11y(open, onClose);
  const locations = useDistinctLocations(open);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 lg:p-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-manual-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-on-background/20 backdrop-blur-sm" aria-hidden />
      <div className="relative w-full max-w-5xl bg-surface-container-lowest rounded-[2rem] shadow-[0_24px_64px_-12px_rgba(23,28,31,0.12)] overflow-hidden flex flex-col md:flex-row max-h-[min(921px,92vh)] my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 p-8 lg:p-12 overflow-y-auto min-h-0">
          <div className="mb-8 pr-10 md:pr-0">
            <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">Transfer Inventory</span>
            <h2 id="transfer-manual-title" className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">
              Manual Item Entry
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface-variant ml-4">SKU CODE</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-sm">qr_code_2</span>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-full py-3.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-outline"
                  placeholder="e.g. CUR-8829-BL"
                  type="text"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface-variant ml-4">ITEM NAME</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-full py-3.5 px-6 text-sm focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-outline"
                placeholder="Enter nomenclature..."
                type="text"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface-variant ml-4">QUANTITY TRANSFERRED</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-full py-3.5 px-6 text-sm focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-outline"
                placeholder="0"
                type="number"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface-variant ml-4">TRANSFER DATE</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-sm">calendar_today</span>
                <input className="w-full bg-surface-container-highest border-none rounded-full py-3.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-primary/10 transition-all" type="date" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface-variant ml-4">FROM LOCATION</label>
              <select className="w-full bg-surface-container-highest border-none rounded-full py-3.5 px-6 text-sm focus:ring-2 focus:ring-primary/10 transition-all appearance-none cursor-pointer">
                <option value="">Select location…</option>
                {locations.map((loc) => (
                  <option key={`mf-${loc}`} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface-variant ml-4">TO LOCATION</label>
              <select className="w-full bg-surface-container-highest border-none rounded-full py-3.5 px-6 text-sm focus:ring-2 focus:ring-primary/10 transition-all appearance-none cursor-pointer">
                <option value="">Select location…</option>
                {locations.map((loc) => (
                  <option key={`mt-${loc}`} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-semibold text-on-surface-variant ml-4">TRANSFER BY</label>
              <p className="text-xs text-on-surface-variant ml-4">Gagamitin ang naka-login na user kapag naka-save na sa database.</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface-variant ml-4">ATTACHMENT (OPTIONAL)</label>
              <div className="w-full bg-surface-container-highest rounded-full flex items-center px-4 h-[46px] border-2 border-dashed border-outline/20">
                <span className="material-symbols-outlined text-outline text-sm mr-2">upload_file</span>
                <span className="text-xs text-outline font-medium">Upload manifest or receipt</span>
              </div>
            </div>
          </div>
          <div className="mt-10 flex justify-end">
            <button
              type="button"
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-10 py-4 rounded-full font-bold text-sm tracking-wide shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Add Item
            </button>
          </div>
        </div>
        <div className="w-full md:w-96 bg-surface-container-low p-8 lg:p-10 flex flex-col shrink-0 min-h-0">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-headline font-bold text-lg text-on-surface">Queue Preview</h3>
            <span className="bg-primary-fixed text-on-primary-fixed px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">0 Items</span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto mb-8 min-h-0">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Walang mock queue. Magdadagdag ng rows dito pag may local state / API na para sa transfer lines.
            </p>
          </div>
          <div className="space-y-4 pt-6 border-t border-outline-variant/30 shrink-0">
            <div className="flex justify-between text-xs font-semibold text-on-surface-variant px-2">
              <span>EST. WEIGHT</span>
              <span className="text-on-surface">—</span>
            </div>
            <button
              type="button"
              className="w-full bg-on-background text-background py-4 rounded-full font-bold text-sm tracking-wide active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              Proceed to Review
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 h-10 w-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors z-10"
          aria-label="Close"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  );
}

export function TransferBatchModal({ open, onClose }) {
  useModalA11y(open, onClose);
  const locations = useDistinctLocations(open);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto py-8 px-4 md:px-8 bg-on-surface/40 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-batch-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-7xl pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="bg-surface-container-low rounded-[2rem] p-1 overflow-hidden">
          <div className="bg-surface-container-lowest rounded-[1.9rem] shadow-sm">
            <div className="px-8 py-8 flex items-center justify-between border-b border-outline-variant/10 gap-4">
              <div>
                <h1 id="transfer-batch-title" className="text-3xl font-extrabold tracking-tight text-on-surface font-headline">
                  Upload Inventory File
                </h1>
                <p className="text-on-surface-variant text-sm mt-1">Execute bulk transfers by curating your inventory records.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors shrink-0"
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
              <div className="lg:col-span-4 border-r border-outline-variant/10 p-8 space-y-8">
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">File Source</label>
                  <div className="group relative flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/30 rounded-xl p-8 bg-surface-container-low/50 hover:bg-surface-container-low transition-all cursor-pointer">
                    <span className="material-symbols-outlined text-4xl text-primary mb-3">upload_file</span>
                    <span className="text-sm font-semibold text-on-surface">Click to upload CSV/Excel</span>
                    <span className="text-xs text-on-surface-variant mt-1">Maximum file size: 25MB</span>
                    <input className="absolute inset-0 opacity-0 cursor-pointer" type="file" accept=".csv,.xlsx,.xls" />
                  </div>
                </div>
                <div className="bg-surface-container-low p-6 rounded-2xl space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">From Location</label>
                    <select className="w-full bg-surface-container-lowest border-none rounded-xl h-12 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all">
                      <option value="">Select…</option>
                      {locations.map((loc) => (
                        <option key={`bf-${loc}`} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-center -my-2 relative z-10">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shadow-lg">
                      <span className="material-symbols-outlined text-sm">south</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">To Location</label>
                    <select className="w-full bg-surface-container-lowest border-none rounded-xl h-12 px-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all">
                      <option value="">Select destination…</option>
                      {locations.map((loc) => (
                        <option key={`bt-${loc}`} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Transfer Date</label>
                    <input className="w-full bg-surface-container-low border-none rounded-xl h-12 px-4 text-sm focus:ring-2 focus:ring-primary/20" type="date" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Transfer By</label>
                    <p className="text-[10px] text-on-surface-variant px-1 pt-2">Current user (pag naka-submit na)</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Attachment (Optional)</label>
                  <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
                    <span className="material-symbols-outlined text-on-surface-variant">attach_file</span>
                    <span className="text-xs text-on-surface-variant">Add supporting documentation...</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full h-14 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-bold tracking-tight shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Validate File
                  <span className="material-symbols-outlined">analytics</span>
                </button>
              </div>
              <div className="lg:col-span-8 p-8 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-on-surface font-headline">Transfer Preview</h2>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase tracking-tighter">
                      0 rows
                    </span>
                  </div>
                </div>
                <div className="flex-grow overflow-auto bg-surface-container-low/30 rounded-2xl min-h-[200px] max-h-[360px] lg:max-h-[420px]">
                  <table className="w-full text-left border-separate border-spacing-0 min-w-[640px]">
                    <thead className="sticky top-0 bg-surface-container-highest/80 backdrop-blur-md z-10">
                      <tr>
                        <th className="p-4 text-[10px] font-bold uppercase text-on-surface-variant">SKU ID</th>
                        <th className="p-4 text-[10px] font-bold uppercase text-on-surface-variant">Product Name</th>
                        <th className="p-4 text-[10px] font-bold uppercase text-on-surface-variant">Quantity</th>
                        <th className="p-4 text-[10px] font-bold uppercase text-on-surface-variant">Condition</th>
                        <th className="p-4 text-[10px] font-bold uppercase text-on-surface-variant">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      <tr>
                        <td colSpan={5} className="p-8 text-sm text-on-surface-variant text-center">
                          I-parse ang CSV at i-validate laban sa <code className="text-xs">inventory_items</code> para lumitaw ang rows dito — walang hardcoded preview.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-8 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 pt-8 border-t border-outline-variant/10">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant">Estimated Weight</span>
                      <span className="text-lg font-bold text-on-surface font-headline">—</span>
                    </div>
                    <div className="w-px h-10 bg-outline-variant/20 mx-2 hidden sm:block" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant">Total Value</span>
                      <span className="text-lg font-bold text-on-surface font-headline">—</span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-8 h-14 rounded-full bg-secondary-container text-on-secondary-container font-bold transition-all hover:bg-secondary-fixed"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      className="px-10 h-14 rounded-full bg-primary text-white font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                    >
                      Review and Confirm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface-container-low p-8 rounded-3xl border border-white/50 relative overflow-hidden group">
            <div className="relative z-10">
              <span className="material-symbols-outlined text-primary mb-4">verified_user</span>
              <h3 className="font-bold text-lg mb-2 font-headline">Secure Validation</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Every SKU is validated against the global catalog to ensure data integrity during transit.
              </p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
              <span className="material-symbols-outlined text-[120px]">shield</span>
            </div>
          </div>
          <div className="bg-surface-container-low p-8 rounded-3xl border border-white/50 relative overflow-hidden group">
            <div className="relative z-10">
              <span className="material-symbols-outlined text-primary mb-4">track_changes</span>
              <h3 className="font-bold text-lg mb-2 font-headline">Live Tracking</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Once confirmed, this transfer will appear in the active logistics pipeline for real-time monitoring.
              </p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
              <span className="material-symbols-outlined text-[120px]">location_on</span>
            </div>
          </div>
          <div className="bg-surface-container-low p-8 rounded-3xl border border-white/50 relative overflow-hidden group">
            <div className="relative z-10">
              <span className="material-symbols-outlined text-primary mb-4">inventory_2</span>
              <h3 className="font-bold text-lg mb-2 font-headline">Conflict Resolution</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Intelligent duplicate detection prevents overlapping stock allocations during large uploads.
              </p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
              <span className="material-symbols-outlined text-[120px]">dynamic_form</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
