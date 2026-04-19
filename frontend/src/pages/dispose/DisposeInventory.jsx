import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";

const MODAL_REQUESTER_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBeLsdQ8rEH-EUmQF5lxOtmLAZKM9g30xcx_AiZzm-cB0BgvYK1BKr4GfbC9lXJkqDfrvGlqsbp3qseZiv8qRsqg74Qz0L3e4Dc9QLttRnqAg-G3p2YBbTnG_B8D2aQYZxBuq8FzU6vUZu4Aep5A7DPKBEkEReEP8rupK-t7IUX2uQD6FZJziIu82ZboL8tnbutf4lDqjgBa9L7ctYxy06CZw1N84YWthJgqRkjVlHHqBDVH3lhIaF9XmNlV9121Rghr5ACUM_ubHw";

const filterOptions = ["All", "Pending", "Approved", "Rejected"];

const disposalRows = [
  {
    id: "#DIS-402",
    itemName: "Quantum Processor X1",
    quantity: "12 Units",
    reason: "Damaged",
    requestor: {
      name: "Sarah Connor",
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuCgFKHVU7J4_v2lepSpPwewRAlCd4KZ072LJUOniux9jZOnT5ZKCFYZvf8fcVB7Wmxlo957x4sIDOrKDbxMouEai9XwT2-nxmZiCDi3XCgpJ6WuZN9R2IT1VTsJceUTZJtRxjfw9nZm440kpyM1g2SalCd89hmT1Cin44cuZvUMc07Sr01xtEZyxbsI4lE8XjnbRL55dZzEtbOo8XzSigZ4M6PxbEWySCqDxqD_lCWLtaqNt4PpuO5xyZpPpf7oLHu9Md3eklgQfyI",
      dataAlt: "Portrait of a young male requestor in a modern office, bright natural light"
    },
    date: "Oct 24, 2023",
    status: "pending",
    approver: { type: "tbd" },
    actions: "approve-reject"
  },
  {
    id: "#DIS-398",
    itemName: "Thermal Cooling Unit v4",
    quantity: "45 Units",
    reason: "Expired",
    requestor: {
      name: "Marcus Aurelius",
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBu0-tDNiZZuPJT7BqVsyaUOTtjBN7uZj_STe_YLy2Kztc9c0BDayfdhZGJx4PVMP-5XM9dPiID5wkeZgiTYxeNttgtUu9rsUm8d3LvBJLwBAJIKiB7mZyosBKZtAccjciDr2tDhl5Od_jgCqMUWotZNyE66yujKLQ4CWftbdwD51h3pXLg0fJVCEPy2xqMdLU1ESydqK1JyUTIQxL8S4dsK3Lvihbe6jummbPhaNoC5DF41kvRkNXwgRTa2PUuldKvT7uBJiMdD_Y",
      dataAlt: "Portrait of a female logistics manager, clean and professional"
    },
    date: "Oct 21, 2023",
    status: "approved",
    approver: {
      type: "user",
      name: "Administrator",
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAqZbG7bgRpBipp5ub0wYR1Hje7GfnQLJqNIcZVePdLSyQoyKKKXa3oIUj0xKnPneq4yOtOkhev4wVWYKcSaN9r34KpHyhGC3-PrOMV-FFGT1gEV7QPoGbAqvtcc1v0DM7OkIUrSQVKfThJV9cYNzC6QuUuPTwG7Sfxw5s4i_XrcacYfglP5PTAmxV5xKd6ba3rlOIEg42QOQtg4T9sCsCFU6YQga1PzFMdfDe5kDS772rwKrFmMHXX_yrPs6nzftomLMVMMwnzl7s",
      dataAlt: "Avatar of senior approver"
    },
    actions: "view"
  },
  {
    id: "#DIS-395",
    itemName: "Heuristic Sensor Array",
    quantity: "2 Units",
    reason: "Duplicate",
    requestor: {
      name: "Elena Fisher",
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuA-UbLsuacBrqZhPy35D6g7B1xhhoXWs4EnnlC0Jty6sDFFa11e_z7csFuqqf_HXnty5gwIRHjGBeJgG56ab6Oxhf7MFT_HQvownHeKl-h58LaWJnXlFD4j2-Xzxb2heteRRQowywt_9CBTU_6d72YkYeZvVbxFJkkFslVnfgR3MQllogm9GNYCBtesXRQKD4-iA6mMl1b-r20EngCDK2qCEer4r_uKRsZBKfWcRKz-hNfz1XzrYiGCt8Yi2VKhpFMg0WzRFKQYthQ",
      dataAlt: "Portrait of a young professional male in studio lighting"
    },
    date: "Oct 19, 2023",
    status: "rejected",
    approver: {
      type: "user",
      name: "Administrator",
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuA0dwj480vzerK7RnvsXNlGWyjx74LesMEE4YmpYlwJ7ctQUpoi5N8Xin9YZfnMGczAUlu4N_uEA_RzsL753z1pmqJ4YNCJvp8GHFi7AZRU5SsZAjY0KTvZgUh_km1-thB1MEMyWMEERcdi7R-dcsDTRSKDgN2D7QPFnooXhklVIh810Kii0421oOt3SpT8_YlvRMBM00hwRNW6fCpN0Sj-q9WdT8fxBovlAY4VFsd3_uRATHqlcSK-K6zmcrZ48yYfKAorqZ8g8oU",
      dataAlt: "Avatar of senior approver"
    },
    actions: "view"
  },
  {
    id: "#DIS-391",
    itemName: "Sub-Zero Storage Unit",
    quantity: "1 Unit",
    reason: "Upgrade Replaced",
    requestor: {
      name: "Victor Sullivan",
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBIueJKdngUu6x7MRDb6qTOFfy__F_mu3ucA6VmGoou0P31mK6_UeVYviEzk7zoZwFOCS39_Qa-Cn1fcBWYjl62nMXYWeKaWKXDj1DyW3fcQQk9CMc_EUvtL6Ue1fXdcmg1DMvgNL6XSbLBDNwlzpgbK9ZuKXW8wXi3Ap5AHg6o13yGIStcShIFKe7uMT7d6vF4FxVqmNJ6iBMCTU9p__YMaGESpV-YpMN4N8Ah6F6lHU5qKhJvAiA7Fs4Bm_KSdSewBovIz_xZD-Q",
      dataAlt: "Portrait of a female professional with glasses, studio light"
    },
    date: "Oct 18, 2023",
    status: "pending",
    approver: { type: "tbd" },
    actions: "approve-reject"
  }
];

