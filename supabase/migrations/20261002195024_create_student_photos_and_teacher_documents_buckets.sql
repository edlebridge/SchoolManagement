/*
# Create student-photos and teacher-documents storage buckets

1. Storage
- Create public bucket `student-photos` for student profile pictures.
- Create public bucket `teacher-documents` for teacher ID cards and certificates.
2. Policies
- Public read access on both buckets.
- Authenticated users can upload/update/delete on both buckets.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('teacher-documents', 'teacher-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read student-photos" ON storage.objects;
CREATE POLICY "Public can read student-photos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "Authenticated can upload student-photos" ON storage.objects;
CREATE POLICY "Authenticated can upload student-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "Authenticated can update student-photos" ON storage.objects;
CREATE POLICY "Authenticated can update student-photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'student-photos')
WITH CHECK (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "Authenticated can delete student-photos" ON storage.objects;
CREATE POLICY "Authenticated can delete student-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "Public can read teacher-documents" ON storage.objects;
CREATE POLICY "Public can read teacher-documents"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'teacher-documents');

DROP POLICY IF EXISTS "Authenticated can upload teacher-documents" ON storage.objects;
CREATE POLICY "Authenticated can upload teacher-documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'teacher-documents');

DROP POLICY IF EXISTS "Authenticated can update teacher-documents" ON storage.objects;
CREATE POLICY "Authenticated can update teacher-documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'teacher-documents')
WITH CHECK (bucket_id = 'teacher-documents');

DROP POLICY IF EXISTS "Authenticated can delete teacher-documents" ON storage.objects;
CREATE POLICY "Authenticated can delete teacher-documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'teacher-documents');
