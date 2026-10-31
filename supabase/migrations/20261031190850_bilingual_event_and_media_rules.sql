-- Follow-up to the association model migration. These changes formalize the
-- bilingual publication contract, image accessibility text, and event links.

ALTER TABLE public.associations
  ADD COLUMN logo_alt_fr text,
  ADD COLUMN logo_alt_en text,
  ADD COLUMN cover_alt_fr text,
  ADD COLUMN cover_alt_en text,
  ADD CONSTRAINT associations_logo_alt_required CHECK (
    logo_path IS NULL OR (
      nullif(btrim(logo_alt_fr), '') IS NOT NULL
      AND nullif(btrim(logo_alt_en), '') IS NOT NULL
    )
  ),
  ADD CONSTRAINT associations_cover_alt_required CHECK (
    cover_path IS NULL OR (
      nullif(btrim(cover_alt_fr), '') IS NOT NULL
      AND nullif(btrim(cover_alt_en), '') IS NOT NULL
    )
  );

ALTER TABLE public.association_page_sections
  ADD CONSTRAINT association_sections_bilingual_when_published CHECK (
    publication_status <> 'published'
    OR (content_fr <> '{}'::jsonb AND content_en <> '{}'::jsonb AND published_at IS NOT NULL)
  );

ALTER TABLE public.association_social_links
  ADD CONSTRAINT association_social_labels_bilingual CHECK (
    (label_fr IS NULL AND label_en IS NULL)
    OR (nullif(btrim(label_fr), '') IS NOT NULL AND nullif(btrim(label_en), '') IS NOT NULL)
  );

ALTER TABLE public.member_social_links
  ADD COLUMN consented_at timestamptz,
  ADD CONSTRAINT member_social_links_public_requires_consent CHECK (
    NOT is_public OR consented_at IS NOT NULL
  ),
  ADD CONSTRAINT member_social_links_labels_bilingual CHECK (
    (label_fr IS NULL AND label_en IS NULL)
    OR (nullif(btrim(label_fr), '') IS NOT NULL AND nullif(btrim(label_en), '') IS NOT NULL)
  );

ALTER TABLE public.association_positions
  ADD CONSTRAINT association_position_responsibility_bilingual CHECK (
    (responsibility_fr IS NULL AND responsibility_en IS NULL)
    OR (nullif(btrim(responsibility_fr), '') IS NOT NULL
      AND nullif(btrim(responsibility_en), '') IS NOT NULL)
  ),
  ADD CONSTRAINT association_position_tasks_bilingual CHECK (
    (tasks_fr IS NULL AND tasks_en IS NULL)
    OR (nullif(btrim(tasks_fr), '') IS NOT NULL AND nullif(btrim(tasks_en), '') IS NOT NULL)
  );

ALTER TABLE public.events
  ADD COLUMN timezone_name text NOT NULL DEFAULT 'Europe/Paris'
    CHECK (nullif(btrim(timezone_name), '') IS NOT NULL),
  ADD CONSTRAINT events_optional_bilingual_pairs CHECK (
    ((summary_fr IS NULL AND summary_en IS NULL)
      OR (nullif(btrim(summary_fr), '') IS NOT NULL AND nullif(btrim(summary_en), '') IS NOT NULL))
    AND ((description_fr IS NULL AND description_en IS NULL)
      OR (nullif(btrim(description_fr), '') IS NOT NULL AND nullif(btrim(description_en), '') IS NOT NULL))
    AND ((location_fr IS NULL AND location_en IS NULL)
      OR (nullif(btrim(location_fr), '') IS NOT NULL AND nullif(btrim(location_en), '') IS NOT NULL))
  ),
  ADD COLUMN event_report_announcement_id uuid,
  ADD CONSTRAINT events_report_announcement_fk
    FOREIGN KEY (association_id, event_report_announcement_id)
    REFERENCES public.announcements (association_id, id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX events_report_announcement_unique_idx
  ON public.events (association_id, event_report_announcement_id)
  WHERE event_report_announcement_id IS NOT NULL;
CREATE INDEX events_published_status_starts_at_idx
  ON public.events (event_status, starts_at)
  WHERE publication_status = 'published';

ALTER TABLE public.projects
  ADD CONSTRAINT projects_optional_summary_bilingual CHECK (
    (summary_fr IS NULL AND summary_en IS NULL)
    OR (nullif(btrim(summary_fr), '') IS NOT NULL AND nullif(btrim(summary_en), '') IS NOT NULL)
  );

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_optional_summary_bilingual CHECK (
    (summary_fr IS NULL AND summary_en IS NULL)
    OR (nullif(btrim(summary_fr), '') IS NOT NULL AND nullif(btrim(summary_en), '') IS NOT NULL)
  );

ALTER TABLE public.event_links
  DROP CONSTRAINT event_links_link_type_check,
  ADD CONSTRAINT event_links_link_type_allowed CHECK (link_type IN (
    'registration', 'venue', 'online', 'resource', 'social_post', 'other'
  ));

DROP POLICY member_social_links_public_read ON public.member_social_links;
CREATE POLICY member_social_links_public_read ON public.member_social_links
  FOR SELECT TO anon USING (
    is_public AND consented_at IS NOT NULL AND consented_at <= now()
    AND EXISTS (
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

DROP POLICY member_social_links_authenticated_read ON public.member_social_links;
CREATE POLICY member_social_links_authenticated_read ON public.member_social_links
  FOR SELECT TO authenticated USING (
    private.owns_membership((SELECT profile.membership_id FROM public.member_profiles AS profile
      WHERE profile.association_id = member_social_links.association_id
        AND profile.id = member_social_links.member_profile_id))
    OR private.is_platform_admin()
    OR private.has_association_role(association_id, ARRAY['president']::text[])
    OR (is_public AND consented_at IS NOT NULL AND consented_at <= now() AND EXISTS (
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

CREATE OR REPLACE FUNCTION private.handle_membership_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
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

REVOKE ALL ON FUNCTION private.handle_membership_status_change() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.handle_membership_status_change() TO authenticated, service_role;
