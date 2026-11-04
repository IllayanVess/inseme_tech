-- Association workspaces and member-facing data.
-- Permission roles are stored only on memberships; public position titles do
-- not grant database access.

-- Keep authorization helpers in a schema omitted from the Data API's exposed
-- schema list. The browser can invoke only the specific helpers granted below.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- One row is one tenant/workspace. Public contact columns are intended for the
-- association page; private contacts and submissions belong in separate tables.
CREATE TABLE public.associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^([a-z0-9]+-)*[a-z0-9]+$'),
  name text NOT NULL CHECK (nullif(btrim(name), '') IS NOT NULL),
  introduction_fr text,
  introduction_en text,
  mission_fr text,
  mission_en text,
  logo_path text,
  logo_alt_fr text,
  logo_alt_en text,
  cover_path text,
  cover_alt_fr text,
  cover_alt_en text,
  theme_accent text NOT NULL DEFAULT 'indigo'
    CHECK (theme_accent IN ('indigo', 'cyan', 'violet', 'blue')),
  public_email text,
  public_phone text,
  website_url text CHECK (website_url IS NULL OR website_url ~ '^https://'),
  visibility text NOT NULL DEFAULT 'draft'
    CHECK (visibility IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT associations_bilingual_when_published CHECK (
    visibility <> 'published'
    OR (
      nullif(btrim(name), '') IS NOT NULL
      AND nullif(btrim(introduction_fr), '') IS NOT NULL
      AND nullif(btrim(introduction_en), '') IS NOT NULL
      AND published_at IS NOT NULL
    )
  ),
  CONSTRAINT associations_logo_alt_required CHECK (
    logo_path IS NULL OR (
      nullif(btrim(logo_alt_fr), '') IS NOT NULL
      AND nullif(btrim(logo_alt_en), '') IS NOT NULL
    )
  ),
  CONSTRAINT associations_cover_alt_required CHECK (
    cover_path IS NULL OR (
      nullif(btrim(cover_alt_fr), '') IS NOT NULL
      AND nullif(btrim(cover_alt_en), '') IS NOT NULL
    )
  )
);

-- Page content is structured JSON for known section types, not HTML or scripts.
-- The composite key supports same-association foreign keys from child tables.
CREATE TABLE public.association_page_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE RESTRICT,
  section_type text NOT NULL CHECK (section_type IN (
    'hero', 'about', 'mission', 'activities', 'projects', 'contact', 'custom'
  )),
  section_key text NOT NULL CHECK (nullif(btrim(section_key), '') IS NOT NULL),
  content_fr jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content_fr) = 'object'),
  content_en jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content_en) = 'object'),
  display_order integer NOT NULL DEFAULT 0,
  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (association_id, id),
  UNIQUE (association_id, section_key),
  CONSTRAINT association_sections_bilingual_when_published CHECK (
    publication_status <> 'published'
    OR (content_fr <> '{}'::jsonb AND content_en <> '{}'::jsonb AND published_at IS NOT NULL)
  )
);
-- Public page reads filter by association and then sort by display_order.
CREATE INDEX association_page_sections_public_idx
  ON public.association_page_sections (association_id, display_order)
  WHERE publication_status = 'published';

-- Store links as validated HTTPS URLs and render labels as text in the UI.
CREATE TABLE public.association_social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE RESTRICT,
  platform text NOT NULL CHECK (platform IN (
    'website', 'instagram', 'linkedin', 'youtube', 'tiktok', 'facebook', 'x', 'other'
  )),
  url text NOT NULL CHECK (url ~ '^https://'),
  label_fr text,
  label_en text,
  display_order integer NOT NULL DEFAULT 0,
  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (association_id, id),
  CHECK (
    (label_fr IS NULL AND label_en IS NULL)
    OR (nullif(btrim(label_fr), '') IS NOT NULL AND nullif(btrim(label_en), '') IS NOT NULL)
  )
);
CREATE INDEX association_social_links_public_idx
  ON public.association_social_links (association_id, display_order)
  WHERE publication_status = 'published';

