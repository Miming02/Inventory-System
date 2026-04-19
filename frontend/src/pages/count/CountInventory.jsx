import { Link } from "react-router-dom";

const rows = [
  {
    name: "AeroFlow Chrono",
    brand: "Precision Horology",
    sku: "AF-CHR-902",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBPFUdXUrqVAJJM1VIhskGRqpKHpbCV0yl2lrTof2Po1qXy7qa8KhYDcMNceIr227vp-3BbADgBvS9eRQXXTSo8T9NWxMcu1x8bsMz3H-l9GCku0nDejFqCm6OvC2yTJ9IRaoJSMfTe6Xglu-hIvDaIgcsu8sCpDaLhoM2wbl7hh-wpCesn54Swe8JqmLZQMrj3n7zRO4CYo2reALJAqtQbtJ-DBXGc4Mtf4THVr8-id00ABQ_8DW2OceS6pdIM_4wdfGPylogkFaw",
    imageAlt: "Minimalist White Watch",
    imageDataAlt:
      "Top down studio photography of a sleek minimalist white wrist watch on a soft grey background",
    systemQty: 124,
    countedDefault: 122,
    diff: { label: "-2", variant: "error" }
  },
  {
    name: "SonicScape Pro",
    brand: "Audio Engineering",
    sku: "SS-PR-1104",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuB-WZD4_GQReuxjBJbEly64vDhG1Y8itb8p1G51slMhI4Pr-_-NAv0dMeWCHI7FBWp11wq3rzxNxtsvDJ_Dz_iSXncChDP_4UIYETLcwlEQ3bpurvMAGhUOhqR1x3AFbESwLG_roeKQvGplpCOP14xjhwmR0GH0zo43JTdWiAQ4VNWRnNnI8o2g9TP7rqbyQp5_f3Wia8d7sHiUGtzqGSpzU_fWBi9UMy6joniKKsv4YyMkbB8ft_K_Nw5UQczkj6mvsdJI0ZPi7c4",
    imageAlt: "Studio Headphones",
    imageDataAlt:
      "Professional studio headphones on a plain background, dark matte finish with soft highlights",
    systemQty: 48,
    countedDefault: 51,
    diff: { label: "+3", variant: "primary" }
  },
  {
    name: "PureAtmosphere X",
    brand: "Climate Control",
    sku: "PA-X-009",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDiPQ-Jq6a9mMHDoRPw5ttXNT8PwZee7Jmcb3R4flGbHBqjpBG88a0q4o0J0TVjHDVcCyej8jkHWkeGEJHSY2XG11ZA7QZ1VNmgKVQ3OhZFAH52PZ-TKIiHgUddw2vpJLLnOkJMYcXqYrbAwP9j-JvnICxAYSrAZQMt4JjnYSmvJbu9HMdMXYInm92aCkVUPpRF-aiZkINrksQM7Gqzs42E18NRecAOZx915lBPwPcHDR6v6arxBYiY5zIbM6MYl8WDR_ZpmSse_wg",
    imageAlt: "Smart Air Purifier",
    imageDataAlt:
      "Modern sleek air purifier with digital display in a contemporary living room setting, soft daylight",
    systemQty: 12,
    countedDefault: 12,
    diff: { label: "0", variant: "neutral" }
  },
  {
    name: "Executive Ledger",
    brand: "Stationery",
    sku: "EL-BN-552",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuChcl5gdTM3mpt-L9OV6AlF0-H3DbKtad9f_OVeKBxploTNIEPlx-FBeQBA0tQUnVnS0Z8M2rbiI_DBpuHn0VjT3tFNT_9P6_CmBcJ6ahqSl81CvuqzDAoQdOBl7-3dWe67_vSdI_CMaERLN6ynDPNImsYPpT49VUHW1HS7n8iCoJStrmcVbeKn5p-1eoJJZUwLW8DQQbxiDt2ir0pvbF_L0nGLfGEiIHP7F-mHTzBQ3DIL3jWHUyaJo406N08SZIno7NyB6kFtgss",
    imageAlt: "Premium Leather Journal",
    imageDataAlt:
      "Close up of a handcrafted brown leather journal on a rustic wooden table with a pen",
    systemQty: 310,
    countedDefault: 304,
    diff: { label: "-6", variant: "error" }
  }
];

