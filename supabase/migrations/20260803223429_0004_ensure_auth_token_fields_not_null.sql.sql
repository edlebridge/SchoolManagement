/*
# Ensure GoTrue token columns are never NULL

Fix: A BEFORE INSERT/UPDATE trigger that coerces NULLs to ''.
This protects every account creation path so "Database error querying schema" never recurs.
*/

CREATE OR REPLACE FUNCTION public.ensure_auth_token_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.confirmation_token := COALESCE(NEW.confirmation_token, '');
  NEW.recovery_token := COALESCE(NEW.recovery_token, '');
  NEW.email_change_token_new := COALESCE(NEW.email_change_token_new, '');
  NEW.email_change := COALESCE(NEW.email_change, '');
  NEW.phone_change := COALESCE(NEW.phone_change, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_users_token_defaults ON auth.users;

CREATE TRIGGER trg_auth_users_token_defaults
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_auth_token_defaults();

UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, '')
WHERE
  confirmation_token IS NULL
  OR recovery_token IS NULL
  OR email_change_token_new IS NULL
  OR email_change IS NULL
  OR phone_change IS NULL;