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
  cover_path text,
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
  UNIQUE (association_id, section_key)
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
  UNIQUE (association_id, id)
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
  CHECK (NOT is_public OR consented_at IS NOT NULL)
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (association_id, member_profile_id)
    REFERENCES public.member_profiles (association_id, id) ON DELETE RESTRICT,
  UNIQUE (association_id, id)
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
  UNIQUE (association_id, slug)
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


-- Tenant ownership for the existing content tables and event-specific data.
-- This is the declarative end state. Existing hosted rows need a staged
-- association backfill before association_id can be made NOT NULL remotely.
-- This file is named to load after content.sql, which first creates the legacy
-- events/projects/announcements tables in the configured schema_paths order.

-- Slugs are unique per tenant rather than globally. The (association_id, id)
-- keys also let child rows enforce that their parent belongs to the same tenant.
ALTER TABLE public.events
  ADD COLUMN association_id uuid NOT NULL
    REFERENCES public.associations(id) ON DELETE RESTRICT,
  DROP CONSTRAINT events_slug_key,
  ADD CONSTRAINT events_association_id_id_key UNIQUE (association_id, id),
  ADD CONSTRAINT events_association_slug_key UNIQUE (association_id, slug);

ALTER TABLE public.projects
  ADD COLUMN association_id uuid NOT NULL
    REFERENCES public.associations(id) ON DELETE RESTRICT,
  DROP CONSTRAINT projects_slug_key,
  ADD CONSTRAINT projects_association_id_id_key UNIQUE (association_id, id),
  ADD CONSTRAINT projects_association_slug_key UNIQUE (association_id, slug);

ALTER TABLE public.announcements
  ADD COLUMN association_id uuid NOT NULL
    REFERENCES public.associations(id) ON DELETE RESTRICT,
  DROP CONSTRAINT announcements_slug_key,
  ADD CONSTRAINT announcements_association_id_id_key UNIQUE (association_id, id),
  ADD CONSTRAINT announcements_association_slug_key UNIQUE (association_id, slug);

-- Match the association-page and global published-content query paths.
CREATE INDEX events_association_public_starts_at_idx
  ON public.events (association_id, starts_at)
  WHERE publication_status = 'published';
CREATE INDEX projects_association_published_idx
  ON public.projects (association_id, published_at DESC)
  WHERE publication_status = 'published';
CREATE INDEX announcements_association_published_idx
  ON public.announcements (association_id, published_at DESC)
  WHERE publication_status = 'published';

-- Only approved media attached to published events is publicly readable.
-- storage_path points to Supabase Storage; image bytes are not stored here.
CREATE TABLE public.event_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL,
  event_id uuid NOT NULL,
  storage_path text NOT NULL CHECK (nullif(btrim(storage_path), '') IS NOT NULL),
  media_kind text NOT NULL CHECK (media_kind IN ('cover', 'gallery')),
  display_order integer NOT NULL DEFAULT 0,
  caption_fr text,
  caption_en text,
  alt_text_fr text NOT NULL CHECK (nullif(btrim(alt_text_fr), '') IS NOT NULL),
  alt_text_en text NOT NULL CHECK (nullif(btrim(alt_text_en), '') IS NOT NULL),
  image_credit text,
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (association_id, event_id)
    REFERENCES public.events (association_id, id) ON DELETE RESTRICT,
  UNIQUE (association_id, id),
  UNIQUE (association_id, storage_path),
  CHECK ((approval_status = 'approved') = (approved_at IS NOT NULL))
);
CREATE INDEX event_media_event_order_idx
  ON public.event_media (association_id, event_id, display_order);

