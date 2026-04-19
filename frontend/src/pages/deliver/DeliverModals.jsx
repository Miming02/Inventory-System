import { useEffect } from "react";

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

const MANUAL_PREVIEW = [
  {
    name: "Premium Leather Pack",
    sku: "SKU-990-LP",
    qty: "12",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBpOByavR4LwFqKnHYl3gkxViYN_zuBmNp3EWqNGdbS8ZBajnHD72babkY9gzYDsKNwYFFT_oWBGhXIpQuQsfrxc_kKV56bWYzFZQZHPPDXZ9UJNUZKxnKju4Kd0h7Vc8yt5qZNogwJs2D65b9a8VP7O02lsMSDjk-h-eOx3fB3F40vY-5zqbe2Nw5WBdoLPnuOaA2JZXTM9omx5Jca__uGBf67ScqcSqFcO7dx--jsdtHWQlB8O-EMBIx4lLFq33fsIoIIUXqMpqU",
    dataAlt:
      "close-up of a high-end black textured leather backpack with metallic accents on a minimalist grey background"
  },
  {
    name: "Velocity Sneakers",
    sku: "SKU-882-VS",
    qty: "45",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDYYBkqa8ijs_GD1HmBCG0KvzFeI_ZUIwYDU_Jbf6nstzv8C_CbM9AQRH7NFVrxBc4Tx_rpk8yh6t6hR_Oe4Ou_drdGq5US2hGb_WzCPX-DzQ_v-6HfptV3RY-5aIZ1wALjbGNnI0vcnE5KhqPhBkOiV9nQOW533VdnSXVyuaX9RhejImdS3w9t89CQMjT2JbFYp0NlvsQhkZ2pNnaf-KB1035Nd0k04bvYi8ouVbARF5ravJ7SrJ9Q_BfvdEgbdqHYKKWCVj6GTv4",
    dataAlt: "sleek red high-performance athletic running shoe floating in a clean studio light environment"
  },
  {
    name: "Essential Watch",
    sku: "SKU-771-EW",
    qty: "8",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBMQMWzAuSakO9UT3fJr0xX9YHWZam2guEt7pw_5Gut7MNaencYYrytzBzkzzWbD897eGbNSkJ6nBQJGkE_U3lQbIw_atJo10aKYkI1wSmvReY4DKnnb7SXm29Aw7TOgaXFMEAoyfa2jBQb7rIIlPGdPjcJnTHkLOBmaMSKFC6WHJ4C5wDhfolCtWJqXDzc-VPpW5h1CC4P6ZbFtKuShmmvTAg_y2ty2cAnh9yY3Clc0rdZGZzSnIbkoc3BZkKRS_88HAzCYSPm4C8",
    dataAlt: "minimalist white wristwatch with a silver dial and brown leather strap on a soft white marble surface"
  }
];

