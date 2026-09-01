/*
# Add file attachments to announcements

1. Changes
   - Create a public storage bucket `announcement-attachments` for PDF, Word, image, etc.
   - Add RLS policies so authenticated users can upload/read/delete in this bucket.
   - Add `attachments` JSONB column to `announcements` table to store file metadata
     (array of { name, url, size, type }).

2. Security
   - Bucket is public for read; only authenticated users can write/delete.
   - RLS on announcements table is unchanged.

3. No data loss
   - The new column is nullable; existing rows are unaffected.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-attachments', 'announcement-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_upload_announcement_attachments" ON storage.objects;
CREATE POLICY "auth_upload_announcement_attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'announcement-attachments');

DROP POLICY IF EXISTS "auth_read_announcement_attachments" ON storage.objects;
CREATE POLICY "auth_read_announcement_attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'announcement-attachments');

DROP POLICY IF EXISTS "auth_delete_announcement_attachments" ON storage.objects;
CREATE POLICY "auth_delete_announcement_attachments" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'announcement-attachments');

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
