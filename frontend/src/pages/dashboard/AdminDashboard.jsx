import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  canAccessPath,
  canActOnProcurementAlerts,
  canManageUsers,
  canSeeActiveAlerts,
  canSeeExpeditedSection,
  canSeeLedger,
  canSeeMovementVelocity,
  canSeeOverviewCard,
  canSeeRegionalHubs,
  canSeeStockShare,
  canShowReportsCard,
  normalizeRole,
  overviewCardKeysForRole,
  roleDashboardSubtitle,
} from "../../lib/roleAccess";

const EXECUTIVE_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAl1vk9F7RfgWZM_t-HHQpHI3L6Y8fXmpjBEPHYc0sQICv8jLjYpb3L8OiuJGEAZUvHLiy7WGfdbKsdDzsCt6cZbvzeH04HRARIk8YHMYO7xv2jlsKnVH4IgPvoMpSsPkw5BIfsmIBM0bTWcaePqC9m5I5JYvzlPHE33B3xdZBSYh_V6gcrR_mUzcETM_eRDPvynPoxUX5Gp3-FsjpFJjfwJhsJqdBydQVOmUzwJm4RjneVEWxoFMPZjKzHBveLX1PffNzqSLBYa5Q";

const overviewCards = [
  {
    key: "total",
    icon: "inventory_2",
    value: "12,842",
    label: "Total Items",
    iconBg: "bg-primary-fixed",
    iconClass: "text-on-primary-fixed-variant",
    variant: "simple"
  },
  {
    key: "low",
    icon: "warning",
    value: "14",
    label: "Low Stock",
    iconBg: "bg-tertiary-fixed",
    iconClass: "text-tertiary",
    valueClass: "text-tertiary",
    badge: "Critical",
    variant: "badge"
  },
  {
    key: "recv",
    icon: "download",
    value: "450",
    label: "Received (24h)",
    iconBg: "bg-surface-container-high",
    iconClass: "text-primary",
    variant: "simple"
  },
  {
    key: "dispatch",
    icon: "upload",
    value: "312",
    label: "Dispatched",
    iconBg: "bg-surface-container-high",
    iconClass: "text-primary",
    variant: "simple"
  },
  {
    key: "hubs",
    icon: "location_on",
    value: "08",
    label: "Active Hubs",
    iconBg: "bg-secondary-fixed",
    iconClass: "text-on-secondary-fixed-variant",
    variant: "simple"
  },
  {
    key: "pending",
    icon: "verified_user",
    value: "05",
    label: "Pending",
    iconBg: "bg-surface-container-high",
    iconClass: "text-on-surface-variant",
    variant: "simple"
  }
];

/** Expedited Operations — routes wired; Create PO has no route (placeholder). */
const expeditedOperations = [
  {
    icon: "input_circle",
    title: "Receive Inventory",
    text: "Process new stock arrivals and audit manifest documents.",
    to: "/receive",
    primary: true
  },
  {
    icon: "move_item",
    title: "Internal Transfer",
    text: "Reallocate existing stock between warehouses and kitchens.",
    to: "/transfer"
  },
  {
    icon: "local_shipping",
    title: "Dispatch Order",
    text: "Ship curated inventory to active regional fulfillment points.",
    to: "/deliver"
  },
    {
    icon: "checklist",
    title: "Count Inventory",
    text: "Perform physical audits and reconcile stock level discrepancies.",
    to: "/count"
  },
  {
    icon: "delete_sweep",
    title: "Dispose Inventory",
    text: "Manage write-offs for damaged, expired, or obsolete assets.",
    to: "/dispose"
  }
];

const managementControl = [
  {
    icon: "package_2",
    title: "Inventory Items",
    text: "Manage items, categories, variants, and SKUs. Track stock details and maintain accurate product records.",
    to: "/inventory"
  },
  {
    icon: "assignment",
    title: "Purchase Orders",
    text: "Create and track supplier orders and monitor incoming inventory.",
    to: "/purchase-orders"
  },
  {
    icon: "bar_chart",
    title: "Reports & Analytics",
    text: "View inventory reports, stock levels, movement history, and system insights."
  }
];

