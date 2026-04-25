/** Canonical role names in DB / app */
export const CANONICAL_ROLES = [
  "Admin",
  "Warehouse Staff",
  "Production Staff",
  "Procurement Staff",
  "Management",
];

/**
 * Trim + map common typos / alternate labels so UI rules still apply.
 */
export function normalizeRole(role) {
  if (role == null || role === "") return null;
  const r = String(role).trim();
  if (!r) return null;
  const lower = r.toLowerCase();
  const aliases = {
    admin: "Admin",
    "warehouse staff": "Warehouse Staff",
    warehouse: "Warehouse Staff",
    "production staff": "Production Staff",
    production: "Production Staff",
    "production / kitchen staff": "Production Staff",
    "procurement staff": "Procurement Staff",
    procurement: "Procurement Staff",
    management: "Management",
  };
  if (aliases[lower]) return aliases[lower];
  const caseInsensitive = CANONICAL_ROLES.find((c) => c.toLowerCase() === lower);
  if (caseInsensitive) return caseInsensitive;
  if (CANONICAL_ROLES.includes(r)) return r;
  return r;
}

/**
 * Role-based access aligned with product roles:
 * - Admin: full system access, users, configuration, approvals
 * - Warehouse Staff: receiving, movement, deliver, counts, adjustments
 * - Production Staff: request/consume items, material usage (maps to DB name "Production Staff")
 * - Procurement Staff: suppliers, POs, incoming deliveries
 * - Management: reports/analytics, monitor stock and operations (read-focused)
 *
 * DB `roles.name` must match these strings (see `backend/supabase/migrations/001_inventory_setup.sql` seeds).
 */

/** @type {Record<string, string[]>} path -> roles allowed (Admin always allowed in canAccessPath) */
const PATH_ROLES = {
  "/inventory": [
    "Admin",
    "Warehouse Staff",
    "Production Staff",
    "Procurement Staff",
    "Management",
  ],
  "/receive": ["Admin", "Warehouse Staff", "Procurement Staff"],
  "/transfer": ["Admin", "Warehouse Staff", "Production Staff"],
  "/deliver": ["Admin", "Warehouse Staff", "Production Staff"],
  "/consume": ["Admin", "Production Staff", "Warehouse Staff"],
  "/count": ["Admin", "Warehouse Staff"],
  "/dispose": ["Admin", "Warehouse Staff"],
  "/purchase-orders": ["Admin", "Procurement Staff", "Management"],
  "/reports": ["Admin", "Procurement Staff", "Management"],
  "/manage-suppliers": ["Admin", "Procurement Staff"],
  "/manage-locations": ["Admin", "Warehouse Staff"],
  "/manage-bom": ["Admin", "Procurement Staff", "Production Staff"],
  "/bom": ["Admin", "Procurement Staff", "Production Staff"],
  "/users": ["Admin"],
  "/audit-logs": ["Admin"],
  "/approvals": ["Admin", "Management"],
  "/settings": ["Admin"],
  "/system-settings": ["Admin"],
};

/**
 * @param {string | null | undefined} role
 * @param {string} pathname
 */
export function canAccessPath(role, pathname) {
  const r = normalizeRole(role);
  const p = (pathname || "/").replace(/\/$/, "") || "/";
  if (p === "/") return true;
  if (!r) return false;
  if (r === "Admin") return true;

  for (const [prefix, roles] of Object.entries(PATH_ROLES)) {
    if (p === prefix || p.startsWith(`${prefix}/`)) {
      return roles.includes(r);
    }
  }
  return false;
}

/** Expedited ops strip: show block only if at least one action is allowed */
export function canSeeExpeditedSection(role) {
  const r = normalizeRole(role);
  if (!r) return false;
  if (r === "Admin") return true;
  if (r === "Management") return false;
  return ["Warehouse Staff", "Production Staff", "Procurement Staff"].includes(r);
}

export function canShowReportsCard(role) {
  const r = normalizeRole(role);
  return r === "Admin" || r === "Management";
}

export function canManageUsers(role) {
  return normalizeRole(role) === "Admin";
}

/** Short label for dashboard subtitle */
export function roleDashboardSubtitle(role) {
  const r = normalizeRole(role);
  const map = {
    Admin: "Full access — users, configuration, approvals",
    "Warehouse Staff": "Receiving, movement, deliver, counts & adjustments",
    "Production Staff": "Request & consume items, material usage",
    "Procurement Staff": "Suppliers, purchase orders, incoming deliveries",
    Management: "Reports & analytics, monitor stock and operations",
  };
  return (r && map[r]) ?? "Overview of inventory and operations";
}

/** KPI card keys on dashboard: total, low, recv, dispatch, hubs, pending */
export function overviewCardKeysForRole(role) {
  const all = ["total", "low", "recv", "dispatch", "hubs", "pending"];
  const r = normalizeRole(role);
  if (!r) return [];
  if (r === "Admin") return all;
  switch (r) {
    case "Warehouse Staff":
      return ["total", "low", "recv", "dispatch", "hubs"];
    case "Production Staff":
      return ["total", "low", "dispatch", "hubs"];
    case "Procurement Staff":
      return ["total", "low", "recv", "pending", "hubs"];
    case "Management":
      return ["total", "low", "recv", "dispatch", "hubs", "pending"];
    default:
      return [];
  }
}

export function canSeeOverviewCard(role, cardKey) {
  return overviewCardKeysForRole(role).includes(cardKey);
}

/** Analytics-style blocks */
export function canSeeMovementVelocity(role) {
  const r = normalizeRole(role);
  if (!r) return false;
  return ["Admin", "Warehouse Staff", "Production Staff", "Procurement Staff", "Management"].includes(r);
}

export function canSeeStockShare(role) {
  return canSeeMovementVelocity(role);
}

export function canSeeLedger(role) {
  const r = normalizeRole(role);
  if (!r) return false;
  return ["Admin", "Warehouse Staff", "Production Staff", "Procurement Staff", "Management"].includes(r);
}

export function canSeeActiveAlerts(role) {
  const r = normalizeRole(role);
  if (!r) return false;
  return ["Admin", "Warehouse Staff", "Production Staff", "Procurement Staff", "Management"].includes(r);
}

/** “Order now” style CTA in alerts — procurement / admin */
export function canActOnProcurementAlerts(role) {
  const r = normalizeRole(role);
  return r === "Admin" || r === "Procurement Staff";
}

export function canSeeRegionalHubs(role) {
  const r = normalizeRole(role);
  if (!r) return false;
  return ["Admin", "Warehouse Staff", "Procurement Staff", "Management"].includes(r);
}
