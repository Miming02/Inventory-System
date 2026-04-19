import { useState } from "react";
import { Link } from "react-router-dom";

const PROFILE_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC3rGj7qr2aPKn-aDazX5JyZOWtjZSfFs7ynUSWFgOdXoZl8JSZtJnU8AmzO93YbmLDD3UagiwIkO-cYwGM-I96muKw1o6vgBx38gNLO-471HIM0W991dVDYARTJdZuy0wudiWdGoULieayLZjYzDoyB9OcUpRhkWnhCqMCJ577usPnDSsSVv_WKMpFtzeyiGUH9xBDZ3ZduLdbHL3FC7iNROxpi3w07e0Tw1YmMpNsguKvNINdfRZtlbKGZW660Fr7VVdrKABEM5s";

const inventoryRows = [
  {
    id: "1",
    name: "Chronos Slate Watch",
    subtitle: "V-Series / Premium",
    sku: "WA-CHR-001",
    category: "Accessories",
    unit: "Pieces",
    qty: "420",
    qtyTone: "default",
    barTrack: "bg-primary-fixed",
    barFill: "bg-primary",
    barPct: "75%",
    reorder: "50",
    reorderBadge: null,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDbErp8DLqjf55JNZLktworSNMoSCQUzOu7-_r4FCmZRH3x38pgplNIGXAKWRcYHLad7N9R_a6mZfEi7PA_Jzf3oNmK8c2i1AnElQlv0NfUd_xmNy4SKMlqE_Amiu2ZAodkAG8lC_wEPeD-mW8E7khvr9u4nTFsbHeCfDQxKD7IWzg-TMIJnJcWFZ4fj85X4t_nzYGglcrGfBWVjp4ZleLsfhGV1eZNKRTkxJJ2auzlcdCe3uMN0JOslJpE-FKeXkZTjGdotEr-EDY",
    imageAlt: "minimalist white wristwatch with silver accents on a clean light gray background with soft shadows"
  },
  {
    id: "2",
    name: "Aura Wireless Pods",
    subtitle: "Audio / High-Fidelity",
    sku: "AU-WRL-882",
    category: "Electronics",
    unit: "Units",
    qty: "12",
    qtyTone: "tertiary",
    barTrack: "bg-tertiary-fixed",
    barFill: "bg-tertiary",
    barPct: "15%",
    reorder: null,
    reorderBadge: "Low Stock (20)",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB4S46MscvysgBa65lfGuilahgRmr6vi6_IlBiXDjZpbK-2b1BFuBML1GDQ9-u6KlY90KD-ed4pmQ4zR33TdZtSBYtW9F2zy_y3x7AuHbmg0x2o9awsa2dC1Aw3To5xYoSlKWlA8rMsvyDWUS1o7gpe74JLIvTFMMEwBfv0_gLrQnh5heYFUcx4kjsrvo6PIuuBWLvndUgXP2RinFjQWYuTxvXWlpM8Tqvwnew5PCca3igGo-Xw3hqflMicX-VMq1G8vXWjYMxXRUI",
    imageAlt: "professional studio shot of high-quality noise-canceling headphones with premium leather padding on a soft teal background"
  },
  {
    id: "3",
    name: "Lumina Lens 50mm",
    subtitle: "Optics / Professional",
    sku: "OP-LUM-50M",
    category: "Photography",
    unit: "Cases",
    qty: "184",
    qtyTone: "default",
    barTrack: "bg-primary-fixed",
    barFill: "bg-primary",
    barPct: "55%",
    reorder: "25",
    reorderBadge: null,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDXwZMfLVyMa8_VKspQBto_a-_Oj9zAU2R5bSBaYPpaGLCquPSohf8l24hQhTcGWlkTmzCOwUxnI5saU2O5li5qXnVq8_FRy1MkzxGTAt059o2d7aIeXM0tU2Fu04KkFXWJkNrfXOCaW1eLZc3WlOeF8a1enukEoDqUlslEtKxKclBsFz_FoKI2i5hH7a8TXCV9EQdV7dMARqQ_i426XhjGgWDNjEjF7vGZZEgu_1WwRGGklFtF82hO50sXZfoCoxc5eeKyGVMBR3k",
    imageAlt: "vintage style polaroid camera on a clean minimal surface with bright airy lighting and pastel blue backdrop"
  },
  {
    id: "4",
    name: "Swift Velocity V2",
    subtitle: "Apparel / Footwear",
    sku: "AP-SWF-V02",
    category: "Fashion",
    unit: "Pairs",
    qty: "1,024",
    qtyTone: "default",
    barTrack: "bg-primary-fixed",
    barFill: "bg-primary",
    barPct: "90%",
    reorder: "200",
    reorderBadge: null,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA83vSBur2-2kIcVYU-GOIyhyqGEtoaYk3zDbOl7ZCxOefdKsBXZm17g3XaNoIBqahytK61v-HZtfAN8R9cHjUbPtaa_OC0fpaYGw2d3w04pzNqDCr6EpejiyJslTIezjiffSXb1JyjCB2vcwpao0y1cx7NbND0fy286fmwRlPuOjb9rR_eXDp-A6lC22lWUWZ2x1D9jI8oMVZj6ffxG-kx66bPP0mL6z8KWdWNySH8Pa5oiS0IKI0iNGaTA9x9eUGflDYP23C01kE",
    imageAlt: "bright red performance athletic shoe on a dark minimalist background with dramatic top lighting and sharp focus"
  }
];

