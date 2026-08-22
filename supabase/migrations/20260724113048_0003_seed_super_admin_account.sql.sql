/*
# Seed Super Admin Account

1. Purpose
   The Super Admin login (owner@edubridge.io) was failing with
   "Database error querying schema" because the auth user did not exist
   in auth.users and no matching app_users profile row existed.
   This migration creates the platform-owner account so the private
   /owner/login endpoint can authenticate.

2. Changes
   - Inserts an auth.users row for owner@edubridge.io with:
     * a bcrypt password hash for "EduBridge#2026"
     * email_confirmed_at set (email confirmation is OFF)
     * raw_app_meta_data = {"role":"super_admin"} so the JWT carries
       the role claim that public.is_super_admin() reads.
   - Inserts a matching public.app_users profile row with role
     'super_admin', school_id NULL (platform-wide), active TRUE.

3. Security
   - The app_users insert is done with the service role (this migration
     runs as superuser), bypassing RLS. The RLS SELECT policy
     "app_users_select_self_or_admin" already allows the super_admin
     to read their own profile via is_super_admin().
   - No RLS policy changes are needed.

4. Idempotency
   - Both inserts are guarded by NOT EXISTS checks so re-running is safe.
*/

-- =========================================================
-- 1. Create the auth user (owner@edubridge.io)
-- =========================================================
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'owner@edubridge.io',
  crypt('EduBridge#2026', gen_salt('bf', 10)),
  now(),
  '{"role":"super_admin"}'::jsonb,
  '{"full_name":"Platform Owner"}'::jsonb,
  false,
  false,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'owner@edubridge.io'
);

-- =========================================================
-- 2. Create the auth.identities row (required by GoTrue for password auth)
--    GoTrue expects a matching identity row with provider='email'.
--    Without it, signInWithPassword returns "Database error querying schema".
-- =========================================================
INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at,
  id
)
SELECT
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  now(),
  now(),
  now(),
  gen_random_uuid()
FROM auth.users u
WHERE u.email = 'owner@edubridge.io'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
  );

-- =========================================================
-- 3. Create the app_users profile row
-- =========================================================
INSERT INTO public.app_users (
  user_id,
  school_id,
  role,
  full_name,
  phone,
  avatar_url,
  active
)
SELECT
  u.id,
  NULL,
  'super_admin',
  'Platform Owner',
  NULL,
  NULL,
  TRUE
FROM auth.users u
WHERE u.email = 'owner@edubridge.io'
  AND NOT EXISTS (
    SELECT 1 FROM public.app_users au WHERE au.user_id = u.id
  );
