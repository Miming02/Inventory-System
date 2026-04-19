-- Private bucket for user uploads. Paths: {auth.uid()}/{kind}/{filename}
-- Run in Supabase SQL Editor after project has Storage enabled.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  5242880,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "attachments_select_own" ON storage.objects;
DROP POLICY IF EXISTS "attachments_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "attachments_update_own" ON storage.objects;
DROP POLICY IF EXISTS "attachments_delete_own" ON storage.objects;

CREATE POLICY "attachments_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "attachments_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "attachments_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "attachments_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