export default function InventoryItems() {
  const [page, setPage] = useState(1);

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen pb-20 md:pb-0">
      <header className="fixed top-0 w-full z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm font-['Manrope'] antialiased tracking-tight">
        <div className="flex justify-between items-center h-16 px-4 md:px-8 max-w-[1920px] mx-auto">
          <div className="flex items-center gap-6 lg:gap-8 min-w-0">
            <Link
              to="/"
              className="text-lg font-extrabold tracking-tighter text-slate-900 dark:text-white shrink-0 hover:opacity-90 transition-opacity"
            >
              The Fluid Curator
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <span className="text-blue-700 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-1 cursor-default font-semibold">
                Items
              </span>
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-semibold" href="#">
                Purchase Orders
              </a>
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-semibold" href="#">
                Reporting
              </a>
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-semibold" href="#">
                Warehouses
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <button
              type="button"
              className="inline-flex bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 md:px-6 py-2 rounded-full font-semibold active:scale-95 transition-all text-sm shrink-0"
            >
              Create New
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="p-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-lg transition-all text-on-surface-variant active:scale-95"
              >
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button
                type="button"
                className="p-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-lg transition-all text-on-surface-variant active:scale-95"
              >
                <span className="material-symbols-outlined">settings</span>
              </button>
            </div>
            <img
              alt="User profile"
              className="w-8 h-8 rounded-full border border-outline-variant shrink-0"
              data-alt="professional portrait of a middle-aged male curator in a minimalist art studio setting with soft natural lighting"
              src={PROFILE_AVATAR}
            />
          </div>
        </div>
      </header>

      <main className="pt-24 pb-20 md:pb-8 px-4 md:px-8 max-w-[1920px] mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">Inventory Items</h1>
            <p className="text-on-surface-variant mt-1">Manage all products and stock-keeping units</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group w-full md:w-auto">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">
                search
              </span>
              <input
                className="pl-10 pr-4 py-2.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all w-full md:w-64 text-sm"
                placeholder="Search inventory..."
                type="search"
                aria-label="Search inventory"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl hover:bg-surface-container-high transition-colors text-sm w-full md:w-auto justify-between md:justify-start"
              >
                <span>Category: All</span>
                <span className="material-symbols-outlined text-sm">expand_more</span>
              </button>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full font-semibold shadow-lg shadow-primary/10 active:scale-95 transition-all w-full sm:w-auto justify-center"
            >
              <span className="material-symbols-outlined">add</span>
              <span>Add Item</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface-container-low dark:bg-slate-800/40 p-6 rounded-3xl">
            <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-2 block">Total Value</span>
            <div className="font-headline text-3xl font-extrabold text-on-surface">$1,284,000</div>
            <div className="mt-2 flex items-center text-xs text-green-600 font-medium">
              <span className="material-symbols-outlined text-sm mr-1">trending_up</span> +4.2% from last month
            </div>
          </div>
          <div className="bg-surface-container-low dark:bg-slate-800/40 p-6 rounded-3xl">
            <span className="text-xs font-semibold text-secondary uppercase tracking-widest mb-2 block">Active SKUs</span>
            <div className="font-headline text-3xl font-extrabold text-on-surface">4,892</div>
            <div className="mt-2 text-xs text-on-surface-variant font-medium">Across 4 warehouses</div>
          </div>
          <div className="bg-surface-container-low dark:bg-slate-800/40 p-6 rounded-3xl">
            <span className="text-xs font-semibold text-tertiary uppercase tracking-widest mb-2 block">Critical Stock</span>
            <div className="font-headline text-3xl font-extrabold text-tertiary">12</div>
            <div className="mt-2 flex items-center text-xs text-tertiary font-medium">
              <span className="material-symbols-outlined text-sm mr-1">warning</span> Action required
            </div>
          </div>
          <div className="bg-surface-container-low dark:bg-slate-800/40 p-6 rounded-3xl">
            <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-2 block">Processing</span>
            <div className="font-headline text-3xl font-extrabold text-on-surface">84</div>
            <div className="mt-2 text-xs text-on-surface-variant font-medium">Outbound shipments today</div>
          </div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-slate-900/50 rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-surface-container-low/50 dark:bg-slate-800/30">
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Item Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">SKU Code</th>
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Qty on Hand</th>
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Reorder Level</th>
                  <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5 dark:divide-slate-700/50">
                {inventoryRows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-container/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-surface-container-high overflow-hidden shrink-0">
                          <img
                            alt="Product"
                            className="w-full h-full object-cover"
                            data-alt={row.imageAlt}
                            src={row.image}
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-on-surface">{row.name}</div>
                          <div className="text-xs text-on-surface-variant">{row.subtitle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-on-surface-variant">{row.sku}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-xs font-medium rounded-full">
                        {row.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{row.unit}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-bold ${row.qtyTone === "tertiary" ? "text-tertiary" : "text-on-surface"}`}
                        >
                          {row.qty}
                        </span>
                        <div className={`w-16 h-1 ${row.barTrack} rounded-full overflow-hidden`}>
                          <div className={`${row.barFill} h-full rounded-full`} style={{ width: row.barPct }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {row.reorderBadge ? (
                        <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-bold rounded-full uppercase tracking-tighter">
                          {row.reorderBadge}
                        </span>
                      ) : (
                        <span className="text-sm text-on-surface-variant">{row.reorder}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-fixed rounded-lg transition-all"
                          aria-label="Edit item"
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button
                          type="button"
                          className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-lg transition-all"
                          aria-label="Delete item"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-surface-container-low/30 dark:bg-slate-800/30 border-t border-outline-variant/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-on-surface-variant text-center sm:text-left">Showing 1 to 4 of 4,892 items</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="p-2 bg-surface-container-highest rounded-lg text-on-surface hover:bg-surface-container-high transition-colors active:scale-95 disabled:opacity-50"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors active:scale-95 ${
                    page === n ? "bg-primary text-on-primary" : "hover:bg-surface-container-high text-on-surface"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="p-2 bg-surface-container-highest rounded-lg text-on-surface hover:bg-surface-container-high transition-colors active:scale-95"
                aria-label="Next page"
                onClick={() => setPage((p) => Math.min(3, p + 1))}
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 w-full z-50 md:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] h-16 flex justify-around items-center px-4 pb-safe font-['Inter'] text-[10px] font-medium">
        <Link to="/" className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-1">
          <span className="material-symbols-outlined">dashboard</span>
          <span>Dashboard</span>
        </Link>
        <span className="flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-xl px-3 py-1">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            inventory_2
          </span>
          <span>Inventory</span>
        </span>
        <a className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-1" href="#">
          <span className="material-symbols-outlined">receipt_long</span>
          <span>Orders</span>
        </a>
        <a className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-1" href="#">
          <span className="material-symbols-outlined">analytics</span>
          <span>Reports</span>
        </a>
      </nav>
    </div>
  );
}
