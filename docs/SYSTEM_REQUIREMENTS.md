# System requirements (BRD)

**Document ID:** BRD-INV-001  
**System name:** The Fluid Curator Inventory System (working title; same product as `database-schema.md` header)  
**Version:** 1.0  
**Scope:** Web application for inventory, procurement, warehouse operations, and role-based administration backed by PostgreSQL with Supabase for auth and invites.  
**Authoritative implementation references:** `frontend/src/App.jsx`, `frontend/src/lib/roleAccess.js`, `backend/future/node-bff/src/server.js`, `supabase/functions/invite-user/index.ts`, `database-schema.md`.  
**Process index:** [docs/README.md](./README.md) · [Checklist 0.1–0.7 ↔ repo](./CHECKLIST_COMPLIANCE.md)

---

## 1. Purpose

Define business requirements, modular scope, role capabilities, business rules, and acceptance criteria so design, development, and testing stay aligned. Optional formal approvals are described in §8 (solo / academic baseline).

---

## 2. Modules and features

Modules are product-facing groupings. Features map to implemented or planned UI routes and data domains.

| Module | Purpose | Features (by route / capability) |
|--------|---------|-----------------------------------|
| **Authentication** | Secure access | Email + password login; session via Supabase Auth; logout; password handling by platform (not stored in app tables). |
| **Dashboard** | Operational overview | Home dashboard (`/`); role-specific KPIs and widgets per `roleAccess.js`. |
| **Inventory catalog** | Item master and stock visibility | List/view inventory (`/inventory`); SKU, quantities, catalog attributes (aligned with `inventory_items`). |
| **Receiving** | Inbound stock | Receive workflows (`/receive`); scan/manual/batch UI patterns. |
| **Transfer** | Internal movement | Transfer workflows (`/transfer`). |
| **Deliver / dispatch** | Outbound | Deliver workflows (`/deliver`). |
| **Cycle count** | Physical vs system stock | Count workflows (`/count`). |
| **Disposal** | Write-offs / disposals | Dispose workflows (`/dispose`). |
| **Purchase orders** | Procurement | PO list and management (`/purchase-orders`); supplier linkage in schema. |
| **User administration** | Accounts and roles | User management UI (`/users`); invite flow via Edge Function `invite-user` (Admin). |
| **Platform data & compliance** | Integrity and traceability | Row Level Security (RLS); `audit_logs` + triggers on key tables; `notifications` table (schema present; in-app delivery may be extended). |

---

## 3. User roles and permissions

Canonical role names **must** match database seeds (`roles.name`) and the UI normalizer in `frontend/src/lib/roleAccess.js`.

| Role | Intent | Route access (UI) | Notes |
|------|--------|-------------------|--------|
| **Admin** | Full configuration and user control | All routes including `/users` | Bypasses path restrictions in `canAccessPath`. |
| **Warehouse Staff** | Floor operations | `/inventory`, `/receive`, `/transfer`, `/deliver`, `/count`, `/dispose` | No `/purchase-orders` or `/users` by default path map. |
| **Production Staff** | Consume / request materials | `/inventory`, `/transfer`, `/deliver` | No receive/count/dispose/PO/users per path map. |
| **Procurement Staff** | Suppliers and POs | `/inventory`, `/receive`, `/purchase-orders` | Aligns with procurement + inbound. |
| **Management** | Oversight and reporting | `/inventory`, `/purchase-orders` | Read-focused; no warehouse write routes on path map. |

**Database enforcement:** RLS policies on `profiles`, `inventory_items`, `purchase_orders`, `stock_movements`, and `roles` use `public.current_role_name()` (see migration). UI guards **do not** replace RLS; they supplement UX.

**Permission dimensions (View / Create / Update / Delete):** Expressed indirectly via (1) route access above, (2) RLS `SELECT`/`INSERT`/`UPDATE` policies, and (3) `roles.permissions` JSONB seed strings for future fine-grained UI. Exact CRUD matrix per table is defined in migration policy names and checks.

---

## 4. Business rules

