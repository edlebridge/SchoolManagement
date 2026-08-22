/*
# Storage bucket policies for photo and document uploads

## Security
- Allow authenticated users to upload/read/delete in student-photos, profile-photos, teacher-documents buckets
- All buckets are public (read access via public URL)
*/

-- student-photos bucket policies
DROP POLICY IF EXISTS "auth_upload_student_photos" ON storage.objects;
CREATE POLICY "auth_upload_student_photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "auth_read_student_photos" ON storage.objects;
CREATE POLICY "auth_read_student_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "auth_update_student_photos" ON storage.objects;
CREATE POLICY "auth_update_student_photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'student-photos') WITH CHECK (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "auth_delete_student_photos" ON storage.objects;
CREATE POLICY "auth_delete_student_photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'student-photos');

-- profile-photos bucket policies
DROP POLICY IF EXISTS "auth_upload_profile_photos" ON storage.objects;
CREATE POLICY "auth_upload_profile_photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "auth_read_profile_photos" ON storage.objects;
CREATE POLICY "auth_read_profile_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "auth_update_profile_photos" ON storage.objects;
CREATE POLICY "auth_update_profile_photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'profile-photos') WITH CHECK (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "auth_delete_profile_photos" ON storage.objects;
CREATE POLICY "auth_delete_profile_photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'profile-photos');

-- teacher-documents bucket policies
DROP POLICY IF EXISTS "auth_upload_teacher_docs" ON storage.objects;
CREATE POLICY "auth_upload_teacher_docs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'teacher-documents');

DROP POLICY IF EXISTS "auth_read_teacher_docs" ON storage.objects;
CREATE POLICY "auth_read_teacher_docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'teacher-documents');

DROP POLICY IF EXISTS "auth_delete_teacher_docs" ON storage.objects;
CREATE POLICY "auth_delete_teacher_docs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'teacher-documents');
