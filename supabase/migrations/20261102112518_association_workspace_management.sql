CREATE OR REPLACE FUNCTION private.is_public_member_profile(p_association_id uuid, p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (auth.uid() IS NOT NULL OR auth.jwt() ->> 'role' = 'anon') AND EXISTS (
    SELECT 1
    FROM public.member_profiles AS profile
    JOIN public.association_memberships AS membership
      ON membership.association_id = profile.association_id
     AND membership.id = profile.membership_id
    JOIN public.associations AS association ON association.id = profile.association_id
    WHERE profile.id = p_profile_id
      AND profile.association_id = p_association_id
      AND profile.is_public
      AND profile.consented_at IS NOT NULL
      AND profile.consented_at <= now()
      AND membership.status = 'active'
      AND association.visibility = 'published'
      AND association.published_at IS NOT NULL
      AND association.published_at <= now()
  );
$$;

CREATE OR REPLACE FUNCTION private.handle_membership_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'ended' AND OLD.status <> 'ended' THEN
    UPDATE public.member_profiles
    SET is_public = false, consented_at = NULL
    WHERE association_id = NEW.association_id AND membership_id = NEW.id;

    UPDATE public.member_social_links AS link
    SET is_public = false, consented_at = NULL
    WHERE link.association_id = NEW.association_id
      AND link.member_profile_id IN (
        SELECT profile.id FROM public.member_profiles AS profile
        WHERE profile.association_id = NEW.association_id
          AND profile.membership_id = NEW.id
      );

    DELETE FROM public.member_position_assignments
    WHERE association_id = NEW.association_id
      AND member_profile_id IN (
        SELECT profile.id FROM public.member_profiles AS profile
        WHERE profile.association_id = NEW.association_id
          AND profile.membership_id = NEW.id
      )
      AND ends_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_member_profile_consent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  profile_owner uuid;
BEGIN
  IF (NEW.is_public IS DISTINCT FROM OLD.is_public
      OR NEW.consented_at IS DISTINCT FROM OLD.consented_at)
    AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    SELECT membership.user_id INTO profile_owner
    FROM public.association_memberships AS membership
    WHERE membership.association_id = OLD.association_id
      AND membership.id = OLD.membership_id;

    IF profile_owner IS DISTINCT FROM auth.uid() AND current_user <> 'postgres' THEN
      RAISE EXCEPTION 'Only the profile owner may change publication consent.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE INSERT (association_id, user_id, permission_role, status),
  UPDATE (permission_role, status) ON public.association_memberships FROM authenticated;
GRANT INSERT (association_id, user_id, status),
  UPDATE (status) ON public.association_memberships TO authenticated;

DROP POLICY association_positions_read ON public.association_positions;
CREATE POLICY association_positions_read ON public.association_positions
  FOR SELECT TO anon, authenticated USING (
    is_active AND EXISTS (
      SELECT 1 FROM public.associations AS association
      WHERE association.id = association_id
        AND association.visibility = 'published'
        AND association.published_at IS NOT NULL
        AND association.published_at <= now()
    )
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );

DROP POLICY member_position_assignments_read ON public.member_position_assignments;
CREATE POLICY member_position_assignments_read ON public.member_position_assignments
  FOR SELECT TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM public.member_profiles AS profile
      JOIN public.associations AS association ON association.id = profile.association_id
      JOIN public.association_positions AS position
        ON position.association_id = member_position_assignments.association_id
          AND position.id = member_position_assignments.position_id
      WHERE profile.association_id = member_position_assignments.association_id
        AND profile.id = member_position_assignments.member_profile_id AND profile.is_public
        AND profile.consented_at IS NOT NULL AND profile.consented_at <= now()
        AND position.is_active
        AND (starts_at IS NULL OR starts_at <= current_date)
        AND (ends_at IS NULL OR ends_at >= current_date)
        AND association.visibility = 'published'
        AND association.published_at IS NOT NULL AND association.published_at <= now()
        AND private.is_public_member_profile(profile.association_id, profile.id)
    )
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'association-media',
  'association-media',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY association_media_read ON storage.objects
  FOR SELECT TO anon, authenticated USING (
    bucket_id = 'association-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.associations AS association
        WHERE association.visibility = 'published'
          AND association.published_at IS NOT NULL
          AND association.published_at <= now()
          AND (association.logo_path = name OR association.cover_path = name)
      )
      OR CASE
        WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN private.is_platform_admin()
          OR private.has_association_role(
            (storage.foldername(name))[1]::uuid,
            ARRAY['president']::text[]
          )
        ELSE false
      END
    )
  );
CREATE POLICY association_media_upload ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'association-media'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (
      private.is_platform_admin()
      OR private.has_association_role(
        (storage.foldername(name))[1]::uuid,
        ARRAY['president']::text[]
      )
    )
  );
CREATE POLICY association_media_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'association-media'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (
      private.is_platform_admin()
      OR private.has_association_role(
        (storage.foldername(name))[1]::uuid,
        ARRAY['president']::text[]
      )
    )
  )
  WITH CHECK (
    bucket_id = 'association-media'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (
      private.is_platform_admin()
      OR private.has_association_role(
        (storage.foldername(name))[1]::uuid,
        ARRAY['president']::text[]
      )
    )
  );
CREATE POLICY association_media_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'association-media'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (
      private.is_platform_admin()
      OR private.has_association_role(
        (storage.foldername(name))[1]::uuid,
        ARRAY['president']::text[]
      )
    )
  );

CREATE FUNCTION public.create_association_workspace(
  p_slug text,
  p_name text,
  p_introduction_fr text,
  p_introduction_en text,
  p_president_user_id uuid,
  p_assigned_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  new_association_id uuid;
BEGIN
  IF auth.jwt() ->> 'role' IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.associations (slug, name, introduction_fr, introduction_en)
  VALUES (
    lower(btrim(p_slug)),
    btrim(p_name),
    nullif(btrim(p_introduction_fr), ''),
    nullif(btrim(p_introduction_en), '')
  )
  RETURNING id INTO new_association_id;

  INSERT INTO public.association_memberships (
    association_id, user_id, permission_role, status, assigned_by
  )
  VALUES (new_association_id, p_president_user_id, 'president', 'active', p_assigned_by);

  RETURN new_association_id;
END;
$$;

CREATE FUNCTION public.set_association_president(
  p_association_id uuid,
  p_president_user_id uuid,
  p_assigned_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.jwt() ->> 'role' IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
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
  VALUES (p_association_id, p_president_user_id, 'president', 'active', p_assigned_by)
  ON CONFLICT (association_id, user_id) DO UPDATE
  SET permission_role = 'president',
      status = 'active',
      assigned_by = EXCLUDED.assigned_by;
END;
$$;

REVOKE ALL ON FUNCTION public.create_association_workspace(text, text, text, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_association_president(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_association_workspace(text, text, text, text, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.set_association_president(uuid, uuid, uuid)
  TO service_role;