const chartBars = [
  { track: "h-[30%]", fill: "h-[60%]" },
  { track: "h-[45%]", fill: "h-[80%]" },
  { track: "h-[60%]", fill: "h-[40%]" },
  { track: "h-[35%]", fill: "h-[90%]" },
  { track: "h-[80%]", fill: "h-[55%]" },
  { track: "h-[55%]", fill: "h-[75%]" },
  { track: "h-[90%]", fill: "h-[65%]" }
];

const ledgerLogs = [
  {
    user: "Marcus Chen",
    action: "RECEIVE",
    actionClass: "text-primary bg-primary-fixed",
    sku: "SKU-9023-V",
    qty: "+120",
    time: "12:45 PM"
  },
  {
    user: "Elena Rossi",
    action: "TRANSFER",
    actionClass: "text-secondary bg-secondary-fixed",
    sku: "MOD-L4-W2",
    qty: "45",
    time: "10:12 AM"
  },
  {
    user: "Sarah Jenkins",
    action: "DISPATCH",
    actionClass: "text-tertiary bg-tertiary-fixed",
    sku: "CR-99-ALPHA",
    qty: "-22",
    time: "09:55 AM"
  }
];

const regionalHubs = [
  {
    name: "Main Warehouse",
    sub: "Primary Logistics Center",
    units: "8,230",
    barWidth: "75%",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAGkU--4189n5iahPe50Pz_Z7O8h6xKBu-KeHnNVhB025GlZj9Ht6GxGQD0jl6xhFat-luaWUrWN_j6d9Ag6wGjg_4MQI-DLFnr2zbdZzzFmFrYF5WUTK-RqwjmoRXlRmby2H3TLjg7TtdbtZzluKPgmOwGjyC__ey5JJDmroMtZnkk_FLoWRTVkaZRjvMgkVb_RrD0-4OnA9Yi76khr-ExDunZS5Mnl3DNsIS4xCXtujfNJHho9Rb4qcAHPEXd_-VrDnTuKmpHIMY",
    imageAlt: "Modern industrial warehouse interior with neat high shelving systems, clean concrete floor, bright even lighting"
  },
  {
    name: "Central Kitchen",
    sub: "Hospitality Core",
    units: "2,115",
    barWidth: "45%",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBbkti447JZH-o31FXydKC8_Kr7s5H8JhXXVwcGV0YK9wg44CMaiTNd5m0CIhDfg4Wiy5jV-165ka_5vAdHbZxWNZH5XvyLMwB-i_SRnJ7Y5vkn4XD09mqSAWI6QDBm-_NoTYfUwNsfQS79HM-oYNUHW68jEIAKEDEhFpJPK6G0If_X1SQA9gtQf8BqqXZBnkNUkJIh0jRa6FDUwttu1HCNilNxr0f2nua77C9__XW4al_zxXwjaHUMeya9jNi6Vlcbr_QZloZNvbU",
    imageAlt: "Professional commercial kitchen space with stainless steel counters, high-end equipment, sterile environment, bright lighting"
  },
  {
    name: "North Transit Hub",
    sub: "Regional Fulfillment",
    units: "1,490",
    barWidth: "20%",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA-Ks1minw2dnfa-btkSoVw7D2V043XOVMFdNbYEucuLrqcVZHHEV0ASFQYNbUaBBaGMuh3KuYMnQk6bGEYdfgpOVI4r-saiU5V7bmlxz1pTPjKJy3Cu6DTWmO-r3QYJm44diowqsrueGpcVpa7M2RQnLyqYUgWtSO6QU6j2cxSxYAFiAFTOzNT9DoGvF334qfi5tg0Xy1JK_LXtlfp18kBmvMdwmx7_TC_FaqpnWcHRZ-nDvy1JBWxegvaGIEDs8JNhpYj9mtMub0",
    imageAlt: "Logistics distribution hub with loading bays, shipping containers, and trucks at sunset with dramatic long shadows"
  },
  {
    name: "R&D Lab",
    sub: "Research Assets",
    units: "1,007",
    barWidth: "90%",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCKSYHtQEYVF0G_-6lQufferiTQcB9v51s5S6F8YbFNgOZh-T2u6X98W_8Z324RZqn9sHW6llurKcPMnRzGqyF4ki3xRpnnd_VmEICOCnYQ2QD7TRrwPNHJE-YNVqdHMFZv7DdmxNKlPkj5QS9DNeHPsdbblTdQMmI7rpsWC_Du4sZFfqDooeM26qR6UeJ_Ofr0Zb_7J7bAXyYrQkYodBLpB4dlLerBgjQJmlp9PXITTDb3-Ajtu5IrcxeBg2dIAVOWfp794gBO-qE",
    imageAlt: "Clean laboratory setting with glass beakers and scientific equipment on white marble surface, teal and blue accents"
  }
];