-- Links inherit visibility from the parent event and are stored as HTTPS data.
CREATE TABLE public.event_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL,
  event_id uuid NOT NULL,
  link_type text NOT NULL CHECK (link_type IN (
    'registration', 'venue', 'resource', 'social_post', 'other'
  )),
  label_fr text NOT NULL CHECK (nullif(btrim(label_fr), '') IS NOT NULL),
  label_en text NOT NULL CHECK (nullif(btrim(label_en), '') IS NOT NULL),
  url text NOT NULL CHECK (url ~ '^https://'),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (association_id, event_id)
    REFERENCES public.events (association_id, id) ON DELETE RESTRICT,
  UNIQUE (association_id, id)
);
CREATE INDEX event_links_event_order_idx
  ON public.event_links (association_id, event_id, display_order);

-- Store either a member profile or an external guest. Consent is explicit;
-- browser roles cannot write the consent columns directly.
CREATE TABLE public.event_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL,
  event_id uuid NOT NULL,
  member_profile_id uuid,
  external_display_name text,
  participation_role text NOT NULL CHECK (participation_role IN (
    'organizer', 'speaker', 'volunteer', 'attendee'
  )),
  consented_to_publication boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (association_id, event_id)
    REFERENCES public.events (association_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (association_id, member_profile_id)
    REFERENCES public.member_profiles (association_id, id) ON DELETE RESTRICT,
  UNIQUE (association_id, id),
  CHECK (
    (member_profile_id IS NOT NULL AND external_display_name IS NULL)
    OR (member_profile_id IS NULL AND nullif(btrim(external_display_name), '') IS NOT NULL)
  ),
  CHECK ((consented_to_publication) = (consented_at IS NOT NULL))
);
CREATE INDEX event_people_event_order_idx
  ON public.event_people (association_id, event_id, display_order);

-- Replace the old single-administrator policies with tenant-scoped president
-- access and the separate trusted platform-administrator permission.
DROP POLICY events_public_read_published ON public.events;
DROP POLICY events_authenticated_read ON public.events;
DROP POLICY events_admin_insert ON public.events;
DROP POLICY events_admin_update ON public.events;
DROP POLICY events_admin_delete ON public.events;
DROP POLICY projects_public_read_published ON public.projects;
DROP POLICY projects_authenticated_read ON public.projects;
DROP POLICY projects_admin_insert ON public.projects;
DROP POLICY projects_admin_update ON public.projects;
DROP POLICY projects_admin_delete ON public.projects;
DROP POLICY announcements_public_read_published ON public.announcements;
DROP POLICY announcements_authenticated_read ON public.announcements;
DROP POLICY announcements_admin_insert ON public.announcements;
DROP POLICY announcements_admin_update ON public.announcements;
DROP POLICY announcements_admin_delete ON public.announcements;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_position_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_people ENABLE ROW LEVEL SECURITY;

-- Public visitors see only published workspaces. Presidents see drafts for the
-- workspaces where they hold an active president membership.
CREATE POLICY associations_public_read ON public.associations
  FOR SELECT TO anon USING (
    visibility = 'published' AND published_at IS NOT NULL AND published_at <= now()
  );
CREATE POLICY associations_authenticated_read ON public.associations
  FOR SELECT TO authenticated USING (
    (visibility = 'published' AND published_at IS NOT NULL AND published_at <= now())
    OR private.is_platform_admin()
    OR private.has_association_role(id, ARRAY['president']::text[])
  );
CREATE POLICY associations_admin_insert ON public.associations
  FOR INSERT TO authenticated WITH CHECK (private.is_platform_admin());
CREATE POLICY associations_admin_or_president_update ON public.associations
  FOR UPDATE TO authenticated
  USING (private.is_platform_admin() OR private.has_association_role(id, ARRAY['president']::text[]))
  WITH CHECK (private.is_platform_admin() OR private.has_association_role(id, ARRAY['president']::text[]));
CREATE POLICY associations_admin_delete ON public.associations
  FOR DELETE TO authenticated USING (private.is_platform_admin());

CREATE POLICY association_sections_public_read ON public.association_page_sections
  FOR SELECT TO anon USING (
    publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now()
    AND EXISTS (
      SELECT 1 FROM public.associations AS association
      WHERE association.id = association_id
        AND association.visibility = 'published'
        AND association.published_at IS NOT NULL
        AND association.published_at <= now()
    )
  );
