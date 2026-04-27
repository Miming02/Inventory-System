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
  canSeeStockShare,
  normalizeRole,
  overviewCardKeysForRole,
} from "../../lib/roleAccess";
import { NotificationBell } from "../../components/NotificationBell";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";

const overviewCards = [
  {
    key: "total",
    icon: "inventory_2",
    value: "0",
    label: "Total Items",
    iconBg: "bg-primary-fixed",
    iconClass: "text-on-primary-fixed-variant",
    variant: "simple"
  },
  {
    key: "low",
    icon: "warning",
    value: "0",
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
    value: "0",
    label: "Received (24h)",
    iconBg: "bg-surface-container-high",
    iconClass: "text-primary",
    variant: "simple"
  },
  {
    key: "dispatch",
    icon: "upload",
    value: "0",
    label: "Delivered (24h)",
    iconBg: "bg-surface-container-high",
    iconClass: "text-primary",
    variant: "simple"
  },
  {
    key: "hubs",
    icon: "location_on",
    value: "0",
    label: "Active Hubs",
    iconBg: "bg-secondary-fixed",
    iconClass: "text-on-secondary-fixed-variant",
    variant: "simple"
  },
  {
    key: "pending",
    icon: "verified_user",
    value: "0",
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
    title: "Receive",
    text: "Process new stock arrivals and audit manifest documents.",
    to: "/receive",
    primary: true
  },
  {
    icon: "move_item",
    title: "Transfer",
    text: "Reallocate existing stock between warehouses and kitchens.",
    to: "/transfer"
  },
  {
    icon: "local_shipping",
    title: "Deliver",
    text: "Record outbound deliveries and ship curated inventory to regional fulfillment points.",
    to: "/deliver"
  },
  {
    icon: "checklist",
    title: "Count",
    text: "Perform physical audits and reconcile stock level discrepancies.",
    to: "/count"
  },
  {
    icon: "delete_sweep",
    title: "Dispose",
    text: "Manage write-offs for damaged, expired, or obsolete assets.",
    to: "/dispose"
  },  
  {
    icon: "precision_manufacturing",
    title: "Produce",
    text: "Produce finished goods and automatically deduct components based on BOM.",
    to: "/produce"
  }
];