function ExpeditedCard({ icon, title, text, to, primary }) {
  const className = primary
    ? "group relative flex flex-col items-start p-8 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white text-left transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/20 active:scale-95 overflow-hidden"
    : "group flex flex-col items-start p-8 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 dark:border-slate-700/40 text-on-surface text-left transition-all hover:bg-surface-bright hover:shadow-lg active:scale-95";

  const inner = (
    <>
      <span
        className={`material-symbols-outlined text-4xl mb-4 ${primary ? "opacity-80 group-hover:opacity-100 transition-opacity" : "text-primary opacity-80"}`}
      >
        {icon}
      </span>
      <h3 className="text-xl font-bold tracking-tight mb-2 font-headline">{title}</h3>
      <p className={primary ? "text-sm text-primary-fixed-dim leading-relaxed" : "text-sm text-on-surface-variant leading-relaxed"}>{text}</p>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={`${className} w-full cursor-default`}>
      {inner}
    </button>
  );
}

function ManagementCard({ icon, title, text, to }) {
  const className =
    "group flex flex-col items-start p-8 rounded-2xl bg-surface-container-lowest border border-outline-variant/10 dark:border-slate-700/40 text-on-surface text-left transition-all hover:bg-surface-bright hover:shadow-lg active:scale-95 w-full";
  const inner = (
    <>
      <span className="material-symbols-outlined text-4xl mb-4 text-primary opacity-80">{icon}</span>
      <h3 className="text-xl font-bold tracking-tight mb-2 font-headline">{title}</h3>
      <p className="text-sm text-on-surface-variant leading-relaxed">{text}</p>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={className}>
      {inner}
    </button>
  );
}