const HEADER_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD-_DuilHsJ0OwBTIKLuWq9yUTMgu15fktMbmGU5fcP5HFb3XoN-te60-bHEMGmTy47H71KbfX8dR24gszQbq_qreahgwMXQ8vE_c_bsEacYEC6hBzlbnCfZEbGFL_R_pEzuHsjP8IbHWWLo0LPUGwq-o9QGzV8F2ws0eKBGcFdtfvIB72YvUefikqRrcxgoQ-rNSB-npIx1UF2aDskpxtfLSZcfi14Mq-zZs9Ua25uNhhlcNjtAfba-AsNC5kB2-HShb38PzJTEMM";

function StatusBadge({ status }) {
  if (status === "pending") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-fixed-variant text-xs font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Pending
      </div>
    );
  }
  if (status === "approved") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
        <span className="material-symbols-outlined text-[14px]">check_circle</span>
        Approved
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
      <span className="material-symbols-outlined text-[14px]">cancel</span>
      Rejected
    </div>
  );
}

function ApproverCell({ approver }) {
  if (approver.type === "tbd") {
    return <span className="text-xs text-on-surface-variant italic">TBD</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full overflow-hidden">
        <img className="w-full h-full object-cover" data-alt={approver.dataAlt} src={approver.src} alt={approver.name} />
      </div>
      <span className="text-xs font-medium">{approver.name}</span>
    </div>
  );
}

function CreateDisposalRequestModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-[12px] transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-disposal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-2xl max-h-[min(921px,92vh)] overflow-y-auto rounded-xl shadow-[0_12px_32px_-4px_rgba(23,28,31,0.06)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 pb-4 flex justify-between items-start sticky top-0 bg-surface-container-lowest z-10">
          <div className="space-y-1 pr-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 id="create-disposal-title" className="text-xl font-extrabold tracking-tight text-on-surface font-headline">
                Create Disposal Request
              </h2>
              <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-[10px] font-bold tracking-wider rounded-full uppercase">
                Pending
              </span>
            </div>
            <p className="text-on-surface-variant text-sm font-medium">
              Submit a request to dispose damaged, expired, or unwanted inventory items
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors shrink-0" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-8 pt-2 space-y-8">
          <div className="flex items-center p-4 bg-surface-container-low rounded-xl gap-4 flex-wrap sm:flex-nowrap">
            <img
              alt="Marcus Chen"
              data-alt="Professional studio headshot of Marcus Chen, a young man with a friendly and reliable expression"
              className="w-10 h-10 rounded-full object-cover shrink-0"
              src={MODAL_REQUESTER_AVATAR}
            />
            <div className="flex-1 min-w-[140px]">
              <p className="text-xs text-on-surface-variant font-medium">Requested By</p>
              <p className="font-bold text-on-surface tracking-tight">Marcus Chen</p>
            </div>
            <div className="hidden sm:block h-8 w-px bg-outline-variant/30 shrink-0" />
            <div className="flex-1 min-w-[140px]">
              <p className="text-xs text-on-surface-variant font-medium">Department</p>
              <p className="font-bold text-on-surface tracking-tight">Warehouse Logistics</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-on-surface-variant tracking-wide uppercase">Item Selection *</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/60"
                    placeholder="Search Item Name or ID"
                    type="text"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-on-surface-variant tracking-wide uppercase">Quantity to Dispose *</label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all pr-28"
                    placeholder="0"
                    type="number"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 bg-surface-container-low rounded-lg pointer-events-none">
                    <span className="text-[10px] font-bold text-on-surface-variant">AVAIL: 1,240</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-on-surface-variant tracking-wide uppercase">Location *</label>
                <select className="w-full px-4 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all appearance-none">
                  <option>Select warehouse location</option>
                  <option>North Wing - Section A</option>
                  <option>East Dock - Cold Storage</option>
                  <option>Main Warehouse - Rack 12</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-on-surface-variant tracking-wide uppercase">Disposal Date *</label>
                <div className="relative">
                  <input className="w-full px-4 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all" type="date" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface-variant tracking-wide uppercase">Reason for Disposal *</label>
              <select className="w-full px-4 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all mb-3 appearance-none">
                <option>Select reason</option>
                <option>Damaged</option>
                <option>Expired</option>
                <option>Lost</option>
                <option>Contaminated</option>
                <option>Other</option>
              </select>
              <textarea
                className="w-full px-4 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/60 resize-none"
                placeholder="Provide additional details regarding the disposal reason..."
                rows={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-outline-variant/15">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface-variant tracking-wide uppercase">Approver *</label>
              <select className="w-full px-4 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all appearance-none">
                <option>Select supervisor or admin</option>
                <option>Sarah Jenkins (Admin)</option>
                <option>David Miller (Warehouse Manager)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface-variant tracking-wide uppercase">Proof of Condition</label>
              <button
                type="button"
                className="w-full p-3 border-2 border-dashed border-outline-variant/30 bg-surface-container-low rounded-xl flex items-center justify-center gap-3 cursor-pointer hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-primary">upload_file</span>
                <span className="text-xs font-medium text-on-surface-variant">Upload images or documents</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-outline-variant/15 flex items-center justify-end gap-4 sticky bottom-0 bg-surface-container-lowest">
          <button type="button" onClick={onClose} className="px-8 py-3 rounded-full text-sm font-bold text-secondary hover:bg-surface-container-low transition-all">
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-3 rounded-full text-sm font-bold bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all"
          >
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DisposeInventory() {
  const [filter, setFilter] = useState("All");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const closeCreateModal = useCallback(() => setCreateModalOpen(false), []);

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl bg-gradient-to-b from-white to-transparent dark:from-slate-900 shadow-sm shadow-blue-500/5">
        <div className="flex justify-between items-center h-20 px-8 max-w-[1440px] mx-auto w-full">
          <div className="text-2xl font-extrabold tracking-tighter text-slate-900 dark:text-white font-manrope">
            The Fluid Curator
          </div>
          <nav className="hidden md:flex items-center gap-8 font-manrope font-semibold tracking-tight">
            <Link to="/" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              Dashboard
            </Link>
            <span className="text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-1">Requests</span>
            <a className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" href="#">
              Inventory
            </a>
            <a className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" href="#">
              Logs
            </a>
            <a className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" href="#">
              Settings
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 rounded-lg transition-transform duration-200 scale-95 active:scale-90"
              >
                <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
              </button>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high">
                <img
                  alt="Administrator profile"
                  data-alt="Close up portrait of a professional male administrator with clean features in a high-key bright office environment"
                  className="w-full h-full object-cover"
                  src={HEADER_AVATAR}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-full font-manrope font-semibold text-sm transition-transform duration-200 scale-95 active:scale-90 shadow-lg shadow-primary/20"
            >
              Create Request
            </button>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-28 md:pb-20 px-8 max-w-[1440px] mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2 font-manrope">Disposal Requests</h1>
          <p className="text-on-surface-variant text-lg">Manage and review inventory disposal authorization requests</p>
        </div>

        <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface-bright">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
              {filterOptions.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFilter(label)}
                  className={
                    filter === label
                      ? "px-5 py-2 rounded-full text-sm font-semibold bg-primary text-on-primary transition-all shrink-0"
                      : "px-5 py-2 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-all shrink-0"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
              <input
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border-none bg-surface-container-highest text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                placeholder="Search requests..."
                type="text"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-surface-container-low border-none">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Request ID</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Item Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Quantity</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Reason</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Requestor</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Date</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Approver</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/30">
                {disposalRows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-5 font-mono text-sm text-primary font-semibold">{row.id}</td>
                    <td className="px-6 py-5">
                      <div className="font-semibold text-on-surface">{row.itemName}</div>
                    </td>
                    <td className="px-6 py-5 text-on-surface-variant">{row.quantity}</td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface-container-high text-on-surface-variant">{row.reason}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 shrink-0">
                          <img
                            className="w-full h-full object-cover"
                            data-alt={row.requestor.dataAlt}
                            src={row.requestor.src}
                            alt={row.requestor.name}
                          />
                        </div>
                        <span className="text-sm font-medium text-on-surface">{row.requestor.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-on-surface-variant">{row.date}</td>
                    <td className="px-6 py-5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-6 py-5">
                      <ApproverCell approver={row.approver} />
                    </td>
                    <td className="px-6 py-5 text-right">
                      {row.actions === "approve-reject" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-on-primary hover:opacity-90 transition-all"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-tertiary-fixed text-on-tertiary-fixed hover:bg-tertiary-fixed-dim transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <a className="text-sm font-semibold text-primary hover:underline" href="#">
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-6 flex items-center justify-between bg-surface-bright border-t border-surface-variant/20 flex-wrap gap-4">
            <span className="text-sm text-on-surface-variant">Showing 4 of 24 results</span>
            <div className="flex items-center gap-2">
              <button type="button" className="p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button type="button" className="w-8 h-8 rounded-lg bg-primary text-on-primary text-sm font-bold">
                1
              </button>
              <button type="button" className="w-8 h-8 rounded-lg hover:bg-surface-container-high text-sm font-bold text-on-surface-variant">
                2
              </button>
              <button type="button" className="w-8 h-8 rounded-lg hover:bg-surface-container-high text-sm font-bold text-on-surface-variant">
                3
              </button>
              <button type="button" className="p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </section>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-primary/5 rounded-xl p-6 flex flex-col justify-between h-40">
            <span className="text-primary font-bold text-sm uppercase tracking-widest">Total Monthly Volume</span>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-extrabold text-primary font-manrope">$42.8k</span>
              <span className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">trending_up</span> 12%
              </span>
            </div>
          </div>
          <div className="bg-surface-container rounded-xl p-6 flex flex-col justify-between h-40 border-l-4 border-primary">
            <span className="text-on-surface-variant font-bold text-sm uppercase tracking-widest">Average Review Time</span>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-extrabold text-on-surface font-manrope">4.2h</span>
              <span className="text-sm text-on-surface-variant">High Efficiency</span>
            </div>
          </div>
          <div className="bg-tertiary-fixed-dim/20 rounded-xl p-6 flex flex-col justify-between h-40">
            <span className="text-on-tertiary-fixed font-bold text-sm uppercase tracking-widest">Awaiting Approval</span>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-extrabold text-on-tertiary-fixed font-manrope">08</span>
              <button type="button" className="text-sm font-bold text-tertiary underline underline-offset-4">
                Process Now
              </button>
            </div>
          </div>
        </div>
      </main>

      <button
        type="button"
        onClick={() => setCreateModalOpen(true)}
        className="fixed bottom-[72px] right-8 md:bottom-8 w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 group z-40"
        aria-label="Create request"
      >
        <span className="material-symbols-outlined text-2xl group-hover:rotate-90 transition-transform">add</span>
      </button>

      <CreateDisposalRequestModal open={createModalOpen} onClose={closeCreateModal} />

      <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full z-50 rounded-t-3xl bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center w-full px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link to="/" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 font-label text-[10px] font-medium active:scale-95 transition-transform duration-200">
            <span className="material-symbols-outlined">dashboard</span>
            <span>Home</span>
          </Link>
          <a href="#" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 font-label text-[10px] font-medium active:scale-95 transition-transform duration-200">
            <span className="material-symbols-outlined">inventory_2</span>
            <span>Inventory</span>
          </a>
          <div className="flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-2xl px-5 py-2 font-label text-[10px] font-medium active:scale-95 transition-transform duration-200">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              delete_sweep
            </span>
            <span>Disposals</span>
          </div>
          <button type="button" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 font-label text-[10px] font-medium active:scale-95 transition-transform duration-200">
            <span className="material-symbols-outlined">person</span>
            <span>Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
