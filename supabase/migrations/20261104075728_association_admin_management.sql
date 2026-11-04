-- Atomic workspace creation and president handover for the trusted
-- administrator Edge Function. Neither function is callable by browser roles.
CREATE OR REPLACE FUNCTION public.admin_create_association(
  p_slug text,
  p_name text,
  p_introduction_fr text,
  p_introduction_en text,
  p_mission_fr text,
  p_mission_en text,
  p_public_email text,
  p_assigned_by uuid,
  p_president_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  created_association_id uuid;
BEGIN
  IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'This operation is restricted to the administration service.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.associations (
    slug, name, introduction_fr, introduction_en, mission_fr, mission_en,
    public_email
  )
  VALUES (
    p_slug, p_name, p_introduction_fr, p_introduction_en, p_mission_fr,
    p_mission_en, p_public_email
  )
  RETURNING id INTO created_association_id;

  INSERT INTO public.association_memberships (
    association_id, user_id, permission_role, status, assigned_by
  )
  VALUES (
    created_association_id, p_president_user_id, 'president', 'active',
    p_assigned_by
  );

  RETURN created_association_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_association_president(
  p_association_id uuid,
  p_president_user_id uuid,
  p_assigned_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'This operation is restricted to the administration service.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.association_memberships
  SET permission_role = 'member'
  WHERE association_id = p_association_id
    AND permission_role = 'president'
    AND status = 'active'
    AND user_id <> p_president_user_id;

  INSERT INTO public.association_memberships (
    association_id, user_id, permission_role, status, assigned_by
  )
  VALUES (
    p_association_id, p_president_user_id, 'president', 'active',
    p_assigned_by
  )
  ON CONFLICT (association_id, user_id) DO UPDATE
  SET permission_role = 'president',
      status = 'active',
      assigned_by = EXCLUDED.assigned_by;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_association(
  text, text, text, text, text, text, text, uuid, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_association_president(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_association(
  text, text, text, text, text, text, text, uuid, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_association_president(uuid, uuid, uuid)
  TO service_role;