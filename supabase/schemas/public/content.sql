-- Publicly readable association content. Private applications and attendee data
-- belong in separate tables with a server-side submission flow.

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN (
    'programming',
    'data_ai',
    'robotics',
    'creative_technology',
    'professional_development',
    'community'
  )),
  title_fr text NOT NULL,
  title_en text,
  summary_fr text,
  summary_en text,
  description_fr text,
  description_en text,
  location_fr text,
  location_en text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  event_status text NOT NULL DEFAULT 'planned'
    CHECK (event_status IN ('planned', 'open', 'full', 'cancelled', 'completed')),
  registration_deadline timestamptz,
  registration_capacity integer CHECK (registration_capacity IS NULL OR registration_capacity > 0),
  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_valid_time_range CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT events_bilingual_when_published CHECK (
    publication_status <> 'published'
    OR (nullif(btrim(title_fr), '') IS NOT NULL AND nullif(btrim(title_en), '') IS NOT NULL)
  )
);

CREATE INDEX events_published_starts_at_idx
  ON public.events (starts_at)
  WHERE publication_status = 'published';

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_fr text NOT NULL,
  title_en text,
  summary_fr text,
  summary_en text,
  description_fr text,
  description_en text,
  technologies text[] NOT NULL DEFAULT '{}',
  project_status text NOT NULL DEFAULT 'proposed'
    CHECK (project_status IN ('proposed', 'recruiting', 'in_progress', 'completed', 'archived')),
  repository_url text,
  demo_url text,
  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_bilingual_when_published CHECK (
    publication_status <> 'published'
    OR (
      nullif(btrim(title_fr), '') IS NOT NULL
      AND nullif(btrim(title_en), '') IS NOT NULL
      AND nullif(btrim(description_fr), '') IS NOT NULL
      AND nullif(btrim(description_en), '') IS NOT NULL
    )
  )
);

CREATE INDEX projects_published_at_idx
  ON public.projects (published_at DESC)
  WHERE publication_status = 'published';

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'recruitment', 'event_report', 'project_update', 'partnership')),
  title_fr text NOT NULL,
  title_en text,
  summary_fr text,
  summary_en text,
  body_fr text,
  body_en text,
  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcements_bilingual_when_published CHECK (
    publication_status <> 'published'
    OR (
      nullif(btrim(title_fr), '') IS NOT NULL
      AND nullif(btrim(title_en), '') IS NOT NULL
      AND nullif(btrim(body_fr), '') IS NOT NULL
      AND nullif(btrim(body_en), '') IS NOT NULL
    )
  )
);

CREATE INDEX announcements_published_at_idx
  ON public.announcements (published_at DESC)
  WHERE publication_status = 'published';

-- Explicit grants limit the broad default privileges already present in the
-- project. Row-level security restricts visitors to bilingual published rows.
REVOKE ALL ON public.events, public.projects, public.announcements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.events, public.projects, public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events, public.projects, public.announcements TO authenticated;
GRANT ALL ON public.events, public.projects, public.announcements TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_public_read_published ON public.events
  FOR SELECT TO anon
  USING (publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now());
CREATE POLICY events_authenticated_read ON public.events
  FOR SELECT TO authenticated
  USING (
    (publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now())
    OR (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
CREATE POLICY events_admin_insert ON public.events
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY events_admin_update ON public.events
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY events_admin_delete ON public.events
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY projects_public_read_published ON public.projects
  FOR SELECT TO anon
  USING (publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now());
CREATE POLICY projects_authenticated_read ON public.projects
  FOR SELECT TO authenticated
  USING (
    (publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now())
    OR (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
CREATE POLICY projects_admin_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY projects_admin_update ON public.projects
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY projects_admin_delete ON public.projects
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY announcements_public_read_published ON public.announcements
  FOR SELECT TO anon
  USING (publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now());
CREATE POLICY announcements_authenticated_read ON public.announcements
  FOR SELECT TO authenticated
  USING (
    (publication_status = 'published' AND published_at IS NOT NULL AND published_at <= now())
    OR (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
CREATE POLICY announcements_admin_insert ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY announcements_admin_update ON public.announcements
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY announcements_admin_delete ON public.announcements
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
