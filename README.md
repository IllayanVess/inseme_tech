# pstb-tech

## Decription

PSTB Tech is the PSTB student association for technology and innovation. It makes student life a practical extension of academic learning through hands-on projects and workshops, student events, and professional connections. Its mission is to build a lasting community that shares knowledge across cohorts and connects theory with real-world applications.

## Hosting and data

- **Website hosting:** Netlify.
- **Database and backend services:** Supabase.

The site uses Vite, and the Supabase CLI is a project development dependency. Local Supabase configuration lives in `supabase/`. The confirmed hosted project had no association content tables or CLI migration history when setup began. Its public schema is pulled into `supabase/schemas/`; the bilingual event, project, and announcement tables and their access policies are declared there and have been created in the hosted database through the SQL Editor. Recording that change as a versioned migration is still pending.

The public content schema is declared in `supabase/schemas/public/content.sql`. To generate and apply its first migration locally, start Docker Desktop, then use:

```sh
npx supabase start
npx supabase db diff -f initial_public_content
npx supabase db reset
```

Only link or push migrations after verifying that the CLI project reference matches the intended Supabase project. Keep Supabase secret or service-role credentials out of browser code and commit only environment variable names, not secret values. The browser should use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Source layout

- `index.html`, `a-propos/`, `activites/`, and `en/` contain the directly addressable French and English routes.
- `src/main.js` is the browser entry point and initializes shared page features.
- `src/features/` contains page behavior and DOM rendering.
- `src/services/` contains Supabase data queries; `src/lib/` contains the Supabase client setup.
- `src/style.css` contains shared site styles.
- `netlify/functions/` is the location for future server-side functions that need secrets, privileged writes, or request validation.

## Licensing

Licensing in this repository is separated by content type:

- **Website and application code:** [MIT License](LICENSE).
- **Documentation and educational resources:** [CC BY 4.0](LICENSE-DOCUMENTATION.md).
- **Association name, logo, and other branding:** not covered by either license; see [BRANDING.md](BRANDING.md).

Please keep these notices with their corresponding materials when reusing them.
