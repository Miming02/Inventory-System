# System requirements (BRD)

**Document ID:** BRD-INV-001  
**System name:** The Fluid Curator Inventory System (working title; same product as `database-schema.md` header)  
**Version:** 1.0  
**Scope:** Web application for inventory, procurement, warehouse operations, and role-based administration backed by Supabase (PostgreSQL).  
**Authoritative implementation references:** `frontend/src/App.jsx`, `frontend/src/lib/roleAccess.js`, `backend/supabase/migrations/001_inventory_setup.sql`, `supabase/functions/invite-user/index.ts`, `database-schema.md` (logical model; physical auth uses `auth.users` + `public.profiles` per migration notes).  
**Process index:** [docs/README.md](./README.md) · [Checklist 0.1–0.7 ↔ repo](./CHECKLIST_COMPLIANCE.md)

---

## 1. Purpose

Define business requirements, modular scope, role capabilities, business rules, and acceptance criteria so design, development, and testing stay aligned. Stakeholder approval is recorded in section 8.

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
| BR-14 | **Tenancy:** Current product scope is **single-organization** (no `tenant_id` in schema). If multi-tenant behavior is required later, it becomes a separate BRD revision. |

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
| AC-07 | Stakeholder sign-off recorded in section 8. | Signed rows present. |

---

## 7. User flow (requirements lifecycle)

1. Gather and refine requirements with stakeholders.  
2. Map requirements to modules and routes.  
3. Confirm roles and RLS alignment.  
4. Freeze BRD version for a release.  
5. Obtain sign-off (section 8).  
6. Implement and test against AC-01–AC-06.  

---

## 8. Stakeholder approval

Ang seksyong ito ay **opisyal na tala ng apruba** sa BRD na ito. Hindi ito awtomatikong pupunan ng tool — **ikaw / ang team** ang maglalagay ng totoong pangalan, petsa, at paraan ng pirma ayon sa polisiya ng organisasyon (HR, PMO, o quality).

### 8.1 Paano punan (hakbang)

1. **Tukuyin sino ang stakeholders** na kailangang umaprubahan ng requirements (hal. Product Owner, Operations lead, IT/Tech lead). Baguhin ang mga titulo sa talahanayan kung iba ang istruktura ninyo (hal. “Department Manager”, “CFO”).
2. **Ipadala ang BRD** (PDF export mula sa Markdown, o link sa repo/docs) para mabasa. Puwedeng meeting + “approved as read”.
3. **Punan ang bawat hilera:**
   - **Name** — buong pangalan ng taong humahawak ng desisyon (o initials kung pinapayagan ng kompanya).
   - **Role / title** — opisyal na posisyon.
   - **Decision** — halimbawa: `Approved`, `Approved with comments`, o `Rejected` (kung rejected, magdagdag ng notes sa ibaba o appendix).
   - **Date** — petsa ng desisyon, formatong `YYYY-MM-DD` (hal. `2026-04-20`).
   - **Signature** — **wet signature** (scan), **digital** (DocuSign / Adobe Sign), o tekstuwal na sanggunian gaya ng: `Email approval 2026-04-20 — see Appendix A` o ticket URL.
4. **Magdagdag ng hilera** kung mas marami ang kailangan (Legal, Finance, atbp.).
5. Kung **electronic approval** lang (Slack/email), maglagay ng **Appendix** (seksyon sa dulo ng file o hiwalay na PDF) na may buod ng mensahe + petsa + link.

### 8.2 English (how to complete)

1. Identify who must approve this BRD for your organization.  
2. Share the document (export or repo link) and record their decision.  
3. Fill **Name**, **Role / title**, **Decision**, **Date** (`YYYY-MM-DD`), and **Signature** (ink scan, e-sign reference, or “see Appendix / ticket #…”).  
4. Add rows or appendices as your process requires.

### 8.3 Talahanayan (punanin)

| Name | Role / title | Decision | Date | Signature |
|------|----------------|----------|------|-----------|
| *[Pangalan]* | Product owner | Approved / comments | YYYY-MM-DD | |
| *[Pangalan]* | Operations lead | Approved / comments | YYYY-MM-DD | |
| *[Pangalan]* | Technical lead | Approved / comments | YYYY-MM-DD | |

_I-delete ang `*[Pangalan]*` placeholder kapag may tunay nang entry. Electronic approval (ticket / PDF) ay maaaring ilagay sa appendix._

---

## 9. Revision history

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | 2026-04-19 | Initial BRD aligned with repository implementation. |
