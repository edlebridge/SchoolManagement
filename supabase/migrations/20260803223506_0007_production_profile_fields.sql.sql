/*
# Production Redesign: Profile Fields + Academic Year Management

## Changes
1. app_users — expanded profile fields (address, gender, dob, nationality, national_id, medical_history, qualification, department, employment fields, emergency contacts, id_card_url, certificates)
2. students — expanded fields (address, nationality, phone_number)
3. academic_years — archive support (archived boolean)
4. exam_marks — position and remarks columns
*/

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS national_id text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS medical_history text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS qualification text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS employment_date date;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS employment_status text DEFAULT 'active';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS id_card_url text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS certificates jsonb DEFAULT '[]'::jsonb;

ALTER TABLE students ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_number text;

ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

ALTER TABLE exam_marks ADD COLUMN IF NOT EXISTS position integer;
ALTER TABLE exam_marks ADD COLUMN IF NOT EXISTS remarks text;

CREATE INDEX IF NOT EXISTS idx_exam_marks_exam_class ON exam_marks(exam_id, class_id);