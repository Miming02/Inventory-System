import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { uploadAttachment } from "../../lib/storageUpload";
import { getErrorMessage } from "../../lib/errors";

const PREVIEW_ITEMS = [
  {
    sku: "LP-1029",
    name: "Premium Leather Pack",
    qty: "x24",
    loc: "Aisle 4B",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCEbbuuRIBxnMCFsmFEDHBCl98r0km7KNF5dVP5V25cRER6-k7XVpaaNiKf4mddYMmFI4bcMEnBDgq5oS_xg_IvxyeF8UicjyFL0V-Q7_3YL18awq-vYTSEGy2kZALsbYxqQyf-OjvxJ1vBff0J-6KEheGlklWj-Gl9etFbPqbx5JUZxu-NpZbby6XXL7vTEd-46VOZ0SnJkkzH5Ff97BsR153qgIDzOfw9nDrwavIcm4x3B8mSeiWh3QVqNXlRPtGL3o7ZPJaW5tA",
    imgAlt: "Backpack Item",
    dataAlt:
      "Close-up of a high-end minimalist leather backpack on a plain light background with studio lighting",
    borderAccent: false
  },
  {
    sku: "VS-001",
    name: "Velocity Sneakers (R)",
    qty: "x50",
    loc: "Main Floor",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBO8Zy180hQKQrlNfoxrrIKGCHkK1f2SgRj09e4U2VsZe_kJvIuVHfvSSGqBBcXuzaDio5zaYfQgIOWU22MyUiajK-5YCZaaWM8Vv_kSQbqZdDE_HiAw9Udph3-AgwfqD4fXZGn3gC8jo1CvX2Yjw8IAtgARYYfTn6gF1arfWYs8D1qQZ1cX7njMgAUXMiq1V_Uq8_WpR_B63BuP56lTFKZqHOsYG5RsHWKom845oe5oGv9ab9SLB-YSMkL5vqtOzjh37a7TlzoxjM",
    imgAlt: "Red Shoe Item",
    dataAlt: "Commercial product shot of a sleek red athletic sneaker on a white background with sharp shadows",
    borderAccent: false
  },
  {
    sku: "CS-W-02",
    name: "Curator Series Chrono",
    qty: "x12",
    loc: "Safe A",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAcLN10Fn0HdmvPo6BA4scbO3C13VthTm_yHHGZSWqyo57UAYMVLgB7qhtwKBgBK7Yt9SETL13pDKFNRH-A9NAadR2zCI3TDJ__yVxFBpg-8UZEJCH3C_zyuSXQ5dS6UeCDgc7CXQedAx-4DOLLCD_vAfMJRwcBEH7hp0_SBVwGj0r9fVI5HjzmMchIOC5qvWqKAxI-Jnxt1c4A6W8IlX6poReQI4IZJsWJXiTWvIdllC0VYC9c541ZYc5f7lQtsE6e8ae__7eEwfM",
    imgAlt: "Watch Item",
    dataAlt: "Elegant luxury watch with a silver band sitting on a soft grey fabric with diffuse natural lighting",
    borderAccent: true
  }
];

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

