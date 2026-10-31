-- LOCAL DEVELOPMENT ONLY.
-- Every row below is fictional demonstration content. Supabase CLI loads this
-- file after local migrations during `supabase db reset`; never apply it to a
-- hosted database or use these records as real association information.

INSERT INTO public.associations (
  id,
  slug,
  name,
  introduction_fr,
  introduction_en,
  mission_fr,
  mission_en,
  theme_accent,
  visibility,
  published_at
)
VALUES (
  '10000000-0000-4000-8000-000000000001',
  'fictional-demo-only',
  'DÉMO FICTIVE — Association Exemple',
  'Contenu fictif réservé au développement local. Ne représente aucune association réelle.',
  'Fictional content for local development only. This does not represent a real association.',
  'Exemple fictif de mission pour tester la page en français.',
  'Fictional sample mission for testing the English page.',
  'indigo',
  'published',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  introduction_fr = EXCLUDED.introduction_fr,
  introduction_en = EXCLUDED.introduction_en,
  mission_fr = EXCLUDED.mission_fr,
  mission_en = EXCLUDED.mission_en,
  theme_accent = EXCLUDED.theme_accent,
  visibility = EXCLUDED.visibility,
  published_at = EXCLUDED.published_at;

INSERT INTO public.association_page_sections (
  id,
  association_id,
  section_type,
  section_key,
  content_fr,
  content_en,
  display_order,
  publication_status,
  published_at
)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'hero',
  'fictional-demo-hero',
  '{"title":"DÉMO FICTIVE — contenu local uniquement"}'::jsonb,
  '{"title":"FICTIONAL DEMO — local content only"}'::jsonb,
  0,
  'published',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  content_fr = EXCLUDED.content_fr,
  content_en = EXCLUDED.content_en,
  display_order = EXCLUDED.display_order,
  publication_status = EXCLUDED.publication_status,
  published_at = EXCLUDED.published_at;

INSERT INTO public.events (
  id,
  association_id,
  slug,
  category,
  title_fr,
  title_en,
  summary_fr,
  summary_en,
  description_fr,
  description_en,
  location_fr,
  location_en,
  starts_at,
  ends_at,
  event_status,
  publication_status,
  published_at
)
VALUES
(
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'fictional-demo-upcoming',
  'creative_technology',
  'DÉMO FICTIVE — atelier créatif',
  'FICTIONAL DEMO — creative workshop',
  'Résumé fictif pour le développement local.',
  'Fictional summary for local development.',
  'Description fictive. Aucun événement réel n’est annoncé.',
  'Fictional description. No real event is being announced.',
  'Lieu fictif',
  'Fictional location',
  now() + interval '30 days',
  now() + interval '30 days 2 hours',
  'planned',
  'published',
  now()
),
(
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'fictional-demo-past',
  'programming',
  'DÉMO FICTIVE — séance de programmation',
  'FICTIONAL DEMO — programming session',
  'Résumé fictif pour vérifier l’affichage des événements passés.',
  'Fictional summary for checking past-event display.',
  'Description fictive. Cette séance n’a jamais eu lieu.',
  'Fictional description. This session never took place.',
  'Lieu fictif',
  'Fictional location',
  now() - interval '30 days',
  now() - interval '30 days' + interval '2 hours',
  'completed',
  'published',
  now() - interval '31 days'
)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  title_fr = EXCLUDED.title_fr,
  title_en = EXCLUDED.title_en,
  summary_fr = EXCLUDED.summary_fr,
  summary_en = EXCLUDED.summary_en,
  description_fr = EXCLUDED.description_fr,
  description_en = EXCLUDED.description_en,
  location_fr = EXCLUDED.location_fr,
  location_en = EXCLUDED.location_en,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  event_status = EXCLUDED.event_status,
  publication_status = EXCLUDED.publication_status,
  published_at = EXCLUDED.published_at;

INSERT INTO public.projects (
  id,
  association_id,
  slug,
  title_fr,
  title_en,
  summary_fr,
  summary_en,
  description_fr,
  description_en,
  technologies,
  project_status,
  publication_status,
  published_at
)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'fictional-demo-project',
  'DÉMO FICTIVE — projet exemple',
  'FICTIONAL DEMO — sample project',
  'Résumé fictif du projet de démonstration.',
  'Fictional summary for the demonstration project.',
  'Description fictive pour tester le contenu bilingue. Aucun projet réel n’est présenté.',
  'Fictional description for testing bilingual content. No real project is presented.',
  ARRAY['sample-only']::text[],
  'proposed',
  'published',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  title_fr = EXCLUDED.title_fr,
  title_en = EXCLUDED.title_en,
  summary_fr = EXCLUDED.summary_fr,
  summary_en = EXCLUDED.summary_en,
  description_fr = EXCLUDED.description_fr,
  description_en = EXCLUDED.description_en,
  technologies = EXCLUDED.technologies,
  project_status = EXCLUDED.project_status,
  publication_status = EXCLUDED.publication_status,
  published_at = EXCLUDED.published_at;

INSERT INTO public.announcements (
  id,
  association_id,
  slug,
  category,
  title_fr,
  title_en,
  summary_fr,
  summary_en,
  body_fr,
  body_en,
  publication_status,
  published_at
)
VALUES (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'fictional-demo-announcement',
  'general',
  'DÉMO FICTIVE — annonce exemple',
  'FICTIONAL DEMO — sample announcement',
  'Contenu local fictif uniquement.',
  'Fictional local content only.',
  'Annonce de démonstration. Elle ne décrit aucun fait ni partenariat réel.',
  'Demonstration announcement. It describes no real event or partnership.',
  'published',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  title_fr = EXCLUDED.title_fr,
  title_en = EXCLUDED.title_en,
  summary_fr = EXCLUDED.summary_fr,
  summary_en = EXCLUDED.summary_en,
  body_fr = EXCLUDED.body_fr,
  body_en = EXCLUDED.body_en,
  publication_status = EXCLUDED.publication_status,
  published_at = EXCLUDED.published_at;
