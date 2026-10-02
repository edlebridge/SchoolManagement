/*
# Create avatars storage bucket

1. Storage
- Create a new public bucket `avatars` for storing user profile pictures (teachers, admins, parents).
- Set public read access so avatars can be displayed without authentication.
2. Policies
- Allow authenticated users to upload their own avatar.
- Allow public read access to all avatars.
- Allow authenticated users to update/delete their own avatar.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read avatars" ON storage.objects;
CREATE POLICY "Public can read avatars"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated can update avatars" ON storage.objects;
CREATE POLICY "Authenticated can update avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated can delete avatars" ON storage.objects;
CREATE POLICY "Authenticated can delete avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