-- An account can have one membership per association. Role is an authorization
-- permission; only the trusted platform administrator may elevate it.
CREATE TABLE public.association_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  permission_role text NOT NULL DEFAULT 'member'
    CHECK (permission_role IN ('president', 'member')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'ended')),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (association_id, user_id),
  UNIQUE (association_id, id)
);
-- Support workspace lookup by user, and cap each association at one active
-- president. Suspended/ended rows remain available for history and handover.
CREATE INDEX association_memberships_user_idx ON public.association_memberships (user_id, association_id);
CREATE INDEX association_memberships_active_lookup_idx
  ON public.association_memberships (user_id, association_id, permission_role)
  WHERE status = 'active';
CREATE UNIQUE INDEX association_memberships_one_active_president_idx
  ON public.association_memberships (association_id)
  WHERE permission_role = 'president' AND status = 'active';

-- The composite membership FK prevents a profile from being attached to a
-- membership in another association. Public visibility always requires consent.
CREATE TABLE public.member_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  slug text NOT NULL CHECK (slug ~ '^([a-z0-9]+-)*[a-z0-9]+$'),
  display_name text NOT NULL CHECK (nullif(btrim(display_name), '') IS NOT NULL),
  bio_fr text,
  bio_en text,
  photo_path text,
  is_public boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (association_id, membership_id)
    REFERENCES public.association_memberships (association_id, id) ON DELETE RESTRICT,
  UNIQUE (association_id, id),
  UNIQUE (association_id, membership_id),
  UNIQUE (association_id, slug),
  CHECK (NOT is_public OR consented_at IS NOT NULL),
  CONSTRAINT member_profiles_bio_bilingual CHECK (
    (bio_fr IS NULL AND bio_en IS NULL)
    OR (nullif(btrim(bio_fr), '') IS NOT NULL AND nullif(btrim(bio_en), '') IS NOT NULL)
  )
);
CREATE INDEX member_profiles_public_idx
  ON public.member_profiles (association_id, slug)
  WHERE is_public;

-- Member links inherit ownership from the public profile and have their own
-- visibility flag so a member can keep individual links private.
CREATE TABLE public.member_social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL,
  member_profile_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN (
    'website', 'github', 'gitlab', 'linkedin', 'instagram', 'youtube', 'other'
  )),
  url text NOT NULL CHECK (url ~ '^https://'),
  label_fr text,
  label_en text,
  display_order integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (association_id, member_profile_id)
    REFERENCES public.member_profiles (association_id, id) ON DELETE RESTRICT,
  UNIQUE (association_id, id),
  CHECK (NOT is_public OR consented_at IS NOT NULL),
  CHECK (
    (label_fr IS NULL AND label_en IS NULL)
    OR (nullif(btrim(label_fr), '') IS NOT NULL AND nullif(btrim(label_en), '') IS NOT NULL)
  )
);
CREATE INDEX member_social_links_profile_idx
  ON public.member_social_links (association_id, member_profile_id, display_order);

-- These are display-only titles (for example Vice-President or Treasurer).
-- They never grant president permissions; those live on memberships.
CREATE TABLE public.association_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE RESTRICT,
  slug text NOT NULL CHECK (slug ~ '^([a-z0-9]+-)*[a-z0-9]+$'),
  title_fr text NOT NULL CHECK (nullif(btrim(title_fr), '') IS NOT NULL),
  title_en text NOT NULL CHECK (nullif(btrim(title_en), '') IS NOT NULL),
  responsibility_fr text,
  responsibility_en text,
  tasks_fr text,
  tasks_en text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (association_id, id),
  UNIQUE (association_id, slug),
  CHECK (
    (responsibility_fr IS NULL AND responsibility_en IS NULL)
    OR (nullif(btrim(responsibility_fr), '') IS NOT NULL
      AND nullif(btrim(responsibility_en), '') IS NOT NULL)
  ),
  CHECK (
    (tasks_fr IS NULL AND tasks_en IS NULL)
    OR (nullif(btrim(tasks_fr), '') IS NOT NULL AND nullif(btrim(tasks_en), '') IS NOT NULL)
  )
);
CREATE INDEX association_positions_order_idx
  ON public.association_positions (association_id, display_order)
  WHERE is_active;