| ID | Rule |
|----|------|
| BR-01 | **Identity:** End-user identity is `auth.users.id`; application profile is `public.profiles.id` with same UUID (FK to `auth.users`). |
| BR-02 | **Authentication:** Only Supabase Auth validates passwords; no application-owned `password_hash` column in `profiles`. |
| BR-03 | **Authorization:** Every data access from the client must satisfy RLS for the authenticated JWT; Admin-only operations (e.g. invite user) must be enforced on the server (Edge Function checks Admin). |
| BR-04 | **Role assignment:** A profile has at most one `role_id` referencing `roles`; effective role name must be one of the five canonical roles. |
| BR-05 | **Inventory quantities:** `available_stock` is derived as `current_stock - reserved_stock` (generated column); clients must not contradict DB generation rules. |
| BR-06 | **Stock movements:** Inserting `stock_movements` triggers `update_inventory_stock()` for `in` / `out` movement types per migration trigger. |
| BR-07 | **Movement types:** `movement_type` ∈ `in`, `out`, `transfer`, `adjustment`; `reference_type` constrained to enumerated set in schema. |
| BR-08 | **Purchase orders:** `status` ∈ `draft`, `sent`, `confirmed`, `received`, `cancelled`; `priority` ∈ `low`, `medium`, `high`. |
| BR-09 | **Procurement PO updates:** Non-Admins with role Procurement Staff may update POs they created (RLS), unless policy is revised. |
| BR-10 | **Inventory writes:** Inserts/updates to `inventory_items` require role in (`Admin`, `Warehouse Staff`, `Procurement Staff`) per RLS. |
| BR-11 | **Stock movements write:** Inserts require `Admin` or `Warehouse Staff` per RLS. |
| BR-12 | **Audit:** Mutations on `profiles`, `inventory_items`, and `purchase_orders` write a row to `audit_logs` via `audit_trigger()` capturing operation, actor (`auth.uid()` when present), and row snapshots. |
| BR-13 | **Invite users:** `invite-user` Edge Function requires valid Bearer JWT and Admin role; body requires `email`, `fullName`, `roleId`. |
| BR-14 | **Tenancy:** Data is partitioned by **`public.organizations`** and **`profiles.organization_id`**. All tenant tables carry **`organization_id`**; RLS restricts reads/writes to `current_organization_id()`. New users default to the seeded **Default organization** unless **`organization_id`** is supplied in Auth metadata (e.g. Admin **invite-user**). Admins may create additional org rows via RPC **`create_organization(text)`** (then assign users in SQL/Studio until UI exists). |

---

## 5. Business rules — validation and restrictions

| ID | Validation / restriction |
|----|----------------------------|
| VR-01 | Login form requires non-empty email and password before calling Auth (`Login.jsx`). |
| VR-02 | Invite payload must include trimmed `email`, `fullName`, and `roleId` (Edge Function). |
| VR-03 | SKU on `inventory_items` is unique; enforce on create/update at database level. |
| VR-04 | Enum and check constraints on POs, movements, and adjustments per SQL DDL; invalid values rejected by PostgreSQL. |

---

## 6. Acceptance criteria (release-level)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-01 | Modules and features in section 2 trace to routes in `App.jsx` or documented schema tables. | Traceability matrix above. |
| AC-02 | Roles identified and consistent across DB seeds, RLS helper `current_role_name()`, and `PATH_ROLES`. | Code + migration review. |
| AC-03 | Business rules BR-01–BR-14 documented and conflicts flagged with implementation. | This document + migration. |
| AC-04 | Unauthorized users cannot access protected routes (unauthenticated redirect to `/login`). | Manual / e2e test. |
| AC-05 | Non-Admin cannot open `/users` (redirect per `RoleGuard`). | Manual / e2e test. |
| AC-06 | Non-Admin cannot invoke invite-user successfully (403 from function). | API test with non-Admin JWT. |
| AC-07 | Requirements baseline recorded for this release. | BRD version + revision history (§9); formal multi-stakeholder sign-off **N/A** for solo/academic build unless course requires it (see §8). |

---

## 7. User flow (requirements lifecycle)

1. Gather and refine requirements (self / advisor / client as applicable).  
2. Map requirements to modules and routes.  
3. Confirm roles and RLS alignment.  
4. Freeze BRD version for a release.  
5. Optional: external stakeholder sign-off — **skip for solo project** (see §8).  
6. Implement and test against AC-01–AC-06 (+ AC-07 as above).  

---

## 8. Approvals (solo / academic project)

**Multi-stakeholder sign-off is not required** for this baseline: the author maintains the BRD in Git, and `AC-07` is satisfied by versioned requirements in this file plus revision history.

If a course later requires named approvers, add a short table here or attach a PDF.

---

## 9. Revision history

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | 2026-04-19 | Initial BRD aligned with repository implementation. |
| 1.1 | 2026-04-19 | §8 simplified for solo build; AC-07 updated. |