const managementControl = [
  {
    icon: "inventory_2",
    title: "View Storage",
    text: "View all inventory in storage by location, SKU, and stock levels.",
    to: "/inventory"
  },
  {
    icon: "settings",
    title: "System Settings",
    text: "Manage users, audit logs, approvals, and master data.",
    to: "/settings"
  },
  {
    icon: "assignment",
    title: "Purchase Orders",
    text: "Create and track supplier orders and monitor incoming inventory.",
    to: "/purchase-orders"
  },
  {
    icon: "summarize",
    title: "Generate Report",
    text: "Direct shortcuts to inventory items and purchase orders reporting.",
    to: "/reports"
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

const SHOW_ADVANCED_DASHBOARD_SECTIONS = false;

function profileDisplayName(p) {
  if (!p) return "Team member";
  const fn = (p.first_name || "").trim();
  const ln = (p.last_name || "").trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
  return p.email || "Team member";
}

function profileLabelFromRow(p) {
  if (!p) return "Team member";
  const fn = (p.first_name || "").trim();
  const ln = (p.last_name || "").trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
  return p.email || "Team member";
}

function movementActionLabel(movementType) {
  const t = (movementType || "").toLowerCase();
  if (t === "in") return "IN";
  if (t === "out") return "OUT";
  if (t === "transfer") return "TRANSFER";
  return (movementType || "MOVE").toUpperCase();
}

function ExpeditedCard({ icon, title, text, to, primary }) {
  const className = primary
    ? "group relative flex flex-col items-start p-4 rounded-xl bg-gradient-to-br from-primary to-primary-container text-white text-left transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-primary/20 active:scale-95 overflow-hidden min-h-[142px]"
    : "group flex flex-col items-start p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10 dark:border-slate-700/40 text-on-surface text-left transition-all hover:bg-surface-bright hover:shadow-lg active:scale-95 min-h-[142px]";

  const inner = (
    <>
      <span className={`material-symbols-outlined text-2xl mb-2 ${primary ? "opacity-80 group-hover:opacity-100 transition-opacity" : "text-primary opacity-80"}`}>
        {icon}
      </span>
      <h3 className="text-base font-bold tracking-tight mb-1.5 font-headline">{title}</h3>
      <p className={primary ? "text-xs text-primary-fixed-dim leading-relaxed" : "text-xs text-on-surface-variant leading-relaxed"}>{text}</p>
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
    "group flex flex-col items-start p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 dark:border-slate-700/40 text-on-surface text-left transition-all hover:bg-surface-bright hover:shadow-lg active:scale-95 w-full";
  const inner = (
    <>
      <span className="material-symbols-outlined text-3xl mb-3 text-primary opacity-80">{icon}</span>
      <h3 className="text-lg font-bold tracking-tight mb-1.5 font-headline">{title}</h3>
      <p className="text-xs text-on-surface-variant leading-relaxed">{text}</p>
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
  const [liveLedgerLogs, setLiveLedgerLogs] = useState([]);
  const [velocityBars, setVelocityBars] = useState(() => chartBars.map(() => ({ pct: 0 })));
  const [stockShare, setStockShare] = useState({ totalUnits: 0, primaryPct: 0, secondaryPct: 0, primaryLabel: "—", secondaryLabel: "—" });
  const [lowStockAlert, setLowStockAlert] = useState(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const navigate = useNavigate();
  const { logout, role, profile, user } = useAuth();
  const dropdownRef = useRef(null);

  const expeditedForRole = expeditedOperations.filter((op) => canAccessPath(role, op.to));
  const managementForRole = managementControl.filter((item) => {
    if (item.to === "/settings") return canManageUsers(role);
    if (item.to) return canAccessPath(role, item.to);
    return false;
  });
  const cardsForRole = cards.filter((card) => canSeeOverviewCard(role, card.key));
  const quickActions = [
    ...expeditedForRole.map((item) => ({
      title: item.title,
      to: item.to,
      icon: item.icon,
    })),
    ...managementForRole.map((item) => ({
      title: item.title,
      to: item.navTo || item.to,
      icon: item.icon,
    })),
  ];
  const canCreateInventoryItems = canAccessPath(role, "/bom");
  if (canCreateInventoryItems) {
    quickActions.splice(5, 0, {
      title: "Create Inventory Items",
      to: "/bom",
      icon: "add_box",
    });
  }
  const visibleQuickActions = quickActions.slice(0, 12);
  const topQuickActions = visibleQuickActions.slice(0, 6);
  const bottomQuickActions = visibleQuickActions.slice(6);
  const quickActionCardClass =
    "group relative flex h-[112px] w-full flex-col items-center justify-center overflow-hidden rounded-[1.15rem] border border-slate-200/75 bg-white px-3 py-3 text-center shadow-[0_6px_14px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_12px_24px_rgba(59,130,246,0.10)]";
  const canReviewApprovals = normalizeRole(role) === "Admin" || normalizeRole(role) === "Management";

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!SHOW_ADVANCED_DASHBOARD_SECTIONS) {
      setCards(overviewCards);
      setLiveLedgerLogs([]);
      return () => {
        cancelled = true;
      };
    }

    const loadDashboardData = async () => {
      const r = normalizeRole(role);
      const keys = overviewCardKeysForRole(r);

      if (!r || keys.length === 0) {
        setCards(overviewCards);
        setLiveLedgerLogs([]);
        return;
      }

      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const tasks = [];

        // Use GET + limit(0) instead of HEAD — avoids PostgREST/RLS edge cases and heavy Prefer paths.
        if (keys.includes("total")) {
          tasks.push(
            supabase
              .from("inventory_items")
              .select("id", { count: "exact", head: false })
              .limit(0)
              .then((res) => ({ key: "total", res }))
          );
        }
        if (keys.includes("low")) {
          tasks.push(
            supabase
              .from("inventory_items")
              .select("id", { count: "exact", head: false })
              .lte("current_stock", 20)
              .limit(0)
              .then((res) => ({ key: "low", res }))
          );
        }
        if (keys.includes("recv")) {
          tasks.push(
            supabase
              .from("stock_movements")
              .select("id", { count: "exact", head: false })
              .eq("movement_type", "in")
              .gte("created_at", since)
              .limit(0)
              .then((res) => ({ key: "recv", res }))
          );
        }
        if (keys.includes("dispatch")) {
          tasks.push(
            supabase
              .from("stock_movements")
              .select("id", { count: "exact", head: false })
              .eq("movement_type", "out")
              .gte("created_at", since)
              .limit(0)
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
              .select("id", { count: "exact", head: false })
              .eq("status", "sent")
              .limit(0)
              .then((res) => ({ key: "pending", res }))
          );
        }

        const taskResults = await Promise.all(tasks);

        // Avoid embedding profiles(...) — non-admin RLS only allows own profile row, which breaks PostgREST embeds (500).
        const ledgerPromise = canSeeLedger(r)
          ? supabase
              .from("stock_movements")
              .select("id,movement_type,quantity,created_at,item_id,created_by,inventory_items(sku,name)")
              .order("created_at", { ascending: false })
              .limit(8)
          : Promise.resolve({ data: null, error: null });

        const hubAggPromise = canSeeStockShare(r)
          ? supabase.from("inventory_items").select("location, current_stock").not("location", "is", null).limit(800)
          : Promise.resolve({ data: null, error: null });

        const velocityPromise =
          canSeeMovementVelocity(r) || canSeeStockShare(r)
            ? supabase
                .from("stock_movements")
                .select("created_at")
                .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                .limit(800)
            : Promise.resolve({ data: null, error: null });

        const lowStockPromise = canSeeActiveAlerts(r)
          ? supabase
              .from("inventory_items")
              .select("name, current_stock, reorder_level")
              .lte("current_stock", 20)
              .order("current_stock", { ascending: true })
              .limit(1)
          : Promise.resolve({ data: null, error: null });

        const [ledgerRes, hubRes, velRes, lowRes] = await Promise.all([
          ledgerPromise,
          hubAggPromise,
          velocityPromise,
          lowStockPromise,
        ]);

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
            if (error) {
              console.error(`Dashboard metric ${item.key}:`, error.message ?? error);
            }
            if (!error && data?.length) {
              counts.hubs = new Set(data.map((row) => row.location).filter(Boolean)).size;
            }
            continue;
          }
          const { count, error } = item.res;
          if (error) {
            console.error(`Dashboard metric ${item.key}:`, error.message ?? error);
          }
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
          const creatorIds = [...new Set(ledgerRes.data.map((entry) => entry.created_by).filter(Boolean))];
          let profileById = new Map();
          if (creatorIds.length > 0) {
            const profileRes = await supabase
              .from("profiles")
              .select("id,first_name,last_name,email,avatar_url")
              .in("id", creatorIds);
            if (!profileRes.error && profileRes.data?.length) {
              profileById = new Map(profileRes.data.map((p) => [p.id, p]));
            }
          }
          const mappedLogs = ledgerRes.data.map((entry) => {
            const action = movementActionLabel(entry.movement_type);
            const qty =
              entry.movement_type === "out" ? `-${Math.abs(entry.quantity ?? 0)}` : `+${Math.abs(entry.quantity ?? 0)}`;
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
                timeLabel = d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
              }
            }
            const inv = entry.inventory_items;
            const invRow = Array.isArray(inv) ? inv[0] : inv;
            const actor = entry.created_by ? profileById.get(entry.created_by) : null;
            return {
              id: entry.id,
              user: profileLabelFromRow(actor),
              avatar_url: actor?.avatar_url ?? null,
              action,
              actionClass,
              sku: invRow?.sku || invRow?.name || "—",
              qty,
              time: timeLabel,
            };
          });
          setLiveLedgerLogs(mappedLogs);
        } else if (!cancelled) {
          setLiveLedgerLogs([]);
        }

        if (!cancelled && !hubRes.error && hubRes.data?.length && canSeeStockShare(r)) {
          const byLoc = new Map();
          for (const row of hubRes.data) {
            const loc = row.location || "Unknown";
            byLoc.set(loc, (byLoc.get(loc) ?? 0) + Number(row.current_stock ?? 0));
          }
          const sorted = [...byLoc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
          if (sorted.length >= 1) {
            const total = sorted.reduce((s, [, u]) => s + u, 0);
            const a = sorted[0][1];
            const b = sorted.length > 1 ? sorted[1][1] : 0;
            setStockShare({
              totalUnits: Math.round(total),
              primaryPct: total ? Math.round((a / total) * 100) : 0,
              secondaryPct: sorted.length > 1 && total ? Math.round((b / total) * 100) : 0,
              primaryLabel: sorted[0][0],
              secondaryLabel: sorted.length > 1 ? sorted[1][0] : "—",
            });
          }
        } else if (!cancelled && canSeeStockShare(r)) {
          setStockShare({ totalUnits: 0, primaryPct: 0, secondaryPct: 0, primaryLabel: "—", secondaryLabel: "—" });
        }

        if (!cancelled && !velRes.error && velRes.data?.length && canSeeMovementVelocity(r)) {
          const counts = [0, 0, 0, 0, 0, 0, 0];
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          start.setDate(start.getDate() - 6);
          const startMs = start.getTime();
          const dayMs = 24 * 60 * 60 * 1000;
          for (const row of velRes.data) {
            if (!row.created_at) continue;
            const t = new Date(row.created_at).getTime();
            const idx = Math.floor((t - startMs) / dayMs);
            if (idx >= 0 && idx < 7) counts[idx] += 1;
          }
          const max = Math.max(...counts, 1);
          setVelocityBars(
            counts.map((c) => ({
              pct: Math.round((c / max) * 100),
            }))
          );
        } else if (!cancelled && canSeeMovementVelocity(r)) {
          setVelocityBars(chartBars.map(() => ({ pct: 0 })));
        }

        if (!cancelled && !lowRes.error && lowRes.data?.length && canSeeActiveAlerts(r)) {
          const row = lowRes.data[0];
          setLowStockAlert({
            name: row.name ?? "Item",
            current: row.current_stock ?? 0,
            reorder: row.reorder_level ?? 20,
          });
        } else if (!cancelled) {
          setLowStockAlert(null);
        }
      } catch (e) {
        console.error("Dashboard metrics load failed:", e);
        if (!cancelled) {
          setCards(overviewCards);
          setLiveLedgerLogs([]);
        }
      }
    };

    loadDashboardData();
    return () => {
      cancelled = true;
    };
  }, [role, user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!canReviewApprovals) {
      setPendingApprovalsCount(0);
      return () => {
        cancelled = true;
      };
    }
    const loadPendingApprovals = async () => {
      try {
        const [receiveRes, disposeRes, transferRes, poRes, deliveryRes, countRes] = await Promise.all([
          supabase
            .from("receive_transactions")
            .select("id", { count: "exact", head: false })
            .eq("status", "pending_approval")
            .limit(0),
          supabase
            .from("stock_adjustments")
            .select("id", { count: "exact", head: false })
            .eq("status", "pending")
            .limit(0),
          supabase
            .from("stock_transfers")
            .select("id", { count: "exact", head: false })
            .in("status", ["pending", "requested"])
            .limit(0),
          supabase
            .from("purchase_orders")
            .select("id", { count: "exact", head: false })
            .eq("status", "sent")
            .limit(0),
          supabase
            .from("delivery_requests")
            .select("id", { count: "exact", head: false })
            .eq("status", "pending_approval")
            .limit(0),
          supabase
            .from("stock_counts")
            .select("id", { count: "exact", head: false })
            .in("status", ["completed", "discrepancies_found"])
            .limit(0),
        ]);

        const total =
          Number(receiveRes.count || 0) +
          Number(disposeRes.count || 0) +
          Number(transferRes.count || 0) +
          Number(poRes.count || 0) +
          Number(deliveryRes.count || 0) +
          Number(countRes.count || 0);

        if (!cancelled) setPendingApprovalsCount(total);
      } catch {
        if (!cancelled) setPendingApprovalsCount(0);
      }
    };
    loadPendingApprovals();
    const timer = window.setInterval(loadPendingApprovals, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [canReviewApprovals]);

  return (
    <div className="bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed min-h-screen">
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl bg-surface-bright border-b border-white/10 shadow-sm shadow-blue-900/5">
        <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-6 lg:gap-8 min-w-0">
            <Link
              to="/"
              className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white font-headline shrink-0 hover:opacity-90 transition-opacity"
            >
              Inventory
            </Link>
          </div>
          <div className="flex items-center gap-4 lg:gap-6 min-w-0">
            <div className="flex items-center gap-3">
              <NotificationBell />
              {role ? (
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {role}
                </span>
              ) : null}
              <div className="relative ml-2" ref={dropdownRef}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="shrink-0 rounded-full border-2 border-surface-bright bg-surface-container-high p-0 transition-colors hover:border-primary"
                type="button"
                aria-label="Account menu"
              >
                <UserAvatarOrIcon src={profile?.avatar_url} alt={profileDisplayName(profile)} size="md" />
              </button>

              {/* User Dropdown Menu */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-lg border border-surface-container py-2 z-50">
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

      <main className="pt-24 pb-6 px-3 sm:px-4 lg:px-5 max-w-[1440px] mx-auto space-y-6">
        <section className="px-4 py-12 sm:px-8">
          <header className="flex flex-col items-center text-center">
            <h1 className="text-[2.1rem] font-extrabold tracking-tight text-on-surface font-headline">Welcome to InVentory</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              Your complete inventory and operations workspace
            </p>
          </header>
          {visibleQuickActions.length > 0 ? (
            <div className="mx-auto mt-9 flex max-w-[900px] flex-col items-center gap-4">
              <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {topQuickActions.map((action) => (
                  <Link
                    key={`${action.title}-${action.to}`}
                    to={action.to}
                    className={quickActionCardClass}
                  >
                    <span className="pointer-events-none absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-primary/65 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full text-primary/70 transition-all duration-200 group-hover:scale-105 group-hover:text-primary">
                      <span className="material-symbols-outlined text-[20px]">
                        {action.icon}
                      </span>
                    </span>
                    <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface leading-4">
                      {action.title}
                    </p>
                  </Link>
                ))}
              </div>
              {bottomQuickActions.length > 0 ? (
                <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-12">
                  {bottomQuickActions.map((action, idx) => (
                    (() => {
                      const centeredStarts = ["lg:col-start-2", "lg:col-start-4", "lg:col-start-6", "lg:col-start-8", "lg:col-start-10"];
                      const colStartClass = centeredStarts[idx] || "";
                      return (
                    <Link
                      key={`${action.title}-${action.to}`}
                      to={action.to}
                      className={`${quickActionCardClass} lg:col-span-2 ${colStartClass}`}
                    >
                      <span className="pointer-events-none absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-primary/65 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full text-primary/70 transition-all duration-200 group-hover:scale-105 group-hover:text-primary">
                        <span className="material-symbols-outlined text-[20px]">
                          {action.icon}
                        </span>
                      </span>
                      <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface leading-4">
                        {action.title}
                      </p>
                    </Link>
                      );
                    })()
                  ))}
                </div>
              ) : null}
              {canReviewApprovals ? (
                <Link
                  to="/approvals"
                  className="group mt-1 flex w-full max-w-[420px] items-center justify-between rounded-[1.2rem] border border-slate-200/80 bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_16px_30px_rgba(59,130,246,0.1)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[18px]">approval_delegation</span>
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">Pending Approvals</p>
                      <p className="text-xl font-extrabold leading-none text-on-surface">
                        {pendingApprovalsCount} Request{pendingApprovalsCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">View Full List</p>
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-outline-variant/20 bg-surface p-4 text-center text-sm text-on-surface-variant">
              No quick actions are available for your role yet.
            </div>
          )}
        </section>

        <div className="hidden">
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {cardsForRole.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 p-6 text-sm text-on-surface-variant">
              No KPI widgets are configured for your role. Contact an administrator if this is unexpected.
            </div>
          ) : null}
          {cardsForRole.map((card) =>
            card.variant === "badge" ? (
              <div key={card.key} className="bg-surface-container-lowest p-3 rounded-xl shadow-sm shadow-on-surface/5 flex flex-col gap-2 min-h-[116px]">
                <div className="flex justify-between items-start">
                  <div className={`w-8 h-8 rounded-full ${card.iconBg} flex items-center justify-center ${card.iconClass}`}>
                    <span className="material-symbols-outlined">{card.icon}</span>
                  </div>
                  <span className="bg-tertiary text-on-tertiary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {card.badge}
                  </span>
                </div>
                <div>
                  <span className={`text-2xl font-extrabold tracking-tight headline ${card.valueClass ?? ""}`}>{card.value}</span>
                  <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mt-1">{card.label}</p>
                </div>
              </div>
            ) : (
              <div key={card.key} className="bg-surface-container-lowest p-3 rounded-xl shadow-sm shadow-on-surface/5 flex flex-col gap-2 min-h-[116px]">
                <div className={`w-8 h-8 rounded-full ${card.iconBg} flex items-center justify-center ${card.iconClass}`}>
                  <span className="material-symbols-outlined">{card.icon}</span>
                </div>
                <div>
                  <span className={`text-2xl font-extrabold tracking-tight headline ${card.valueClass ?? ""}`}>{card.value}</span>
                  <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mt-1">{card.label}</p>
                </div>
              </div>
            )
          )}
        </section>

        {canSeeExpeditedSection(role) && expeditedForRole.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight text-on-surface-variant uppercase font-headline">Expedited Operations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <section className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight text-on-surface-variant uppercase font-headline">Management &amp; Control</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
              {velocityBars.map((bar, i) => (
                <div
                  key={i}
                  className={`flex-grow h-[200px] bg-primary/10 rounded-t-xl relative ${i === 0 ? "group" : ""}`}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 bg-primary rounded-t-xl transition-all"
                    style={{ height: `${Math.max(4, bar.pct ?? 0)}%` }}
                  />
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
                <span className="text-3xl font-extrabold tracking-tighter headline">
                  {stockShare.totalUnits > 0 ? stockShare.totalUnits.toLocaleString() : "—"}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Units (top locations)</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full bg-primary shrink-0" />
                  <span className="truncate">{stockShare.primaryLabel}</span>
                </div>
                <span className="text-on-surface-variant shrink-0">{stockShare.primaryPct}%</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full bg-secondary shrink-0" />
                  <span className="truncate">{stockShare.secondaryLabel}</span>
                </div>
                <span className="text-on-surface-variant shrink-0">{stockShare.secondaryPct}%</span>
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
                  {liveLedgerLogs.length > 0 ? liveLedgerLogs.map((log) => (
                    <tr key={log.id} className="group hover:bg-surface transition-colors">
                      <td className="py-5">
                        <div className="flex items-center gap-3">
                          <UserAvatarOrIcon src={log.avatar_url} alt={log.user} size="sm" />
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
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-sm text-on-surface-variant">
                        No ledger entries found in your organization yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}
          {canSeeActiveAlerts(role) && (
          <div className="bg-surface-container-low rounded-3xl p-8 flex flex-col gap-6">
            <h2 className="text-2xl font-extrabold tracking-tight font-headline">Active Alerts</h2>
            <div className="space-y-4">
              {lowStockAlert ? (
                <div className="bg-surface-container-lowest p-5 rounded-2xl border-l-4 border-tertiary shadow-sm">
                  <div className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-tertiary">priority_high</span>
                    <div>
                      <h4 className="text-sm font-bold mb-1">Low stock: {lowStockAlert.name}</h4>
                      <p className="text-xs text-on-surface-variant">
                        Current: {lowStockAlert.current} units · Reorder at {lowStockAlert.reorder} units (threshold ≤20 in this view).
                      </p>
                      {canActOnProcurementAlerts(role) ? (
                        <Link
                          to="/purchase-orders"
                          className="mt-3 inline-block text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary-container"
                        >
                          Open purchase orders
                        </Link>
                      ) : (
                        <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                          Contact procurement to reorder
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 text-sm text-on-surface-variant">
                  No low-stock rows matched (current_stock ≤ 20). Add inventory or adjust reorder levels in Supabase.
                </div>
              )}
            </div>
          </div>
          )}
        </div>
        )}
        </div>

      </main>
    </div>
  );
}