export default function AdminDashboard() {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [cards, setCards] = useState(overviewCards);
  const [liveLedgerLogs, setLiveLedgerLogs] = useState(ledgerLogs);
  const navigate = useNavigate();
  const { logout, role } = useAuth();
  const dropdownRef = useRef(null);

  const expeditedForRole = expeditedOperations.filter((op) => canAccessPath(role, op.to));
  const managementForRole = managementControl.filter((item) => {
    if (item.to) return canAccessPath(role, item.to);
    return canShowReportsCard(role);
  });
  const cardsForRole = cards.filter((card) => canSeeOverviewCard(role, card.key));

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDashboardData = async () => {
      const r = normalizeRole(role);
      const keys = overviewCardKeysForRole(r);

      if (!r || keys.length === 0) {
        setCards(overviewCards);
        setLiveLedgerLogs(ledgerLogs);
        return;
      }

      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const tasks = [];

        if (keys.includes("total")) {
          tasks.push(
            supabase.from("inventory_items").select("*", { count: "exact", head: true }).then((res) => ({ key: "total", res }))
          );
        }
        if (keys.includes("low")) {
          tasks.push(
            supabase
              .from("inventory_items")
              .select("*", { count: "exact", head: true })
              .lte("current_stock", 20)
              .then((res) => ({ key: "low", res }))
          );
        }
        if (keys.includes("recv")) {
          tasks.push(
            supabase
              .from("stock_movements")
              .select("*", { count: "exact", head: true })
              .eq("movement_type", "in")
              .gte("created_at", since)
              .then((res) => ({ key: "recv", res }))
          );
        }
        if (keys.includes("dispatch")) {
          tasks.push(
            supabase
              .from("stock_movements")
              .select("*", { count: "exact", head: true })
              .eq("movement_type", "out")
              .gte("created_at", since)
              .then((res) => ({ key: "dispatch", res }))
          );
        }
        if (keys.includes("hubs")) {
          tasks.push(
            supabase
              .from("inventory_items")
              .select("location")
              .not("location", "is", null)
              .limit(800)
              .then((res) => ({ key: "hubs", res }))
          );
        }
        if (keys.includes("pending")) {
          tasks.push(
            supabase
              .from("purchase_orders")
              .select("*", { count: "exact", head: true })
              .eq("status", "draft")
              .then((res) => ({ key: "pending", res }))
          );
        }

        const ledgerPromise = canSeeLedger(r)
          ? supabase
              .from("stock_movements")
              .select("id,movement_type,quantity,created_at,item_id")
              .order("created_at", { ascending: false })
              .limit(3)
          : Promise.resolve({ data: null, error: null });

        const [taskResults, ledgerRes] = await Promise.all([Promise.all(tasks), ledgerPromise]);

        if (cancelled) return;

        const counts = {
          total: null,
          low: null,
          recv: null,
          dispatch: null,
          hubs: null,
          pending: null,
        };

        for (const item of taskResults) {
          if (item.key === "hubs") {
            const { data, error } = item.res;
            if (!error && data?.length) {
              counts.hubs = new Set(data.map((row) => row.location).filter(Boolean)).size;
            }
            continue;
          }
          const { count, error } = item.res;
          if (!error && count != null) {
            counts[item.key] = count;
          }
        }

        setCards((prev) =>
          prev.map((card) => {
            if (!keys.includes(card.key)) return card;
            if (card.key === "total" && counts.total != null) return { ...card, value: counts.total.toLocaleString() };
            if (card.key === "low" && counts.low != null) return { ...card, value: counts.low.toString() };
            if (card.key === "recv" && counts.recv != null) return { ...card, value: counts.recv.toString() };
            if (card.key === "dispatch" && counts.dispatch != null) return { ...card, value: counts.dispatch.toString() };
            if (card.key === "hubs" && counts.hubs != null) return { ...card, value: counts.hubs.toString().padStart(2, "0") };
            if (card.key === "pending" && counts.pending != null) return { ...card, value: counts.pending.toString().padStart(2, "0") };
            return card;
          })
        );

        if (!ledgerRes.error && ledgerRes.data?.length) {
          const mappedLogs = ledgerRes.data.map((entry) => {
            const action = entry.movement_type?.toUpperCase() ?? "MOVEMENT";
            const qty = entry.movement_type === "out" ? `-${Math.abs(entry.quantity ?? 0)}` : `+${Math.abs(entry.quantity ?? 0)}`;
            const actionClass =
              action === "IN"
                ? "text-primary bg-primary-fixed"
                : action === "OUT"
                  ? "text-tertiary bg-tertiary-fixed"
                  : "text-secondary bg-secondary-fixed";
            let timeLabel = "—";
            if (entry.created_at) {
              const d = new Date(entry.created_at);
              if (!Number.isNaN(d.getTime())) {
                timeLabel = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              }
            }
            return {
              user: "System User",
              action,
              actionClass,
              sku: entry.item_id ?? "N/A",
              qty,
              time: timeLabel,
            };
          });
          setLiveLedgerLogs(mappedLogs);
        } else if (!cancelled) {
          setLiveLedgerLogs(ledgerLogs);
        }
      } catch (e) {
        console.error("Dashboard metrics load failed:", e);
        if (!cancelled) {
          setCards(overviewCards);
          setLiveLedgerLogs(ledgerLogs);
        }
      }
    };

    loadDashboardData();
    return () => {
      cancelled = true;
    };
  }, [role]);

  return (
    <div className="bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed min-h-screen">
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl bg-surface-bright border-b border-white/10 shadow-sm shadow-blue-900/5">
        <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-6 lg:gap-8 min-w-0">
            <Link
              to="/"
              className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white font-headline shrink-0 hover:opacity-90 transition-opacity"
            >
              The Fluid Curator
            </Link>
            <nav className="hidden md:flex gap-6 items-center flex-wrap">
              <span className="font-manrope font-semibold tracking-tight text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 pb-1 cursor-default">
                Dashboard
              </span>
              {canAccessPath(role, "/inventory") && (
                <Link
                  to="/inventory"
                  className="font-manrope font-semibold tracking-tight text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  Inventory
                </Link>
              )}
              {canShowReportsCard(role) && (
                <span className="font-manrope font-semibold tracking-tight text-slate-400 dark:text-slate-500 cursor-default">
                  Reports
                </span>
              )}
              <span className="font-manrope font-semibold tracking-tight text-slate-400 dark:text-slate-500 cursor-default">
                Locations
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-4 lg:gap-6 min-w-0">
            <div className="relative hidden lg:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
              <input
                className="bg-surface-container-highest border-none rounded-full pl-10 pr-4 py-2 text-sm w-52 xl:w-64 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all outline-none"
                placeholder="Search curated assets..."
                type="search"
                aria-label="Search curated assets"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="p-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 rounded-lg transition-all active:scale-95 duration-200 text-slate-500 dark:text-slate-400"
              >
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button
                type="button"
                className="p-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 rounded-lg transition-all active:scale-95 duration-200 text-slate-500 dark:text-slate-400"
              >
                <span className="material-symbols-outlined">settings</span>
              </button>
              <div className="relative ml-2" ref={dropdownRef}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden border-2 border-surface-bright shrink-0 hover:border-primary transition-colors"
              >
                <img
                  alt="Executive profile avatar"
                  className="w-full h-full object-cover"
                  data-alt="Executive professional in business attire looking forward, soft high-key studio lighting, editorial style"
                  src={EXECUTIVE_AVATAR}
                />
              </button>

              {/* User Dropdown Menu */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-lg border border-surface-container py-2 z-50">
                  {canManageUsers(role) && (
                    <Link
                      to="/users"
                      onClick={() => setShowUserDropdown(false)}
                      className="w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container transition-colors flex items-center gap-3"
                    >
                      <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                      <span>Users</span>
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-error hover:bg-error-container transition-colors flex items-center gap-3"
                  >
                    <span className="material-symbols-outlined text-lg">logout</span>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto space-y-10">
        <header className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface font-headline">Dashboard</h1>
            {role ? (
              <span className="text-xs font-semibold uppercase tracking-wider text-primary px-2 py-1 rounded-full bg-primary/10">
                {role}
              </span>
            ) : null}
          </div>
          <p className="text-on-surface-variant font-medium">{roleDashboardSubtitle(role)}</p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {cardsForRole.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 p-6 text-sm text-on-surface-variant">
              No KPI widgets are configured for your role. Contact an administrator if this is unexpected.
            </div>
          ) : null}
          {cardsForRole.map((card) =>
            card.variant === "badge" ? (
              <div key={card.key} className="bg-surface-container-lowest p-6 rounded-xl shadow-sm shadow-on-surface/5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className={`w-10 h-10 rounded-full ${card.iconBg} flex items-center justify-center ${card.iconClass}`}>
                    <span className="material-symbols-outlined">{card.icon}</span>
                  </div>
                  <span className="bg-tertiary text-on-tertiary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {card.badge}
                  </span>
                </div>
                <div>
                  <span className={`text-4xl font-extrabold tracking-tight headline ${card.valueClass ?? ""}`}>{card.value}</span>
                  <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mt-1">{card.label}</p>
                </div>
              </div>
            ) : (
              <div key={card.key} className="bg-surface-container-lowest p-6 rounded-xl shadow-sm shadow-on-surface/5 flex flex-col gap-4">
                <div className={`w-10 h-10 rounded-full ${card.iconBg} flex items-center justify-center ${card.iconClass}`}>
                  <span className="material-symbols-outlined">{card.icon}</span>
                </div>
                <div>
                  <span className={`text-4xl font-extrabold tracking-tight headline ${card.valueClass ?? ""}`}>{card.value}</span>
                  <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mt-1">{card.label}</p>
                </div>
              </div>
            )
          )}
        </section>

        {canSeeExpeditedSection(role) && expeditedForRole.length > 0 ? (
          <section className="space-y-6">
            <h2 className="text-lg font-bold tracking-tight text-on-surface-variant uppercase font-headline">Expedited Operations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {expeditedForRole.map((op) => (
                <ExpeditedCard key={op.title} icon={op.icon} title={op.title} text={op.text} to={op.to} primary={op.primary} />
              ))}
            </div>
          </section>
        ) : canSeeExpeditedSection(role) ? (
          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 p-6 text-sm text-on-surface-variant">
            No expedited actions are available for your role. Use Management &amp; Control below if shown.
          </section>
        ) : (
          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 p-6 text-sm text-on-surface-variant">
            Operational shortcuts are not shown for your role. Use reports and monitoring sections below.
          </section>
        )}

        {managementForRole.length > 0 ? (
          <section className="space-y-6">
            <h2 className="text-lg font-bold tracking-tight text-on-surface-variant uppercase font-headline">Management &amp; Control</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {managementForRole.map((item) => (
                <ManagementCard key={item.title} icon={item.icon} title={item.title} text={item.text} to={item.to} />
              ))}
            </div>
          </section>
        ) : null}

        {(canSeeMovementVelocity(role) || canSeeStockShare(role)) && (
        <div
          className={`grid grid-cols-1 gap-8 ${
            canSeeMovementVelocity(role) && canSeeStockShare(role) ? "lg:grid-cols-12" : ""
          }`}
        >
          {canSeeMovementVelocity(role) && (
          <div
            className={`bg-surface-container-low rounded-3xl p-8 min-h-[400px] flex flex-col ${
              canSeeStockShare(role) ? "lg:col-span-8" : "lg:col-span-12"
            }`}
          >
            <div className="flex flex-wrap justify-between items-center gap-4 mb-10">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight font-headline">Movement Velocity</h2>
                <p className="text-sm text-on-surface-variant">Daily inventory fluctuations across all hubs</p>
              </div>
              <div className="flex bg-surface-container-highest p-1 rounded-full" role="group" aria-label="Chart period">
                <button type="button" className="px-4 py-1.5 rounded-full text-xs font-bold bg-surface-container-lowest shadow-sm">
                  WEEKLY
                </button>
                <button type="button" className="px-4 py-1.5 rounded-full text-xs font-bold text-on-surface-variant">
                  MONTHLY
                </button>
              </div>
            </div>
            <div className="flex-grow flex items-end gap-3 px-4 min-h-[200px]">
              {chartBars.map((bar, i) => (
                <div key={i} className={`flex-grow ${bar.track} bg-primary/10 rounded-t-xl relative ${i === 0 ? "group" : ""}`}>
                  <div className={`absolute inset-x-0 bottom-0 ${bar.fill} bg-primary rounded-t-xl`} />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-6 px-4 text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
          </div>
          )}
          {canSeeStockShare(role) && (
          <div
            className={`bg-surface-container-highest rounded-3xl p-8 flex flex-col justify-between ${
              canSeeMovementVelocity(role) ? "lg:col-span-4" : "lg:col-span-12"
            }`}
          >
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight font-headline">Stock Share</h2>
              <p className="text-sm text-on-surface-variant">Asset distribution by hub</p>
            </div>
            <div className="relative w-48 h-48 mx-auto my-12">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100" aria-hidden>
                <circle className="text-surface-container-low" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeWidth="12" />
                <circle
                  className="text-primary"
                  cx="50"
                  cy="50"
                  fill="transparent"
                  r="40"
                  stroke="currentColor"
                  strokeDasharray="251.2"
                  strokeDashoffset="62.8"
                  strokeWidth="12"
                />
                <circle
                  className="text-secondary"
                  cx="50"
                  cy="50"
                  fill="transparent"
                  r="40"
                  stroke="currentColor"
                  strokeDasharray="251.2"
                  strokeDashoffset="188.4"
                  strokeWidth="12"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold tracking-tighter headline">12.8k</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Units</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span>Central Warehouse</span>
                </div>
                <span className="text-on-surface-variant">75%</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-secondary" />
                  <span>Regional Hubs</span>
                </div>
                <span className="text-on-surface-variant">25%</span>
              </div>
            </div>
          </div>
          )}
        </div>
        )}

        {(canSeeLedger(role) || canSeeActiveAlerts(role)) && (
        <div
          className={`grid grid-cols-1 gap-8 ${
            canSeeLedger(role) && canSeeActiveAlerts(role) ? "xl:grid-cols-3" : ""
          }`}
        >
          {canSeeLedger(role) && (
          <div
            className={`bg-surface-container-lowest rounded-3xl p-8 shadow-sm shadow-on-surface/5 ${
              canSeeActiveAlerts(role) ? "xl:col-span-2" : "xl:col-span-3"
            }`}
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-extrabold tracking-tight font-headline">Recent Ledger Entries</h2>
              <button type="button" className="text-primary text-xs font-bold uppercase tracking-widest hover:underline transition-all">
                View All logs
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant border-b border-surface-container">
                    <th className="pb-4 font-bold">User</th>
                    <th className="pb-4 font-bold">Action</th>
                    <th className="pb-4 font-bold">Item Identifier</th>
                    <th className="pb-4 font-bold">Quantity</th>
                    <th className="pb-4 font-bold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {liveLedgerLogs.map((log) => (
                    <tr key={`${log.user}-${log.time}`} className="group hover:bg-surface transition-colors">
                      <td className="py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600" aria-hidden />
                          <span className="text-sm font-semibold">{log.user}</span>
                        </div>
                      </td>
                      <td className="py-5">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${log.actionClass}`}>{log.action}</span>
                      </td>
                      <td className="py-5 text-sm font-medium">{log.sku}</td>
                      <td className="py-5 text-sm font-bold">{log.qty}</td>
                      <td className="py-5 text-sm text-on-surface-variant">{log.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
          {canSeeActiveAlerts(role) && (
          <div className="bg-surface-container-low rounded-3xl p-8 flex flex-col gap-6">
            <h2 className="text-2xl font-extrabold tracking-tight font-headline">Active Alerts</h2>
            <div className="space-y-4">
              <div className="bg-surface-container-lowest p-5 rounded-2xl border-l-4 border-tertiary shadow-sm">
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-tertiary">priority_high</span>
                  <div>
                    <h4 className="text-sm font-bold mb-1">Low Stock: Liquid Nitro</h4>
                    <p className="text-xs text-on-surface-variant">Current levels at 5 units. Minimum threshold is 20 units.</p>
                    {canActOnProcurementAlerts(role) ? (
                      <button type="button" className="mt-3 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary-container">
                        Order Now
                      </button>
                    ) : (
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                        Contact procurement to reorder
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-5 rounded-2xl border-l-4 border-primary shadow-sm">
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-primary">info</span>
                  <div>
                    <h4 className="text-sm font-bold mb-1">Audit Scheduled</h4>
                    <p className="text-xs text-on-surface-variant">Warehouse Alpha physical count begins in 2 hours.</p>
                  </div>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-5 rounded-2xl border-l-4 border-on-surface-variant/30 shadow-sm opacity-60">
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-on-surface-variant">check_circle</span>
                  <div>
                    <h4 className="text-sm font-bold mb-1">Backup Completed</h4>
                    <p className="text-xs text-on-surface-variant">Database synchronization with cloud storage successful.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
        )}

        {canSeeRegionalHubs(role) && (
        <section className="space-y-6">
          <h2 className="text-lg font-bold tracking-tight text-on-surface-variant uppercase font-headline">Regional Hub Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {regionalHubs.map((hub) => (
              <div
                key={hub.name}
                className="group bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 hover:border-primary/20 transition-all hover:shadow-xl hover:shadow-on-surface/5"
              >
                <div className="h-32 w-full rounded-xl overflow-hidden mb-6 bg-surface-container">
                  <img
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    src={hub.image}
                    alt={hub.name}
                    data-alt={hub.imageAlt}
                  />
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="font-bold text-lg font-headline">{hub.name}</h3>
                    <p className="text-xs font-semibold text-on-surface-variant">{hub.sub}</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-xl font-extrabold headline">{hub.units}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Units</span>
                  </div>
                </div>
                <div className="mt-6 h-1 w-full bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: hub.barWidth }} />
                </div>
              </div>
            ))}
          </div>
        </section>
        )}
      </main>

      <footer className="w-full py-12 bg-transparent">
        <div className="flex flex-col md:flex-row justify-between items-center px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto opacity-60">
          <span className="font-['Inter'] text-xs uppercase tracking-widest text-slate-400 dark:text-slate-600">
            © 2024 The Fluid Curator Inventory Systems
          </span>
          <div className="flex flex-wrap gap-6 md:gap-8 mt-6 md:mt-0 justify-center">
            <a
              className="font-['Inter'] text-xs uppercase tracking-widest text-slate-400 dark:text-slate-600 hover:text-blue-500 transition-colors opacity-80 hover:opacity-100"
              href="#"
            >
              Privacy Policy
            </a>
            <a
              className="font-['Inter'] text-xs uppercase tracking-widest text-slate-400 dark:text-slate-600 hover:text-blue-500 transition-colors opacity-80 hover:opacity-100"
              href="#"
            >
              Terms of Service
            </a>
            <a
              className="font-['Inter'] text-xs uppercase tracking-widest text-slate-400 dark:text-slate-600 hover:text-blue-500 transition-colors opacity-80 hover:opacity-100"
              href="#"
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
