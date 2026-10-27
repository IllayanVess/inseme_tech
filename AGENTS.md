# Project instructions

## Website languages

- Every public-facing page must be available in both French and English.
- Keep each language as a complete, directly addressable page with correct `lang`, title, description, navigation, and accessibility text.
- Include a visible FR/EN language switch on every page. The switch should lead to the equivalent page in the other language when one exists.
- When adding or changing user-facing content, update both language versions in the same change.

## Visual theme

- Treat the current dark, technical visual style as the site's main theme: near-black blue surfaces, indigo and cyan accents, fine grid/starfield details, translucent panels, Geist and Geist Mono typography, and restrained glow effects.
- Keep this visual language consistent across all pages and both language versions. Prefer shared styles over page-specific overrides.
- Preserve readable contrast, keyboard focus indicators, responsive layouts, and reduced-motion support when changing the theme.
- Keep Inseme Tech's own content, imagery, and branding. Use reference projects for visual direction only; do not copy their people, data, or slogans.

## Project architecture

- Keep the existing Vite multi-page setup. Do not add a framework, state-management library, or dependency unless a concrete feature requires it.
- Keep `src/main.js` as a small bootstrap: import shared styles and initialize page features.
- Put page-specific browser behavior under `src/features/<feature>/`. Each feature should initialize only when its page root or data attribute exists.
- Keep Supabase queries and other external data access in `src/services/`. Keep client initialization and third-party adapters in `src/lib/`.
- Keep rendering and event handling out of data services. Pass returned data to feature modules for presentation.
- Add reusable helpers only when there are multiple real callers; prefer a small feature-local helper over a generic framework.
- Keep route HTML in the existing route folders. Extract shared modules only when the shared behavior is actually common to those pages.
- Use explicit Supabase column selections and bounded queries. Use `textContent` or DOM APIs for database content; do not inject untrusted content with `innerHTML`.

## Supabase and server-side operations

- Browser code may use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put database passwords, service-role keys, or secret keys in `VITE_` variables or the built site.
- Enable RLS on every exposed table and define least-privilege grants and policies for each access path. Never rely on interface visibility as authorization.
- Use trusted `app_metadata` or server-side role checks for authorization; never authorize with user-editable metadata.
- Keep public content separate from personal submissions, attendee lists, and member records. Never return private records to anonymous clients.
- Put operations requiring secrets, privileged writes, validation, email, or rate limiting in Netlify Functions or another trusted server-side service.
- Treat `supabase/schemas/` as the schema source of truth. Generate and review versioned migrations from it; avoid untracked manual production changes.
- Do not seed invented association events, projects, people, partnerships, or contact information. Use clearly labeled fictional data only for local development.

## Agent workflow and maintainability

- Read this file and the relevant README sections before changing architecture, data access, or deployment configuration.
- Inspect the existing route, feature, service, and database schema before adding a parallel implementation.
- Make focused changes that fit the current structure. Do not reorganize unrelated pages or files as part of a feature change.
- When changing public-facing content or behavior, update the French and English versions together and preserve their equivalent routes.
- Keep functions focused, name them for the work they perform, and pass dependencies or data explicitly where that improves clarity. Avoid large modules that combine DOM behavior, database queries, and deployment concerns.
- Update `TODO.md` when a roadmap item is completed. It is intentionally ignored by Git and must remain uncommitted.
- Never print or copy secrets into chat, logs, documentation, source files, or command output.
- Do not commit, push, deploy, or change the hosted database unless the user has asked for that action.
- Report what changed, what was checked, and any environment limitation. Do not claim a live database or deployment path was verified when it could not be reached.
