import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed">
      <nav className="fixed top-0 z-50 w-full bg-white/70 shadow-sm backdrop-blur-md dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">The Fluid Curator</div>
          <div className="hidden items-center gap-8 md:flex">
            <a className="border-b-2 border-blue-600 font-manrope font-semibold tracking-tight text-blue-600 dark:text-blue-400" href="#home">
              Home
            </a>
            <a
              className="font-manrope tracking-tight text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
              href="#features"
            >
              Features
            </a>
            <a
              className="font-manrope tracking-tight text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
              href="#about"
            >
              About
            </a>
            <a
              className="font-manrope tracking-tight text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
              href="#contact"
            >
              Contact
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="rounded-full px-5 py-2 font-semibold text-slate-600 transition-all duration-200 hover:bg-blue-50/50 active:scale-95"
            >
              Login
            </Link>
            <Link
              to="/login"
              className="rounded-full bg-gradient-to-r from-primary to-primary-container px-6 py-2.5 font-bold text-white shadow-lg transition-all hover:shadow-primary/20 active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-24">
        <section id="home" className="mx-auto max-w-7xl px-6 py-20 text-center">
          <div className="mb-8 inline-flex items-center rounded-full bg-secondary-container px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-on-secondary-container">
            Next-Gen Inventory Control
          </div>
          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-on-surface md:text-7xl">
            Smart Inventory Management <br />
            <span className="text-surface-tint">Made Simple</span>
          </h1>
          <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-on-surface-variant">
            Precision tracking and real-time optimization for the modern executive. Transform your warehouse operations into a fluid, curated
            narrative of efficiency.
          </p>
          <div className="mb-20 flex flex-wrap justify-center gap-4">
            <Link
              to="/login"
              className="rounded-full bg-primary px-8 py-4 text-lg font-bold text-white shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
            >
              Get Started Now
            </Link>
            <button className="flex items-center gap-2 rounded-full bg-surface-container-high px-8 py-4 text-lg font-bold text-on-surface transition-all hover:bg-surface-container-highest">
              <span className="material-symbols-outlined">play_circle</span> View Demo
            </button>
          </div>
          <div className="group relative mx-auto max-w-5xl">
            <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-primary/20 to-surface-tint/20 opacity-70 blur-2xl transition-all group-hover:blur-3xl"></div>
            <div className="relative overflow-hidden rounded-[2rem] bg-surface-container-lowest p-4 shadow-2xl">
              <img
                alt="Dashboard Preview"
                className="h-auto w-full rounded-[1.5rem]"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDRfmHjRe3UKdmJ5WhnGgqZSqzAfEAFxlxP1sSaMlv06Kx_LsiyGz2-Y6NC1iSW77v0WMRN1cDl3dPOgDdxF3qQL8OMqwD2o7YY1dEN3_QwWDcXgkcCrm8B97nCBfL8dK7wzPmGBdS9mCgtyAdYTsIHrs6AqHF7RdO5Fx2xX0SNesszyGnPzKH8D2N8o2NB0KeCygZ-fUq98tMOVPwcG5xozA0GRwPA3syJd1L8PR1-J91lcq_GzmhQR2USfRvzo_S-njayAWy22SM"
              />
            </div>
          </div>
        </section>

        <section id="features" className="bg-surface-container-low py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <h2 className="mb-2 text-3xl font-extrabold text-on-surface">Architected for Speed</h2>
                <p className="max-w-md text-on-surface-variant">Every tool you need to maintain a perfect flow from intake to delivery.</p>
              </div>
              <div className="mx-8 hidden h-px flex-grow bg-outline-variant/30 md:block"></div>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="group flex flex-col justify-between rounded-[2rem] bg-surface-container-lowest p-8 transition-all hover:shadow-xl md:col-span-2">
                <div>
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
                    <span className="material-symbols-outlined text-3xl">inventory_2</span>
                  </div>
                  <h3 className="mb-4 text-2xl font-bold">Inventory Tracking</h3>
                  <p className="leading-relaxed text-on-surface-variant">
                    Real-time visibility across all locations. Our intelligent tracking system predicts shortages before they happen using neural
                    demand forecasting.
                  </p>
                </div>
                <div className="mt-8 flex items-center justify-between border-t border-outline-variant/10 pt-8">
                  <span className="text-sm font-semibold text-primary">Live status updates</span>
                  <span className="material-symbols-outlined text-primary transition-transform group-hover:translate-x-2">arrow_forward</span>
                </div>
              </div>
              <div className="group rounded-[2rem] bg-surface-container-lowest p-8 transition-all hover:shadow-xl">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-tertiary-fixed text-tertiary">
                  <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
                </div>
                <h3 className="mb-4 text-2xl font-bold">Smart Scanning</h3>
                <p className="text-on-surface-variant">Native Barcode & QR support. Instantly log movements with any mobile device or industrial scanner.</p>
              </div>
              <div className="group rounded-[2rem] bg-surface-container-lowest p-8 transition-all hover:shadow-xl">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-container text-secondary">
                  <span className="material-symbols-outlined text-3xl">move_up</span>
                </div>
                <h3 className="mb-4 text-2xl font-bold">Stock Movement</h3>
                <p className="text-on-surface-variant">Trace every pallet and parcel. Full audit trails for internal transfers and outbound logistics.</p>
              </div>
              <div className="group rounded-[2rem] bg-surface-container-lowest p-8 transition-all hover:shadow-xl">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
                  <span className="material-symbols-outlined text-3xl">calculate</span>
                </div>
                <h3 className="mb-4 text-2xl font-bold">Easy Counting</h3>
                <p className="text-on-surface-variant">Cycle counts and wall-to-wall audits simplified. Minimize downtime during stock-takes.</p>
              </div>
              <div className="group rounded-[2rem] bg-surface-container-lowest p-8 transition-all hover:shadow-xl">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-tertiary-fixed text-tertiary">
                  <span className="material-symbols-outlined text-3xl">bar_chart</span>
                </div>
                <h3 className="mb-4 text-2xl font-bold">Advanced Analytics</h3>
                <p className="text-on-surface-variant">
                  Comprehensive reporting on disposal, shelf-life, and waste management to optimize your bottom line.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-20 text-center">
              <h2 className="mb-4 text-4xl font-extrabold">Seamless Workflow</h2>
              <p className="mx-auto max-w-xl text-on-surface-variant">From procurement to reporting, we curate every step of your inventory lifecycle.</p>
            </div>
            <div className="relative">
              <div className="absolute left-0 top-1/2 z-0 hidden h-0.5 w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-primary-fixed to-transparent md:block"></div>
              <div className="relative z-10 grid grid-cols-1 gap-12 md:grid-cols-4">
                {[
                  ["01", "Purchase Order", "Automated requests based on dynamic stock thresholds."],
                  ["02", "Receiving", "Scan and verify incoming goods with instant discrepancy alerts."],
                  ["03", "Optimization", "Smart placement and picking paths for maximum speed."],
                  ["04", "Reporting", "Full-circle visibility into performance and ROI."]
                ].map(([step, title, desc]) => (
                  <div key={step} className="flex flex-col items-center text-center">
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border-4 border-surface bg-surface-container-lowest shadow-lg text-primary">
                      <span className="text-xl font-bold">{step}</span>
                    </div>
                    <h4 className="mb-2 text-lg font-bold">{title}</h4>
                    <p className="text-sm text-on-surface-variant">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="relative overflow-hidden bg-primary py-24 text-white">
          <div className="absolute inset-0 opacity-10">
            <img
              alt="Pattern"
              className="h-full w-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQdRsopSAU4IKOgu0jwjUGW5wFJfVM9BOLVB3vKOxcsN2911Lr6Hw-jJxIoULnPPtq3YUQETm2JeJIwTpAbC_gyTfJRlFul-Z9svxCgCGUMIEO_j0OazyeTwvKHycizIKZTGZWjcZLbGErQmxSz_TSK6datwmxplRpaa0whIDBRLw8DEu45BcEXscDW-MAmXQ8nAp7VRyPDd4jQsi_Mh77qf4_8E_qoiAL70RpXGI4cpnUmZPoYhDaC6j3R2qXFOScvXmxJrLGChY"
            />
          </div>
          <div className="relative z-10 mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 items-center gap-20 lg:grid-cols-2">
              <div>
                <h2 className="mb-8 text-4xl font-extrabold leading-tight md:text-5xl">
                  Efficiency isn't just a metric. It's a Competitive Advantage.
                </h2>
                <p className="mb-8 text-lg leading-relaxed text-primary-fixed">
                  The Fluid Curator was born from a simple observation: traditional ERPs are too rigid for the speed of modern commerce. We built
                  a system that adapts to you, reducing human error by 94% while increasing fulfillment speed by up to 3x.
                </p>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="mb-1 text-4xl font-extrabold tracking-tighter">99.9%</div>
                    <div className="text-sm font-medium uppercase tracking-wider text-primary-fixed">Accuracy Rate</div>
                  </div>
                  <div>
                    <div className="mb-1 text-4xl font-extrabold tracking-tighter">15min</div>
                    <div className="text-sm font-medium uppercase tracking-wider text-primary-fixed">Onboarding</div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <img
                  alt="Warehouse Innovation"
                  className="rounded-[3rem] shadow-2xl"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJWpOc75qPTEBLoeM0PpaW4QOb1BV5veXQTBKBljLtDhnjw0N8dvXo-MJ5bhBgJFWPBpWqZY2VQ2a2ixhifdlRzb6dxZmFKU-0cZbvhaNUg_bBFv1CNdtJ2FOkLAL7mm7GT0lWk2-gV2d4aSMkUiLrA1m2sQDD2uBvH3-XfhkIdMnQ0DaFL3sDDls7lp41SqH3bJZLQnwty0GEVvcBnHmVhAPZzFe6XOiHyAirScUUn74K5eiBcRQokFf1EdkeXXBOQLQKISX0TBA"
                />
                <div className="absolute -bottom-6 -right-6 hidden max-w-xs rounded-[2rem] bg-surface-bright p-8 text-on-surface shadow-xl md:block">
                  <span className="material-symbols-outlined mb-4 text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    format_quote
                  </span>
                  <p className="font-medium italic leading-relaxed">
                    "The first inventory system that actually feels like it was designed for people, not just databases."
                  </p>
                  <div className="mt-4 text-sm font-bold text-on-surface-variant">- Logistics Director, Global Tech</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-surface py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-extrabold">Tailored for Every Stakeholder</h2>
              <p className="text-on-surface-variant">Custom interfaces designed for the specific needs of your entire team.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              {[
                ["admin_panel_settings", "Admin"],
                ["warehouse", "Warehouse"],
                ["precision_manufacturing", "Production"],
                ["shopping_cart", "Procurement"],
                ["insights", "Management"]
              ].map(([icon, label]) => (
                <div
                  key={label}
                  className="flex flex-col items-center rounded-2xl bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-[4px]"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-primary">
                    <span className="material-symbols-outlined">{icon}</span>
                  </div>
                  <h4 className="text-sm font-bold">{label}</h4>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-24">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[3rem] bg-gradient-to-br from-primary to-primary-container p-12 text-center text-white shadow-2xl md:p-20">
            <div className="absolute left-0 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl"></div>
            <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/2 translate-y-1/2 rounded-full bg-surface-tint/20 blur-3xl"></div>
            <h2 className="relative z-10 mb-8 text-4xl font-extrabold md:text-5xl">Start Managing Your Inventory Smarter Today</h2>
            <p className="relative z-10 mx-auto mb-12 max-w-2xl text-lg text-on-primary-container">
              Join hundreds of high-growth companies that have ditched spreadsheets for a more curated way of doing business.
            </p>
            <div className="relative z-10 flex flex-col justify-center gap-6 sm:flex-row">
              <Link to="/login" className="rounded-full bg-white px-10 py-5 text-xl font-bold text-primary transition-all hover:scale-105">
                Get Started Now
              </Link>
              <button className="rounded-full border-2 border-white/30 px-10 py-5 text-xl font-bold text-white transition-all hover:bg-white/10">
                Schedule a Call
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="w-full bg-slate-50 pb-8 pt-16 dark:bg-slate-950">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 text-sm leading-relaxed md:grid-cols-2">
          <div>
            <div className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-200">The Fluid Curator</div>
            <p className="mb-8 max-w-xs text-slate-500 dark:text-slate-500">
              © 2024 The Fluid Curator. Precision inventory management for the modern executive.
            </p>
            <div className="flex gap-6">
              <a className="text-slate-500 transition-colors hover:text-blue-600 hover:underline" href="#contact">
                Instagram
              </a>
              <a className="text-slate-500 transition-colors hover:text-blue-600 hover:underline" href="#contact">
                LinkedIn
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-800 dark:text-slate-200">Product</div>
              <a className="text-slate-500 transition-colors hover:text-blue-600 hover:underline" href="#features">
                Features
              </a>
              <a className="text-slate-500 transition-colors hover:text-blue-600 hover:underline" href="#contact">
                Pricing
              </a>
              <a className="text-slate-500 transition-colors hover:text-blue-600 hover:underline" href="#home">
                Demo
              </a>
            </div>
            <div className="flex flex-col gap-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-800 dark:text-slate-200">Support</div>
              <a className="text-slate-500 transition-colors hover:text-blue-600 hover:underline" href="#contact">
                Privacy Policy
              </a>
              <a className="text-slate-500 transition-colors hover:text-blue-600 hover:underline" href="#contact">
                Terms of Service
              </a>
              <a className="text-slate-500 transition-colors hover:text-blue-600 hover:underline" href="#contact">
                Cookie Policy
              </a>
              <a className="text-slate-500 transition-colors hover:text-blue-600 hover:underline" href="#contact">
                Contact Support
              </a>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-7xl border-t border-slate-200 px-6 pt-8 text-center text-xs text-slate-400 dark:border-slate-800">
          Handcrafted with precision for high-stakes logistics.
        </div>
      </footer>
    </div>
  );
}