-- Composite foreign keys ensure both the member profile and position belong to
-- this same association. Multiple historical assignments are allowed.
CREATE TABLE public.member_position_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL,
  member_profile_id uuid NOT NULL,
  position_id uuid NOT NULL,
  starts_at date,
  ends_at date,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (association_id, member_profile_id)
    REFERENCES public.member_profiles (association_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (association_id, position_id)
    REFERENCES public.association_positions (association_id, id) ON DELETE RESTRICT,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at),
  UNIQUE (association_id, id)
);
CREATE UNIQUE INDEX member_position_assignments_current_idx
  ON public.member_position_assignments (association_id, member_profile_id, position_id)
  WHERE ends_at IS NULL;
CREATE INDEX member_position_assignments_profile_idx
  ON public.member_position_assignments (association_id, member_profile_id, display_order);

-- RLS policies need to inspect membership rows, including while enforcing RLS
-- on the membership table itself. These narrow SECURITY DEFINER lookups avoid
-- policy recursion; fixed search_path and qualified names prevent name shadowing.
CREATE FUNCTION private.has_association_role(p_association_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.association_memberships AS membership
    WHERE membership.association_id = p_association_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'
      AND membership.permission_role = ANY (p_roles)
  );
$$;

-- A member can read their own membership even after it has ended, to preserve
-- account history; this helper is separate from active authorization checks.
CREATE FUNCTION private.owns_membership(p_membership_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.association_memberships AS membership
    WHERE membership.id = p_membership_id
      AND membership.user_id = auth.uid()
  );
$$;

-- Writes to a member's profile or links require an active membership.
CREATE FUNCTION private.owns_active_membership(p_membership_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.association_memberships AS membership
    WHERE membership.id = p_membership_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'
  );
$$;

-- Return true only for a consented, active profile in a published workspace.
-- This allows anonymous public-profile reads without exposing membership rows.
CREATE FUNCTION private.is_public_member_profile(p_association_id uuid, p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (auth.uid() IS NOT NULL OR auth.role() = 'anon') AND EXISTS (
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

-- Match the existing trusted Auth claim used by account administration.
CREATE FUNCTION private.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

CREATE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Run after a membership status update so offboarding is reflected immediately.
CREATE FUNCTION private.handle_membership_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Ended members lose public visibility and active display-position links;
  -- profile data itself remains for private history.
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

-- Presidents may edit profile details, but only the profile owner can change
-- the public-consent fields. A server-side consent workflow may also do so.
CREATE FUNCTION private.guard_member_profile_consent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  profile_owner uuid;
BEGIN
  IF (NEW.is_public IS DISTINCT FROM OLD.is_public
      OR NEW.consented_at IS DISTINCT FROM OLD.consented_at)
    AND auth.role() IS DISTINCT FROM 'service_role' THEN
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

-- Functions are not public RPC endpoints. Grant only the calls needed by RLS
-- and triggers; the service credential stays server-side.
REVOKE ALL ON FUNCTION private.has_association_role(uuid, text[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.owns_membership(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.owns_active_membership(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.is_public_member_profile(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.is_platform_admin() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.handle_membership_status_change() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.guard_member_profile_consent() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_association_role(uuid, text[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.owns_membership(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.owns_active_membership(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_public_member_profile(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_platform_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.set_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.handle_membership_status_change() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.guard_member_profile_consent() TO authenticated, service_role;

-- Keep updated_at consistent without requiring each browser caller to set it.
CREATE TRIGGER associations_set_updated_at BEFORE UPDATE ON public.associations
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER association_page_sections_set_updated_at BEFORE UPDATE ON public.association_page_sections
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER association_social_links_set_updated_at BEFORE UPDATE ON public.association_social_links
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER association_memberships_set_updated_at BEFORE UPDATE ON public.association_memberships
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER association_memberships_status_change
  AFTER UPDATE OF status ON public.association_memberships
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION private.handle_membership_status_change();
CREATE TRIGGER member_profiles_set_updated_at BEFORE UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER member_profiles_guard_consent BEFORE UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_member_profile_consent();
CREATE TRIGGER member_social_links_set_updated_at BEFORE UPDATE ON public.member_social_links
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER association_positions_set_updated_at BEFORE UPDATE ON public.association_positions
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER member_position_assignments_set_updated_at BEFORE UPDATE ON public.member_position_assignments
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
