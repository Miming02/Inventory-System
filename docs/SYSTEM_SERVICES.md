# System services: logging, files, notifications (0.7.x)

This document aligns your template **0.7** with what exists **today** and what is **planned**.

## 0.7.1 Logging and audit

| Field | Status |
|-------|--------|
| **Action / user / timestamp / module** | **Database:** `audit_logs` stores `action` (TG_OP), `user_id`, `created_at`, `table_name`, `record_id`, optional JSON snapshots. Triggers on `profiles`, `inventory_items`, `purchase_orders` (see migration). |
| **Application logs** | Not centralized to a third-party service in-repo. |
| **Admin audit UI** | **Implemented:** `frontend/src/pages/admin/AuditLogs.jsx` at `/audit-logs` (Admin). |

**Database:** Run `backend/supabase/migrations/002_audit_logs_rls.sql` in Supabase so `audit_trigger` stays `SECURITY DEFINER` and only Admins can `SELECT` from `audit_logs`.

---

## 0.7.2 Files and attachments

| Field | Status |
|-------|--------|
| **Upload UI** | Receive **Batch upload** modal: CSV/Excel + supporting doc file inputs. |
| **Backend storage** | `frontend/src/lib/storageUpload.js` → bucket **`attachments`**. Run migration **`004_storage_attachments.sql`** in Supabase. |
| **Validation** | Client: max 5 MB, MIME allow-list in `storageUpload.js`; server: bucket `allowed_mime_types` + RLS on `storage.objects`. |

**Paths:** `{user_id}/{kind}/{timestamp}-{filename}` under the private bucket.

---

## 0.7.3 Notifications

| Field | Status |
|-------|--------|
| **Schema** | `notifications` table + RLS + RPC **`create_notification`** — migration **`003_notifications_rls.sql`**. |
| **UI** | `frontend/src/components/NotificationBell.jsx` on dashboard header: list, unread badge, mark read. |
| **Creating rows** | Call `supabase.rpc('create_notification', { p_user_id, p_title, p_message, p_type, p_action_url })` — self or **Admin** for any user. |
| **Delivery** | In-app; optional Realtime: enable replication for `notifications` in Supabase. |

**Test from SQL Editor:** Walang JWT doon, kaya **`auth.uid()` ay NULL`**. Dalawang paraan:

1. **Pagkatapos mag-run ng `005_create_notification_allow_sql_editor.sql`** (o updated `003`), gamitin ang **totoong user id** (mula Authentication → Users o query sa `auth.users`):

   ```sql
   SELECT public.create_notification(
     'DITO-ILAGAY-ANG-UUID-NG-USER'::uuid,
     'Welcome',
     'Notifications are working.',
     'info',
     NULL
   );
   ```

2. **O direktang INSERT** (postgres role, bypass RLS):

   ```sql
   INSERT INTO public.notifications (user_id, title, message, type)
   VALUES (
     'DITO-ANG-USER-UUID'::uuid,
     'Welcome',
     'Notifications are working.',
     'info'
   );
   ```

Sa **app** (naka-login), `create_notification` gamit ang `auth.uid()` ay gumagana pa rin tulad dati.

**Kung sa SQL Editor ay `not authenticated` pa rin:** ang session minsan ay hindi `rolsuper`. I-run ang updated **`005_create_notification_allow_sql_editor.sql`** (may check sa `is_superuser` at `session_user IN ('postgres','supabase_admin')`). O gumamit ng direktang `INSERT` sa `notifications` bilang fallback.

---

## Revision

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-04-19 | Honest 0.7 status for compliance checklist. |
| 1.1 | 2026-04-19 | Notifications + storage implementation notes. |
