/*
# Create platform_settings table for super admin control panel

1. New Tables
- platform_settings (singleton row with default plan, trial days, currency, etc.)
2. Security
- Only super_admin can SELECT, INSERT, UPDATE. No DELETE.
*/

CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_plan text NOT NULL DEFAULT 'starter',
  default_trial_days integer NOT NULL DEFAULT 14,
  default_currency text NOT NULL DEFAULT 'USD',
  default_student_limit integer NOT NULL DEFAULT 500,
  platform_fee_pct numeric NOT NULL DEFAULT 0,
  maintenance_mode boolean NOT NULL DEFAULT false,
  contact_email text,
  support_phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_select_super_admin" ON platform_settings;
CREATE POLICY "platform_settings_select_super_admin"
ON platform_settings FOR SELECT
TO authenticated
USING (is_super_admin());

DROP POLICY IF EXISTS "platform_settings_insert_super_admin" ON platform_settings;
CREATE POLICY "platform_settings_insert_super_admin"
ON platform_settings FOR INSERT
TO authenticated
WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "platform_settings_update_super_admin" ON platform_settings;
CREATE POLICY "platform_settings_update_super_admin"
ON platform_settings FOR UPDATE
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

INSERT INTO platform_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM platform_settings);