CREATE POLICY association_sections_authenticated_read ON public.association_page_sections
  FOR SELECT TO authenticated USING (
    (publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now())
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY association_sections_manage ON public.association_page_sections
  FOR ALL TO authenticated
  USING (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]))
  WITH CHECK (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]));

CREATE POLICY association_links_public_read ON public.association_social_links
  FOR SELECT TO anon USING (
    publication_status = 'published' AND EXISTS (
      SELECT 1 FROM public.associations AS association
      WHERE association.id = association_id
        AND association.visibility = 'published'
        AND association.published_at IS NOT NULL
        AND association.published_at <= now()
    )
  );
CREATE POLICY association_links_authenticated_read ON public.association_social_links
  FOR SELECT TO authenticated USING (
    (publication_status = 'published' AND EXISTS (
      SELECT 1 FROM public.associations AS association
      WHERE association.id = association_id
        AND association.visibility = 'published'
        AND association.published_at IS NOT NULL
        AND association.published_at <= now()
    ))
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY association_links_manage ON public.association_social_links
  FOR ALL TO authenticated
  USING (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]))
  WITH CHECK (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]));

-- Members see their own membership, presidents see only their workspace, and
-- platform admins can manage cross-association membership records.
CREATE POLICY memberships_read ON public.association_memberships
  FOR SELECT TO authenticated USING (
    user_id = (SELECT auth.uid()) OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY memberships_add ON public.association_memberships
  FOR INSERT TO authenticated WITH CHECK (
    private.is_platform_admin()
    OR (
      permission_role = 'member' AND status = 'active'
      AND private.has_association_role(association_id, ARRAY['president']::text[])
    )
  );
CREATE POLICY memberships_update ON public.association_memberships
  FOR UPDATE TO authenticated
  USING (
    private.is_platform_admin()
    OR (
      permission_role = 'member' AND user_id <> (SELECT auth.uid())
      AND private.has_association_role(association_id, ARRAY['president']::text[])
    )
  )
  WITH CHECK (
    private.is_platform_admin()
    OR (
      permission_role = 'member' AND user_id <> (SELECT auth.uid())
      AND private.has_association_role(association_id, ARRAY['president']::text[])
    )
  );

-- Consent is member-controlled. The consent guard trigger protects these
-- fields even when a president edits other profile details; ended memberships
-- are hidden.
CREATE POLICY member_profiles_public_read ON public.member_profiles
  FOR SELECT TO anon USING (private.is_public_member_profile(association_id, id));
CREATE POLICY member_profiles_authenticated_read ON public.member_profiles
  FOR SELECT TO authenticated USING (
    private.is_public_member_profile(association_id, id)
    OR private.owns_membership(membership_id)
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY member_profiles_president_insert ON public.member_profiles
  FOR INSERT TO authenticated WITH CHECK (
    NOT is_public AND consented_at IS NULL
    AND EXISTS (SELECT 1 FROM public.association_memberships AS membership
      WHERE membership.association_id = member_profiles.association_id
        AND membership.id = member_profiles.membership_id AND membership.status = 'active')
    AND (private.is_platform_admin()
      OR private.has_association_role(association_id, ARRAY['president']::text[]))
  );
CREATE POLICY member_profiles_owner_update ON public.member_profiles
  FOR UPDATE TO authenticated
  USING (private.owns_active_membership(membership_id))
  WITH CHECK (private.owns_active_membership(membership_id));
CREATE POLICY member_profiles_president_update ON public.member_profiles
  FOR UPDATE TO authenticated
  USING (private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[]))
  WITH CHECK (private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[]));
CREATE POLICY member_profiles_admin_or_president_delete ON public.member_profiles
  FOR DELETE TO authenticated USING (
    private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );

