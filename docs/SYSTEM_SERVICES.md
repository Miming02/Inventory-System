# System services: logging, files, notifications (0.7.x)

This document aligns your template **0.7** with what exists **today** and what is **planned**.

## 0.7.1 Logging and audit

| Field | Status |
|-------|--------|
| **Action / user / timestamp / module** | **Database:** `audit_logs` stores `action` (TG_OP), `user_id`, `created_at`, `table_name`, `record_id`, optional JSON snapshots. Triggers on `profiles`, `inventory_items`, `purchase_orders` (see migration). |
| **Application logs** | Not centralized to a third-party service in-repo. |
| **Admin audit UI** | **Not implemented** — future: read-only page querying `audit_logs` for Admin only (RLS policy required). |

**Acceptance gap to close later:** Admin screen or export for `audit_logs`; optional RLS policy for Admin read.

---

## 0.7.2 Files and attachments

| Field | Status |
|-------|--------|
| **Upload UI** | Present in several flows (e.g. batch / documentation copy in receive/deliver modals). |
| **Backend storage** | **Not wired** in `frontend/src` to `supabase.storage` yet. |
| **Validation** | When implemented: restrict MIME types and max size in client + **Supabase Storage policies** server-side. |

**Next steps:** Create a bucket (e.g. `attachments`), policies per role, then `supabase.storage.from(...).upload()` with metadata linking `record_id`.

---

## 0.7.3 Notifications

| Field | Status |
|-------|--------|
| **Schema** | `notifications` table exists (user_id, title, message, type, is_read, action_url). |
| **Triggers / delivery** | **Not fully implemented** — no universal “event → insert notification” layer in SQL or app yet. UI shows notification **icons** as chrome. |
| **Delivery methods** | In-app rows are the natural fit; email/SMS would use Edge Functions + provider. |

**Next steps:** Insert into `notifications` from key mutations (or Edge Function), add RLS for `SELECT` own rows, add bell dropdown fed by realtime or poll.

---

## Revision

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-04-19 | Honest 0.7 status for compliance checklist. |