export function DeliverScanModal({ open, onClose }) {
  useModalA11y(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-on-surface/10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deliver-scan-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[min(921px,92vh)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-10 py-8 flex justify-between items-center bg-surface-bright gap-4 shrink-0">
          <div>
            <h1 id="deliver-scan-title" className="text-3xl font-extrabold tracking-tighter text-on-surface font-headline">
              Scan Items
            </h1>
            <p className="text-on-surface-variant font-medium text-sm mt-1">Delivery Session ID: DC-9842-X</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full transition-all active:scale-95 shrink-0"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex flex-col md:flex-row flex-grow overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-surface-container-lowest min-h-0">
            <div className="space-y-2">
              <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant px-1">Barcode Scanner</label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-primary">barcode_scanner</span>
                <input
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all placeholder:text-outline"
                  placeholder="Scan or type barcode manually..."
                  type="text"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant px-1">Quantity Delivered</label>
                <input
                  className="w-full px-4 py-4 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                  min={1}
                  type="number"
                  defaultValue={1}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant px-1">Receiver</label>
                <input
                  className="w-full px-4 py-4 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                  placeholder="Full name..."
                  type="text"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant px-1">Location / Address</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-outline">location_on</span>
                  <input
                    className="w-full pl-12 pr-4 py-4 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                    placeholder="Bay 4, Sector G..."
                    type="text"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant px-1">Delivery Date</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-outline">calendar_today</span>
                  <input
                    className="w-full pl-12 pr-4 py-4 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                    type="date"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant px-1">Delivered By</label>
                <select className="w-full px-4 py-4 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest appearance-none transition-all">
                  <option>Marcus Thorne (Lead)</option>
                  <option>Sarah Jenkins</option>
                  <option>Alex Riviera</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant px-1">Attachment (POD)</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-14 border-2 border-dashed border-outline-variant rounded-xl cursor-pointer hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-outline">cloud_upload</span>
                      <span className="text-sm font-medium text-on-surface-variant">Upload File</span>
                    </div>
                    <input className="hidden" type="file" />
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full md:w-[400px] bg-surface-container-low p-8 border-l border-white/20 overflow-y-auto min-h-0 flex flex-col">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-lg font-bold tracking-tight text-on-surface font-headline">Scanned Items</h2>
              <span className="text-xs font-bold text-primary bg-primary-fixed px-2 py-1 rounded-full">4 Total</span>
            </div>
            <div className="space-y-3 flex-1 min-h-0">
              <div className="group bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-on-secondary-container">inventory_2</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-on-surface truncate">Precision Lens X-1</h4>
                    <p className="text-xs text-on-surface-variant">Qty: 12 units</p>
                  </div>
                </div>
                <button type="button" className="text-outline hover:text-tertiary transition-colors p-1 rounded-full hover:bg-tertiary-fixed opacity-0 group-hover:opacity-100 shrink-0" aria-label="Remove">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
              <div className="group bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-on-secondary-container">construction</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-on-surface truncate">Steel Mount Base</h4>
                    <p className="text-xs text-on-surface-variant">Qty: 4 units</p>
                  </div>
                </div>
                <button type="button" className="text-outline hover:text-tertiary transition-colors p-1 rounded-full hover:bg-tertiary-fixed opacity-0 group-hover:opacity-100 shrink-0" aria-label="Remove">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
              <div className="group bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between shadow-sm transition-all hover:shadow-md border border-tertiary/10">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-tertiary-fixed-dim flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-on-tertiary-fixed-variant">warning</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-on-surface truncate">Titanium Alloy Tube</h4>
                    <p className="text-xs text-on-tertiary-fixed-variant">Qty: 25 units (Overstock)</p>
                  </div>
                </div>
                <button type="button" className="text-outline hover:text-tertiary transition-colors p-1 rounded-full hover:bg-tertiary-fixed opacity-0 group-hover:opacity-100 shrink-0" aria-label="Remove">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
              <div className="group bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-on-secondary-container">package</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-on-surface truncate">Ceramic Buffer Pad</h4>
                    <p className="text-xs text-on-surface-variant">Qty: 100 units</p>
                  </div>
                </div>
                <button type="button" className="text-outline hover:text-tertiary transition-colors p-1 rounded-full hover:bg-tertiary-fixed opacity-0 group-hover:opacity-100 shrink-0" aria-label="Remove">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-outline-variant/20 shrink-0">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Capacity Used</span>
                <span className="text-xs font-bold text-primary">64%</span>
              </div>
              <div className="h-1.5 w-full bg-primary-fixed rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full w-[64%]" />
              </div>
            </div>
          </div>
        </div>
        <div className="px-10 py-8 bg-surface-bright flex flex-col sm:flex-row justify-end gap-4 shrink-0">
          <button
            type="button"
            className="order-2 sm:order-1 px-8 py-4 text-on-secondary-container font-bold rounded-full bg-secondary-container transition-all duration-300 hover:brightness-95 active:scale-95"
          >
            Proceed to Review
          </button>
          <button
            type="button"
            className="order-1 sm:order-2 px-8 py-4 text-on-primary font-bold rounded-full bg-gradient-to-r from-primary to-primary-container shadow-lg shadow-primary/20 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">add</span>
            Add to List
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeliverManualModal({ open, onClose }) {
  useModalA11y(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deliver-manual-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative bg-surface-container-lowest w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[min(921px,92vh)] my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 p-10 overflow-y-auto border-r border-outline-variant/10 min-h-0">
          <div className="mb-8">
            <h2 id="deliver-manual-title" className="text-2xl font-extrabold tracking-tight text-on-surface mb-2 font-headline">
              Manual Item Entry
            </h2>
            <p className="text-on-surface-variant text-sm font-medium">Precision data entry for new stock deliveries.</p>
          </div>
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">SKU Code</label>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                  placeholder="e.g. SKU-990-LP"
                  type="text"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Item Name</label>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                  placeholder="e.g. Premium Leather Pack"
                  type="text"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Quantity Delivered</label>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                  placeholder="0"
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Receiver</label>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                  placeholder="Staff member name"
                  type="text"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Location / Delivery Address</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                placeholder="Warehouse Section A / Bay 4"
                type="text"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Delivery Date</label>
                <input className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all" type="date" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Delivered By</label>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                  placeholder="Courier or Vendor"
                  type="text"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Attachment</label>
              <div className="w-full border-2 border-dashed border-outline-variant/30 rounded-xl p-6 flex flex-col items-center justify-center bg-surface-container-low hover:bg-surface-container hover:border-primary/40 transition-all cursor-pointer">
                <span className="material-symbols-outlined text-primary mb-2">cloud_upload</span>
                <span className="text-sm font-semibold text-on-surface">Upload Delivery Note or Image</span>
                <span className="text-xs text-on-surface-variant mt-1">PDF, JPG, PNG (Max 5MB)</span>
              </div>
            </div>
            <button
              type="button"
              className="w-full bg-primary hover:bg-primary-container text-on-primary py-4 rounded-full font-bold text-lg tracking-tight transition-all duration-300 transform active:scale-95 shadow-lg shadow-primary/20 mt-4"
            >
              Add Item
            </button>
          </form>
        </div>
        <div className="w-full md:w-[400px] bg-surface-container-low p-10 flex flex-col shrink-0 min-h-0">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold tracking-tight font-headline text-on-surface">Entry Preview</h3>
            <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs font-bold">3 ITEMS</span>
          </div>
          <div className="flex-grow space-y-4 overflow-y-auto min-h-0">
            {MANUAL_PREVIEW.map((item) => (
              <div
                key={item.sku}
                className="bg-surface-container-lowest p-5 rounded-2xl flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-12 w-12 rounded-xl bg-surface-container-high overflow-hidden shrink-0 flex items-center justify-center">
                  <img alt={item.name} data-alt={item.dataAlt} className="w-full h-full object-cover" src={item.img} />
                </div>
                <div className="flex-grow min-w-0">
                  <p className="font-bold text-on-surface truncate">{item.name}</p>
                  <p className="text-xs font-medium text-on-surface-variant tracking-wider">
                    {item.sku} • Qty: {item.qty}
                  </p>
                  <button type="button" className="text-[10px] uppercase tracking-widest font-bold text-tertiary mt-2 hover:underline">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 space-y-4 shrink-0">
            <div className="pt-6 border-t border-outline-variant/20">
              <div className="flex justify-between items-center mb-6">
                <span className="text-sm font-medium text-on-surface-variant">Batch Total</span>
                <span className="text-lg font-extrabold text-on-surface font-headline">65 Items</span>
              </div>
              <button
                type="button"
                className="w-full bg-on-surface text-surface py-4 rounded-full font-bold tracking-tight transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2"
              >
                Proceed to Review
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors z-10"
          aria-label="Close"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  );
}

export function DeliverBatchModal({ open, onClose }) {
  useModalA11y(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 overflow-y-auto bg-on-surface/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deliver-batch-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative z-10 w-full max-w-6xl bg-surface-container-lowest rounded-[2rem] shadow-2xl shadow-on-surface/10 flex flex-col overflow-hidden max-h-[min(870px,92vh)] my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-10 py-8 flex justify-between items-center border-b border-outline-variant/10 gap-4 shrink-0">
          <div>
            <h2 id="deliver-batch-title" className="text-3xl font-extrabold tracking-tighter text-on-surface font-headline">
              Upload Delivery File
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">Batch process new inventory arrivals with precision.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center hover:bg-surface-container-high rounded-full transition-colors shrink-0"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex flex-col lg:flex-row overflow-hidden flex-1 min-h-0">
          <div className="lg:w-2/5 p-10 overflow-y-auto border-r border-outline-variant/10 space-y-8">
            <label className="group relative cursor-pointer block">
              <div className="w-full aspect-video rounded-xl border-2 border-dashed border-outline-variant group-hover:border-primary transition-colors flex flex-col items-center justify-center bg-surface-container-low/50 group-hover:bg-primary-fixed/20">
                <span className="material-symbols-outlined text-4xl text-outline mb-3 group-hover:text-primary">upload_file</span>
                <span className="font-headline font-bold text-on-surface">Click to upload CSV/Excel</span>
                <span className="text-xs text-on-surface-variant mt-2">Maximum file size: 10MB</span>
              </div>
              <input className="absolute inset-0 opacity-0 cursor-pointer" type="file" accept=".csv,.xlsx,.xls" />
            </label>
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Receiver</label>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline"
                  placeholder="Scan or type name"
                  type="text"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Location / Delivery Address</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg">location_on</span>
                  <input
                    className="w-full bg-surface-container-highest border-none rounded-xl pl-12 pr-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline"
                    placeholder="Central Warehouse B-12"
                    type="text"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Delivery Date</label>
                  <input className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all" type="date" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Delivered By</label>
                  <input
                    className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline"
                    placeholder="Carrier Name"
                    type="text"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="lg:w-3/5 bg-surface-bright flex flex-col overflow-hidden min-h-0">
            <div className="p-6 border-b border-outline-variant/10 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center flex-wrap gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Delivery Preview</span>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full">12 VALID</span>
                <span className="px-3 py-1 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full">2 ERRORS</span>
              </div>
            </div>
            <div className="overflow-auto flex-grow px-2 min-h-0">
              <table className="w-full text-left border-separate border-spacing-y-2 min-w-[520px]">
                <thead className="sticky top-0 bg-surface-bright z-10">
                  <tr className="text-[10px] text-outline font-bold uppercase tracking-widest">
                    <th className="px-6 py-4">SKU ID</th>
                    <th className="px-4 py-4">Item Name</th>
                    <th className="px-4 py-4">Qty</th>
                    <th className="px-4 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium">
                  <tr className="bg-surface-container-lowest hover:bg-surface-container-low transition-colors group">
                    <td className="px-6 py-4 rounded-l-xl text-primary font-bold">#SKU-9902</td>
                    <td className="px-4 py-4">Ethereal Glass Panel 2x4</td>
                    <td className="px-4 py-4">48</td>
                    <td className="px-6 py-4 rounded-r-xl text-right">
                      <div className="inline-flex items-center gap-1 text-green-600">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span className="text-xs font-bold">Valid</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="bg-surface-container-lowest hover:bg-surface-container-low transition-colors group">
                    <td className="px-6 py-4 rounded-l-xl text-primary font-bold">#SKU-4412</td>
                    <td className="px-4 py-4">Titanium Strut - Grade A</td>
                    <td className="px-4 py-4">120</td>
                    <td className="px-6 py-4 rounded-r-xl text-right">
                      <div className="inline-flex items-center gap-1 text-green-600">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span className="text-xs font-bold">Valid</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="bg-surface-container-lowest border-2 border-tertiary/20 group">
                    <td className="px-6 py-4 rounded-l-xl text-tertiary font-bold">#SKU-ERR0</td>
                    <td className="px-4 py-4">Unknown Composite Material</td>
                    <td className="px-4 py-4">12</td>
                    <td className="px-6 py-4 rounded-r-xl text-right">
                      <div className="inline-flex items-center gap-1 text-tertiary">
                        <span className="material-symbols-outlined text-sm">error</span>
                        <span className="text-xs font-bold">No Match</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="bg-surface-container-lowest hover:bg-surface-container-low transition-colors group">
                    <td className="px-6 py-4 rounded-l-xl text-primary font-bold">#SKU-5521</td>
                    <td className="px-4 py-4">Fluorescent Mesh Grid</td>
                    <td className="px-4 py-4">5</td>
                    <td className="px-6 py-4 rounded-r-xl text-right">
                      <div className="inline-flex items-center gap-1 text-green-600">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span className="text-xs font-bold">Valid</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="bg-surface-container-lowest hover:bg-surface-container-low transition-colors group">
                    <td className="px-6 py-4 rounded-l-xl text-primary font-bold">#SKU-3122</td>
                    <td className="px-4 py-4">Silicone Seals 50mm</td>
                    <td className="px-4 py-4">200</td>
                    <td className="px-6 py-4 rounded-r-xl text-right">
                      <div className="inline-flex items-center gap-1 text-green-600">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span className="text-xs font-bold">Valid</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="px-10 py-8 bg-surface-container-low flex flex-col sm:flex-row justify-end gap-4 items-center shrink-0">
          <button type="button" className="px-8 py-3 rounded-full text-sm font-headline font-bold text-on-secondary-container hover:bg-secondary-container transition-colors">
            Validate File
          </button>
          <button
            type="button"
            className="px-10 py-3 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline font-bold text-sm shadow-xl shadow-primary/30 transition-all active:scale-95"
          >
            Review and Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