-- A social link is public only when both the link and its parent profile are
-- public and the profile owner has an active membership and current consent.
CREATE POLICY member_social_links_public_read ON public.member_social_links
  FOR SELECT TO anon USING (
    is_public AND EXISTS (
      SELECT 1 FROM public.member_profiles AS profile
      JOIN public.associations AS association ON association.id = profile.association_id
      WHERE profile.association_id = member_social_links.association_id
        AND profile.id = member_social_links.member_profile_id
        AND profile.is_public AND profile.consented_at IS NOT NULL
        AND profile.consented_at <= now()
        AND association.visibility = 'published'
        AND association.published_at IS NOT NULL
        AND association.published_at <= now()
        AND private.is_public_member_profile(profile.association_id, profile.id)
    )
  );
CREATE POLICY member_social_links_authenticated_read ON public.member_social_links
  FOR SELECT TO authenticated USING (
    private.owns_membership((SELECT profile.membership_id FROM public.member_profiles AS profile
      WHERE profile.association_id = member_social_links.association_id
        AND profile.id = member_social_links.member_profile_id))
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
    OR (is_public AND EXISTS (
      SELECT 1 FROM public.member_profiles AS profile
      JOIN public.associations AS association ON association.id = profile.association_id
      WHERE profile.association_id = member_social_links.association_id
        AND profile.id = member_social_links.member_profile_id AND profile.is_public
        AND profile.consented_at IS NOT NULL AND profile.consented_at <= now()
        AND association.visibility = 'published'
        AND association.published_at IS NOT NULL AND association.published_at <= now()
        AND private.is_public_member_profile(profile.association_id, profile.id)
    ))
  );
CREATE POLICY member_social_links_owner_manage ON public.member_social_links
  FOR ALL TO authenticated
  USING (private.owns_active_membership((SELECT profile.membership_id FROM public.member_profiles AS profile
    WHERE profile.association_id = member_social_links.association_id
      AND profile.id = member_social_links.member_profile_id)))
  WITH CHECK (private.owns_active_membership((SELECT profile.membership_id FROM public.member_profiles AS profile
    WHERE profile.association_id = member_social_links.association_id
      AND profile.id = member_social_links.member_profile_id)));

-- Position titles are display data only. They never grant access; application
-- permissions come from trusted membership roles or the platform-admin claim.
CREATE POLICY association_positions_read ON public.association_positions
  FOR SELECT TO anon, authenticated USING (
    is_active AND EXISTS (
      SELECT 1 FROM public.associations AS association
      WHERE association.id = association_id
        AND association.visibility = 'published'
        AND association.published_at IS NOT NULL
        AND association.published_at <= now()
    )
    OR (auth.role() = 'authenticated' AND (
      private.is_platform_admin()
      OR private.has_association_role(association_id, ARRAY['president']::text[])
    ))
  );
CREATE POLICY association_positions_manage ON public.association_positions
  FOR ALL TO authenticated
  USING (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]))
  WITH CHECK (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]));

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
    OR (auth.role() = 'authenticated' AND (
      private.is_platform_admin()
      OR private.has_association_role(association_id, ARRAY['president']::text[])
    ))
  );
CREATE POLICY member_position_assignments_manage ON public.member_position_assignments
  FOR ALL TO authenticated
  USING (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]))
  WITH CHECK (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]));

-- Existing content remains public only after both it and its association are
-- published. President edits and drafts are scoped to the owning association.
CREATE POLICY events_public_read_published ON public.events
  FOR SELECT TO anon USING (
    publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now()
    AND EXISTS (SELECT 1 FROM public.associations AS association
      WHERE association.id = association_id AND association.visibility = 'published'
        AND association.published_at IS NOT NULL AND association.published_at <= now())
  );
CREATE POLICY events_authenticated_read ON public.events
  FOR SELECT TO authenticated USING (
    (publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now()
      AND EXISTS (SELECT 1 FROM public.associations AS association
        WHERE association.id = association_id AND association.visibility = 'published'
          AND association.published_at IS NOT NULL AND association.published_at <= now()))
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY events_president_insert ON public.events
  FOR INSERT TO authenticated WITH CHECK (
    private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY events_president_update ON public.events
  FOR UPDATE TO authenticated
  USING (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]))
  WITH CHECK (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]));
