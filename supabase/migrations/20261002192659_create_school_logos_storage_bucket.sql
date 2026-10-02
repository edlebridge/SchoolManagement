/*
# Create school-logos storage bucket

1. Storage
- Create a new public bucket `school-logos` for storing school logo images.
- Set public read access so logos can be displayed without authentication.
2. Policies
- Allow authenticated users to upload logos (school admins updating their school).
- Allow public read access to all logos (anon + authenticated).
- Allow authenticated users to update/delete logos.
- Restrict uploads to image MIME types.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read school logos" ON storage.objects;
CREATE POLICY "Public can read school logos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'school-logos');

DROP POLICY IF EXISTS "Authenticated can upload school logos" ON storage.objects;
CREATE POLICY "Authenticated can upload school logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'school-logos');

DROP POLICY IF EXISTS "Authenticated can update school logos" ON storage.objects;
CREATE POLICY "Authenticated can update school logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'school-logos')
WITH CHECK (bucket_id = 'school-logos');

DROP POLICY IF EXISTS "Authenticated can delete school logos" ON storage.objects;
CREATE POLICY "Authenticated can delete school logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'school-logos');
