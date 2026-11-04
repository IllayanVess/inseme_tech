-- Atomically add an ordinary member and a private-by-default profile to the
-- requested association. The trusted Edge Function checks who may call this.
ALTER TABLE public.member_profiles
  ADD CONSTRAINT member_profiles_bio_bilingual CHECK (
    (bio_fr IS NULL AND bio_en IS NULL)
    OR (nullif(btrim(bio_fr), '') IS NOT NULL AND nullif(btrim(bio_en), '') IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.admin_add_association_member(
  p_association_id uuid,
  p_member_user_id uuid,
  p_assigned_by uuid,
  p_profile_slug text,
  p_display_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  created_membership_id uuid;
BEGIN
  IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'This operation is restricted to the membership service.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.association_memberships (
    association_id, user_id, permission_role, status, assigned_by
  )
  VALUES (
    p_association_id, p_member_user_id, 'member', 'active', p_assigned_by
  )
  ON CONFLICT (association_id, user_id) DO UPDATE
  SET permission_role = CASE
        WHEN public.association_memberships.permission_role = 'president' THEN 'president'
        ELSE 'member'
      END,
      status = 'active',
      assigned_by = EXCLUDED.assigned_by
  RETURNING id INTO created_membership_id;

  INSERT INTO public.member_profiles (
    association_id, membership_id, slug, display_name
  )
  VALUES (
    p_association_id, created_membership_id, p_profile_slug, p_display_name
  )
  ON CONFLICT (association_id, membership_id) DO NOTHING;

  RETURN created_membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_association_member(uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_association_member(uuid, uuid, uuid, text, text)
  TO service_role;