CREATE POLICY events_president_delete ON public.events
  FOR DELETE TO authenticated USING (
    private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[])
  );

CREATE POLICY projects_public_read_published ON public.projects
  FOR SELECT TO anon USING (
    publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now()
    AND EXISTS (SELECT 1 FROM public.associations AS association
      WHERE association.id = association_id AND association.visibility = 'published'
        AND association.published_at IS NOT NULL AND association.published_at <= now())
  );
CREATE POLICY projects_authenticated_read ON public.projects
  FOR SELECT TO authenticated USING (
    (publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now()
      AND EXISTS (SELECT 1 FROM public.associations AS association
        WHERE association.id = association_id AND association.visibility = 'published'
          AND association.published_at IS NOT NULL AND association.published_at <= now()))
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY projects_president_insert ON public.projects
  FOR INSERT TO authenticated WITH CHECK (
    private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY projects_president_update ON public.projects
  FOR UPDATE TO authenticated
  USING (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]))
  WITH CHECK (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]));
CREATE POLICY projects_president_delete ON public.projects
  FOR DELETE TO authenticated USING (
    private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[])
  );

CREATE POLICY announcements_public_read_published ON public.announcements
  FOR SELECT TO anon USING (
    publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now()
    AND EXISTS (SELECT 1 FROM public.associations AS association
      WHERE association.id = association_id AND association.visibility = 'published'
        AND association.published_at IS NOT NULL AND association.published_at <= now())
  );
CREATE POLICY announcements_authenticated_read ON public.announcements
  FOR SELECT TO authenticated USING (
    (publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now()
      AND EXISTS (SELECT 1 FROM public.associations AS association
        WHERE association.id = association_id AND association.visibility = 'published'
          AND association.published_at IS NOT NULL AND association.published_at <= now()))
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY announcements_president_insert ON public.announcements
  FOR INSERT TO authenticated WITH CHECK (
    private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY announcements_president_update ON public.announcements
  FOR UPDATE TO authenticated
  USING (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]))
  WITH CHECK (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]));
CREATE POLICY announcements_president_delete ON public.announcements
  FOR DELETE TO authenticated USING (
    private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[])
  );

-- Event child data inherits public visibility from a published parent event;
-- media also needs approval and people also need explicit publication consent.
CREATE POLICY event_media_public_read ON public.event_media
  FOR SELECT TO anon USING (
    approval_status = 'approved'
    AND EXISTS (SELECT 1 FROM public.events AS event
      WHERE event.association_id = event_media.association_id AND event.id = event_media.event_id
        AND event.publication_status = 'published'
        AND event.published_at IS NOT NULL AND event.published_at <= now())
  );
CREATE POLICY event_media_authenticated_read ON public.event_media
  FOR SELECT TO authenticated USING (
    (approval_status = 'approved' AND EXISTS (SELECT 1 FROM public.events AS event
      WHERE event.association_id = event_media.association_id AND event.id = event_media.event_id
        AND event.publication_status = 'published'
        AND event.published_at IS NOT NULL AND event.published_at <= now()))
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY event_media_manage ON public.event_media
  FOR ALL TO authenticated
  USING (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]))
  WITH CHECK (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]));

CREATE POLICY event_links_public_read ON public.event_links
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.events AS event
      WHERE event.association_id = event_links.association_id AND event.id = event_links.event_id
        AND event.publication_status = 'published'
        AND event.published_at IS NOT NULL AND event.published_at <= now())
  );
CREATE POLICY event_links_authenticated_read ON public.event_links
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.events AS event
      WHERE event.association_id = event_links.association_id AND event.id = event_links.event_id
        AND event.publication_status = 'published'
        AND event.published_at IS NOT NULL AND event.published_at <= now())
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY event_links_manage ON public.event_links
  FOR ALL TO authenticated
  USING (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]))
  WITH CHECK (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]));

