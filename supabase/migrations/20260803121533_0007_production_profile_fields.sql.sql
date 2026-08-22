/*
# Production Redesign: Profile Fields + Academic Year Management

## Changes

### 1. app_users — expanded profile fields
Add columns: address, gender, date_of_birth, nationality, national_id,
medical_history, qualification, department, employment_date, employment_status,
emergency_contact_name, emergency_contact_phone, id_card_url, certificates (jsonb).
These are all nullable so existing rows are unaffected.

### 2. students — expanded fields
Add columns: address, nationality, phone_number.

### 3. academic_years — archive support
Add column: archived (boolean, default false).

### 4. exam_marks — add position and remarks columns
Add: position (integer, nullable), remarks (text, nullable).

### Security
- No RLS policy changes needed — existing school-member policies cover new columns.
*/

-- app_users profile fields
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

-- students expanded fields
ALTER TABLE students ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_number text;

-- academic_years archive
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- exam_marks position and remarks
ALTER TABLE exam_marks ADD COLUMN IF NOT EXISTS position integer;
ALTER TABLE exam_marks ADD COLUMN IF NOT EXISTS remarks text;

-- Index for exam_marks by exam_id + class_id for position calculation
CREATE INDEX IF NOT EXISTS idx_exam_marks_exam_class ON exam_marks(exam_id, class_id);