export function ScanItemsModal({ open, onClose }) {
  useModalA11y(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-on-surface/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-items-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-4xl max-h-[min(921px,92vh)] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 p-8 lg:p-10 overflow-y-auto border-r border-slate-100">
          <div className="flex items-center justify-between mb-8 gap-4">
            <div>
              <h2 id="scan-items-title" className="text-2xl font-extrabold tracking-tight text-on-surface font-headline">
                Scan Items
              </h2>
              <p className="text-sm text-on-surface-variant">Input inventory details for the active shipment</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors shrink-0"
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Barcode Scanner Input</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-primary">
                  <span className="material-symbols-outlined">barcode_scanner</span>
                </div>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium text-on-surface placeholder:text-outline"
                  placeholder="Scan or type serial number..."
                  type="text"
                />
                <div className="absolute inset-y-0 right-4 flex items-center">
                  <span className="material-symbols-outlined text-outline cursor-pointer hover:text-primary">photo_camera</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Quantity</label>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium"
                  type="number"
                  defaultValue={1}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Location</label>
                <select className="w-full bg-surface-container-highest border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium appearance-none">
                  <option>Aisle 4, Shelf B</option>
                  <option>Aisle 2, Shelf D</option>
                  <option>Refrigerated Unit 1</option>
                  <option>Hazardous Storage</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Received Date</label>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium"
                  type="date"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Received By</label>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium"
                  type="text"
                  defaultValue="Alexander Curator"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Supplier</label>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium"
                  placeholder="Global Logistics Inc."
                  type="text"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Delivery By</label>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all font-medium"
                  placeholder="Express Fleet 402"
                  type="text"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 ml-1">Attachment</label>
              <div className="w-full border-2 border-dashed border-outline-variant rounded-2xl py-6 flex flex-col items-center justify-center bg-surface hover:bg-surface-container-low transition-colors cursor-pointer group">
                <span className="material-symbols-outlined text-outline group-hover:text-primary mb-2">upload_file</span>
                <p className="text-sm font-medium text-on-surface-variant">
                  Drop packing slip or <span className="text-primary underline">browse</span>
                </p>
              </div>
            </div>
            <div className="pt-6 flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                className="flex-1 bg-surface-container-high text-on-secondary-container py-4 px-6 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-secondary-container transition-all active:scale-95"
              >
                <span className="material-symbols-outlined">playlist_add</span>
                Add to List
              </button>
              <button
                type="button"
                className="flex-1 bg-gradient-to-r from-primary to-primary-container text-on-primary py-4 px-6 rounded-full font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 hover:shadow-blue-900/20 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined">fact_check</span>
                Proceed to Review
              </button>
            </div>
          </div>
        </div>
        <div className="hidden md:flex flex-col w-72 lg:w-80 bg-surface-container-low p-8 shrink-0">
          <div className="flex items-center gap-2 mb-6 text-on-surface">
            <span className="material-symbols-outlined text-primary">history</span>
            <h3 className="font-bold text-sm tracking-tight font-headline">Recently Scanned</h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
            <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-white/40">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">UNIT #9022</span>
                <span className="text-[10px] text-on-surface-variant">2m ago</span>
              </div>
              <p className="text-xs font-bold text-on-surface mb-1">High-Precision Flux Capacitors</p>
              <div className="flex justify-between items-center text-[10px] text-on-surface-variant">
                <span>Qty: 24</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-primary">location_on</span>
                  A4-B
                </span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-white/40">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">UNIT #1105</span>
                <span className="text-[10px] text-on-surface-variant">15m ago</span>
              </div>
              <p className="text-xs font-bold text-on-surface mb-1">Industrial Grade Sealant</p>
              <div className="flex justify-between items-center text-[10px] text-on-surface-variant">
                <span>Qty: 100</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-primary">location_on</span>
                  A2-D
                </span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-white/40">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-full">ALERT</span>
                <span className="text-[10px] text-on-surface-variant">1h ago</span>
              </div>
              <p className="text-xs font-bold text-on-surface mb-1">Thermal Insulation Panel</p>
              <div className="flex justify-between items-center text-[10px] text-on-surface-variant">
                <span>Qty: 5</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-tertiary">warning</span>
                  Overstock
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-outline-variant/20">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-medium text-on-surface-variant">Session Total</span>
              <span className="text-lg font-extrabold text-primary font-headline">129 Items</span>
            </div>
            <div className="h-1 bg-primary-fixed-dim rounded-full overflow-hidden">
              <div className="h-full bg-primary w-2/3" />
            </div>
            <p className="text-[10px] text-on-surface-variant mt-2 text-center">Batch Processing: 66% Complete</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ManualEntryModal({ open, onClose }) {
  useModalA11y(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-entry-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-5xl max-h-[min(921px,92vh)] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-outline-variant/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 p-8 overflow-y-auto border-r border-outline-variant/10 min-h-0">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h2 id="manual-entry-title" className="text-2xl font-headline font-extrabold text-on-surface tracking-tight">
                Manual Item Entry
              </h2>
              <p className="text-on-surface-variant text-sm mt-1">Add new items to the receiving inventory manifest.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors shrink-0"
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <form className="grid grid-cols-1 sm:grid-cols-2 gap-6" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">SKU Code</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                placeholder="e.g. CUR-882-X"
                type="text"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Item Name</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                placeholder="Product designation"
                type="text"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Quantity</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                placeholder="0"
                type="number"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Location</label>
              <div className="relative">
                <select className="w-full appearance-none bg-surface-container-highest border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 text-on-surface pr-10">
                  <option>Aisle 4, Shelf B</option>
                  <option>Aisle 2, Cold Storage</option>
                  <option>Receiving Dock</option>
                  <option>Hazardous Zone</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-on-surface-variant">expand_more</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Received Date</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 text-on-surface transition-all"
                type="date"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Received By</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                placeholder="Personnel Name"
                type="text"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Supplier</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                placeholder="Vendor Name"
                type="text"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Delivery By</label>
              <input
                className="w-full bg-surface-container-highest border-none rounded-xl p-3 focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50 transition-all"
                placeholder="Carrier / Driver"
                type="text"
              />
            </div>
            <div className="col-span-1 sm:col-span-2 space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Attachment</label>
              <div className="border-2 border-dashed border-outline-variant rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-surface-container-low transition-all cursor-pointer">
                <span className="material-symbols-outlined text-primary text-3xl">cloud_upload</span>
                <p className="text-sm text-on-surface-variant">
                  Drop invoice or photo here or <span className="text-primary font-semibold">browse</span>
                </p>
              </div>
            </div>
            <div className="col-span-1 sm:col-span-2 pt-4">
              <button
                className="w-full bg-primary-container text-on-primary-container py-4 rounded-full font-headline font-extrabold text-base flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                type="button"
              >
                <span className="material-symbols-outlined">add_circle</span>
                Add Item
              </button>
            </div>
          </form>
        </div>
        <div className="w-full md:w-[380px] bg-surface-container-low p-8 flex flex-col shrink-0 min-h-0">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="font-headline font-bold text-lg text-on-surface">Entry Preview</h3>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">3 Items</span>
          </div>
          <div className="flex-grow space-y-4 overflow-y-auto pr-2 min-h-0">
            {PREVIEW_ITEMS.map((item) => (
              <div
                key={item.sku}
                className={`bg-surface-container-lowest p-4 rounded-2xl shadow-sm space-y-3 ${item.borderAccent ? "border-l-4 border-primary" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-3 min-w-0">
                    <div className="w-10 h-10 bg-surface-container-high rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        alt={item.imgAlt}
                        data-alt={item.dataAlt}
                        className="w-full h-full object-cover"
                        src={item.img}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-on-surface">{item.name}</h4>
                      <p className="text-[10px] text-on-surface-variant uppercase font-semibold">SKU: {item.sku}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-primary shrink-0">{item.qty}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-on-surface-variant font-medium">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">location_on</span> {item.loc}
                  </span>
                  <button type="button" className="text-tertiary-container hover:underline">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 space-y-3 shrink-0">
            <div className="flex justify-between items-center px-1">
              <span className="text-sm text-on-surface-variant">Total Quantity</span>
              <span className="text-lg font-headline font-bold text-on-surface">86 Units</span>
            </div>
            <button
              type="button"
              className="w-full bg-primary text-on-primary py-4 rounded-full font-headline font-bold text-base shadow-lg shadow-primary/30 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
            >
              Proceed to Review
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full text-on-surface-variant py-2 font-semibold text-xs uppercase tracking-widest hover:text-on-surface transition-all"
            >
              Cancel Batch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BatchUploadModal({ open, onClose }) {
  useModalA11y(open, onClose);
  const { user } = useAuth();
  const [csvMsg, setCsvMsg] = useState("");
  const [attachMsg, setAttachMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const handleUpload = async (file, kind, setMsg) => {
    setMsg("");
    if (!user?.id || !file) return;
    setBusy(true);
    try {
      const { path } = await uploadAttachment(user.id, file, kind);
      setMsg(`Uploaded: ${path}`);
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/30 backdrop-blur-md px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-upload-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden border border-white/50 flex flex-col max-h-[min(921px,92vh)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-10 py-8 flex justify-between items-center bg-surface-bright/50 border-b border-surface-variant/20 gap-4 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-primary-fixed flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-3xl">upload_file</span>
            </div>
            <div>
              <h2 id="batch-upload-title" className="text-2xl font-black font-manrope tracking-tight text-primary">
                Upload Inventory File
              </h2>
              <p className="text-sm text-on-surface-variant">Import bulk inventory data via spreadsheet</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-high transition-colors shrink-0" aria-label="Close">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-10 py-8 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <div className="space-y-4">
              <label className="text-sm font-bold font-manrope text-on-surface-variant flex items-center gap-2">
                File Upload (CSV/Excel) <span className="text-tertiary">*</span>
              </label>
              <div className="relative group cursor-pointer h-48 border-2 border-dashed border-outline-variant rounded-3xl bg-surface-container-low hover:bg-white hover:border-primary/40 transition-all flex flex-col items-center justify-center text-center px-6">
                <span className="material-symbols-outlined text-4xl text-primary/40 group-hover:scale-110 transition-transform mb-3">cloud_upload</span>
                <p className="text-sm font-medium text-on-surface">Drag and drop file here</p>
                <p className="text-xs text-on-surface-variant mt-1">or click to browse from computer</p>
                {csvMsg ? <p className="text-xs mt-2 text-primary font-medium px-1">{csvMsg}</p> : null}
                <input
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f, "receive", setCsvMsg);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Received Date</label>
                <input className="w-full bg-surface-container-highest border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 text-sm" type="date" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Received By</label>
                <input
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 text-sm"
                  placeholder="Full name or Employee ID"
                  type="text"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Supplier</label>
                  <select className="w-full bg-surface-container-highest border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 text-sm appearance-none">
                    <option>Select Supplier</option>
                    <option>Global Logistics Inc</option>
                    <option>North Star Mfg</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Delivery By</label>
                  <input
                    className="w-full bg-surface-container-highest border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 text-sm"
                    placeholder="Carrier Service"
                    type="text"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="mb-10">
            <label className="text-sm font-bold font-manrope text-on-surface-variant block mb-3">Attachment (e.g. Bill of Lading)</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-surface-container-low p-4 rounded-2xl">
              <span className="material-symbols-outlined text-on-surface-variant shrink-0">attach_file</span>
              <p className="text-sm text-on-surface-variant flex-1">Upload supporting documentation (PDF/JPG)</p>
              <label className="bg-surface-container-highest px-4 py-2 rounded-full text-xs font-bold text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0">
                Select File
                <input
                  className="absolute w-px h-px p-0 -m-px overflow-hidden opacity-0"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f, "receive-docs", setAttachMsg);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {attachMsg ? <p className="text-xs mt-2 text-primary font-medium">{attachMsg}</p> : null}
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-lg font-bold font-manrope text-on-surface">Data Preview</h3>
              <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-black uppercase rounded-full">Validation Required</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-surface-variant/30 overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[520px]">
                <thead className="bg-surface-container-high text-on-surface-variant font-bold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">SKU</th>
                    <th className="px-6 py-4">Item Name</th>
                    <th className="px-6 py-4 text-right">Quantity</th>
                    <th className="px-6 py-4">Unit</th>
                    <th className="px-6 py-4">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-variant/10 bg-surface-container-low/30">
                  <tr>
                    <td className="px-6 py-4 font-mono text-primary font-medium">INV-0091</td>
                    <td className="px-6 py-4">High-Density Filter Panel</td>
                    <td className="px-6 py-4 text-right">450</td>
                    <td className="px-6 py-4 text-on-surface-variant">pcs</td>
                    <td className="px-6 py-4">
                      <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold">Excellent</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-mono text-primary font-medium">INV-0042</td>
                    <td className="px-6 py-4">Thermal Sealant 500ml</td>
                    <td className="px-6 py-4 text-right">1,200</td>
                    <td className="px-6 py-4 text-on-surface-variant">units</td>
                    <td className="px-6 py-4">
                      <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold">Excellent</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-center text-xs text-on-surface-variant italic">Showing first 2 of 24 detected items...</p>
          </div>
        </div>
        <div className="px-10 py-8 bg-surface-container-low border-t border-surface-variant/20 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 shrink-0">
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface font-bold text-sm px-6 py-2 transition-all order-3 sm:order-1">
            Cancel
          </button>
          <div className="flex flex-col sm:flex-row gap-4 order-1 sm:order-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              className="px-8 py-3 rounded-full bg-surface-container-highest text-on-secondary-container font-bold text-sm hover:bg-surface-variant transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">fact_check</span>
              Validate File
            </button>
            <button
              type="button"
              className="px-10 py-3 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-bold text-sm shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              Confirm Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