CREATE POLICY event_people_public_read ON public.event_people
  FOR SELECT TO anon USING (
    consented_to_publication AND consented_at IS NOT NULL AND consented_at <= now()
    AND EXISTS (SELECT 1 FROM public.events AS event
      WHERE event.association_id = event_people.association_id AND event.id = event_people.event_id
        AND event.publication_status = 'published'
        AND event.published_at IS NOT NULL AND event.published_at <= now())
  );
CREATE POLICY event_people_authenticated_read ON public.event_people
  FOR SELECT TO authenticated USING (
    (consented_to_publication AND consented_at IS NOT NULL AND consented_at <= now()
      AND EXISTS (SELECT 1 FROM public.events AS event
        WHERE event.association_id = event_people.association_id AND event.id = event_people.event_id
          AND event.publication_status = 'published'
          AND event.published_at IS NOT NULL AND event.published_at <= now()))
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
  );
CREATE POLICY event_people_manage ON public.event_people
  FOR ALL TO authenticated
  USING (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]))
  WITH CHECK (private.is_platform_admin() OR private.has_association_role(association_id, ARRAY['president']::text[]));

-- Grants decide which API roles can reach a table; the RLS policies above then
-- decide which rows they can see or change. Keep the two checks together.
REVOKE ALL ON public.associations, public.association_page_sections,
  public.association_social_links, public.association_memberships,
  public.member_profiles, public.member_social_links, public.association_positions,
  public.member_position_assignments, public.events, public.projects,
  public.announcements, public.event_media, public.event_links, public.event_people
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.associations, public.association_page_sections,
  public.association_social_links, public.member_profiles, public.member_social_links,
  public.association_positions, public.member_position_assignments,
  public.events, public.projects, public.announcements,
  public.event_media, public.event_links, public.event_people TO anon;

-- Membership role/status writes are column-limited and RLS restricts role
-- changes to platform admins. Members can update only their allowed profile
-- fields; event-person consent is reserved for a trusted server workflow.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.associations,
  public.association_page_sections, public.association_social_links,
  public.member_social_links, public.association_positions,
  public.member_position_assignments, public.events, public.projects,
  public.announcements, public.event_media, public.event_links, public.event_people
TO authenticated;
GRANT SELECT, INSERT (association_id, user_id, permission_role, status),
  UPDATE (permission_role, status) ON public.association_memberships TO authenticated;
GRANT SELECT ON public.association_memberships TO authenticated;
GRANT UPDATE (slug, display_name, bio_fr, bio_en, photo_path, is_public, consented_at)
  ON public.member_profiles TO authenticated;
GRANT INSERT (association_id, membership_id, slug, display_name, bio_fr, bio_en, photo_path)
  ON public.member_profiles TO authenticated;
GRANT SELECT, DELETE ON public.member_profiles TO authenticated;
REVOKE ALL ON public.event_people FROM authenticated;
GRANT SELECT, DELETE ON public.event_people TO authenticated;
GRANT INSERT (association_id, event_id, member_profile_id, external_display_name,
  participation_role, display_order) ON public.event_people TO authenticated;
GRANT UPDATE (event_id, member_profile_id, external_display_name,
  participation_role, display_order) ON public.event_people TO authenticated;

-- service_role bypasses RLS, so keep this credential on trusted server code.
GRANT ALL ON public.associations, public.association_page_sections,
  public.association_social_links, public.association_memberships,
  public.member_profiles, public.member_social_links, public.association_positions,
  public.member_position_assignments, public.events, public.projects,
  public.announcements, public.event_media, public.event_links, public.event_people
TO service_role;

CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER announcements_set_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER event_media_set_updated_at BEFORE UPDATE ON public.event_media
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER event_links_set_updated_at BEFORE UPDATE ON public.event_links
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER event_people_set_updated_at BEFORE UPDATE ON public.event_people
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