function DiffBadge({ row }) {
  if (row.diff.variant === "error") {
    return (
      <span className="px-3 py-1 bg-error-container text-on-error-container rounded-full text-sm font-bold">{row.diff.label}</span>
    );
  }
  if (row.diff.variant === "primary") {
    return (
      <span className="px-3 py-1 bg-primary-fixed text-primary rounded-full text-sm font-bold">{row.diff.label}</span>
    );
  }
  return (
    <span className="px-3 py-1 bg-surface-container text-on-surface-variant rounded-full text-sm font-bold">{row.diff.label}</span>
  );
}

export default function CountInventory() {
  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <header className="fixed top-0 left-0 w-full z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between px-8 py-4 w-full">
          <div className="flex items-center gap-8">
            <span className="text-xl font-extrabold tracking-tighter text-slate-900 dark:text-white font-manrope">The Fluid Curator</span>
            <nav className="hidden md:flex gap-6">
              <Link to="/" className="text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-slate-100 transition-colors font-manrope antialiased tracking-tight">
                Dashboard
              </Link>
              <span className="text-blue-600 dark:text-blue-400 font-bold border-b-2 border-blue-600 dark:border-blue-400 pb-1 font-manrope antialiased tracking-tight">Inventory</span>
              <a className="text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-slate-100 transition-colors font-manrope antialiased tracking-tight" href="#">
                Audits
              </a>
              <a className="text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-slate-100 transition-colors font-manrope antialiased tracking-tight" href="#">
                Warehouse
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" className="p-2 text-slate-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-lg transition-all active:scale-95">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button type="button" className="p-2 text-slate-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-lg transition-all active:scale-95">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <img
              alt="Executive user profile"
              data-alt="Professional headshot of a business executive in a dark suit with a clean office background, soft studio lighting"
              className="w-10 h-10 rounded-full border-2 border-primary-fixed cursor-pointer transition-transform active:scale-90 object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuApGWDJtRZh2rcLBaVq1NaaIm5Yej9CoMJVTnnXyNZP31Mk-Ppt8hNIAtkYa6_VpU-PRaBDGTKvGiTECBPAEFn9tuhKyku7AS-vYPPTSp5gDqJ5PSxdIv7DpTYsCT9jETzX9xMiKLSPIqfV_UDF-JgXPjAWKzKqnkCTV8OMi7hy1Jg4RqaEa0tqR1e11WKMhb2gjwLzLy670rPs2jlpvqcMHbCNj6IKfY9bH_xWstjmRguBhOKM4Zjxn2ZWoAe__kzZ1jkYcd0NN3Q"
            />
          </div>
        </div>
      </header>

      <main className="pt-28 pb-44 md:pb-32 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-on-surface font-manrope tracking-tight mb-2">Inventory Count</h1>
          <p className="text-on-surface-variant font-medium">Perform physical count and compare with system data</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
          <div className="md:col-span-6 bg-surface-container-low p-5 rounded-3xl flex flex-col gap-3">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Quick Scan</label>
            <div className="flex gap-2">
              <div className="relative flex-grow min-w-0">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">barcode_scanner</span>
                <input
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border-none rounded-full text-on-surface focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/50 shadow-sm"
                  placeholder="Scan SKU or Serial Number..."
                  type="text"
                />
              </div>
              <button
                type="button"
                className="px-8 py-4 bg-primary text-on-primary rounded-full font-bold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 shrink-0 whitespace-nowrap"
              >
                <span className="material-symbols-outlined">qr_code_scanner</span>
                Scan
              </button>
            </div>
          </div>
          <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-low p-5 rounded-3xl flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Location</label>
              <select className="bg-transparent border-none p-0 text-on-surface font-semibold focus:ring-0 cursor-pointer w-full">
                <option>Main Warehouse A</option>
                <option>South Sector B2</option>
                <option>Retail Storefront</option>
              </select>
            </div>
            <div className="bg-surface-container-low p-5 rounded-3xl flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Date</label>
              <input className="bg-transparent border-none p-0 text-on-surface font-semibold focus:ring-0 cursor-pointer w-full" type="date" defaultValue="2023-10-27" />
            </div>
            <div className="bg-surface-container-low p-5 rounded-3xl flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Counted By</label>
              <div className="flex items-center gap-2 mt-1">
                <img
                  alt="User avatar"
                  data-alt="Close up portrait of a smiling logistics manager in a bright warehouse environment"
                  className="w-6 h-6 rounded-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBCi_LMRZXc7AJVUgGAFHkFWfy1EWsdmbC3iis4bh2NFmogrEbkAuC6Ay-r04cntW_1M43U8hKhz1O-C5S9EJhfG4X5rjB_G0oTRqk_II82LaIU33_LKXv_tZydlT2bJTJBRLjhP7VULC2Hj_HqFmfvuT8Y6xz5DqYupSyAtn4nzQV9CbO29ViT6HyXOK7uLYLq1HcwIF7Rlg3AczuvfeHJeB2w12Sf3FEUj6ybB4zNcVX5LGgiuz2tEVZGZuIIIgzpBOOOzVQjY_c"
                />
                <span className="text-on-surface font-semibold">David Chen</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-[2rem] shadow-xl shadow-on-surface/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Item Details</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">SKU / ID</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant text-right">System Qty</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant text-center">Counted Qty</th>
                  <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant text-right">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {rows.map((row) => (
                  <tr key={row.sku} className="group hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-surface-container-high rounded-2xl p-2 flex items-center justify-center overflow-hidden shrink-0">
                          <img
                            alt={row.imageAlt}
                            data-alt={row.imageDataAlt}
                            className="w-full h-full object-contain"
                            src={row.image}
                          />
                        </div>
                        <div>
                          <p className="font-bold text-on-surface font-manrope">{row.name}</p>
                          <p className="text-sm text-on-surface-variant">{row.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 font-mono text-sm font-medium text-on-secondary-container">{row.sku}</td>
                    <td className="px-6 py-6 text-right font-bold text-on-surface">{row.systemQty}</td>
                    <td className="px-6 py-6 text-center">
                      <input
                        className="w-24 px-4 py-2 bg-surface-container rounded-xl border-none text-center font-bold text-primary focus:ring-2 focus:ring-primary/20"
                        type="number"
                        defaultValue={row.countedDefault}
                      />
                    </td>
                    <td className="px-8 py-6 text-right">
                      <DiffBadge row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-surface-container-low px-8 py-4 flex justify-between items-center flex-wrap gap-3">
            <p className="text-sm font-bold text-on-surface-variant">Displaying 4 of 128 pending items</p>
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total Net Variance</span>
                <span className="text-lg font-extrabold text-error">-5 Items</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed left-0 right-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg shadow-[0_-4px_20px_rgba(0,0,0,0.05)] bottom-[72px] md:bottom-0">
        <div className="max-w-7xl mx-auto px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-3">
            <button type="button" className="px-8 py-3 bg-secondary-container text-on-secondary-container rounded-full font-bold hover:bg-secondary-fixed transition-all active:scale-95">
              Save Count
            </button>
            <button type="button" className="px-8 py-3 bg-secondary-container text-on-secondary-container rounded-full font-bold hover:bg-secondary-fixed transition-all active:scale-95">
              Review
            </button>
          </div>
          <button
            type="button"
            className="w-full md:w-auto px-12 py-4 bg-primary text-on-primary rounded-full font-extrabold tracking-tight flex items-center justify-center gap-2 shadow-xl shadow-primary/30 hover:brightness-110 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">verified</span>
            Confirm Adjustment
          </button>
        </div>
      </footer>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg rounded-t-3xl border-t border-slate-200/50">
        <Link to="/" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-5 py-2">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[11px] font-semibold font-manrope">Home</span>
        </Link>
        <div className="flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-2xl px-5 py-2 scale-105">
          <span className="material-symbols-outlined">fact_check</span>
          <span className="text-[11px] font-semibold font-manrope">Audit</span>
        </div>
        <button type="button" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-5 py-2">
          <span className="material-symbols-outlined">barcode_scanner</span>
          <span className="text-[11px] font-semibold font-manrope">Scan</span>
        </button>
        <button type="button" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-5 py-2">
          <span className="material-symbols-outlined">person</span>
          <span className="text-[11px] font-semibold font-manrope">Profile</span>
        </button>
      </nav>
    </div>
  );
}
