# pstb-tech

## Decription

PSTB Tech is the PSTB student association for technology and innovation. It makes student life a practical extension of academic learning through hands-on projects and workshops, student events, and professional connections. Its mission is to build a lasting community that shares knowledge across cohorts and connects theory with real-world applications.

## Hosting and data

- **Website hosting:** Netlify.
- **Database and backend services:** Supabase.

The site uses Vite, and the Supabase CLI is a project development dependency. Local Supabase configuration lives in `supabase/`. The hosted project initially had no association-content migration history; `events`, `projects`, and `announcements` had been created through the SQL Editor. The association model and tenant ownership are now recorded in `supabase/migrations/20261031182358_association_model.sql`, which was applied to the hosted prototype.

The declarative schema files in `supabase/schemas/` describe the desired database structure. This prototype uses a Docker-free, manually authored migration workflow: create a timestamped file with `npx supabase migration new <name>`, write and review the SQL, then preview and apply it to the verified linked project:

```sh
npx supabase migration list --linked
npx supabase db push --dry-run --linked
npx supabase db push --linked
```

The current migrations are incremental from the existing hosted schema; they are not yet a baseline for recreating that original schema on a fresh project. Only push migrations after verifying that the CLI project reference matches the intended Supabase project. Keep Supabase secret or service-role credentials out of browser code and commit only environment variable names, not secret values. The browser should use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Source layout

- `index.html`, `a-propos/`, `activites/`, `associations/`, and `en/` contain the directly addressable French and English routes.
- `src/main.js` is the browser entry point and initializes shared page features.
- `src/features/` contains page behavior and DOM rendering.
- `src/services/` contains Supabase data queries; `src/lib/` contains the Supabase client setup.
- `src/style.css` contains shared site styles.
- `netlify/functions/` is the location for future server-side functions that need secrets, privileged writes, or request validation.

## Member accounts and roles

- French and English account pages are available at `/compte/` and `/en/account/`.
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in local development and Netlify. Browser code must never receive a Supabase secret or service-role key.
- Create member accounts through **Authentication → Users** in the Supabase Dashboard; the public site provides sign-in only. Disable new user sign-ups in Supabase Auth so direct API sign-ups are also blocked. If using invitations or password reset emails, configure a production email sender (SMTP) first. Add the deployed `/compte/` and `/en/account/` URLs to the Auth redirect allow list for those email links.
- Deploy `supabase/functions/manage-users/` to the same verified Supabase project as the site. Keep JWT verification enabled.
- Assign the first administrator through a trusted server-side Supabase Auth Admin API operation.
- New accounts are ordinary members. Administrators can assign `member` or `admin` roles from the account page. Role changes are written only to trusted `app_metadata` by the Edge Function; member listings and role updates are not available to regular users.
- The function uses the Supabase Edge Function `SUPABASE_SERVICE_ROLE_KEY` only on the server. Never add it to Vite or a `VITE_` environment variable.

## Association workspaces

- Every page links to the French or English association directory from its burger menu. Published workspace pages use `/associations/<slug>/` and `/en/associations/<slug>/`.
- Active association presidents can edit their own association's bilingual identity, publication state, approved color palette, logo/cover, safe text sections, social links, and display-only role cards from their account page. Public profile assignments require a public, consented member profile.
- Platform administrators can create draft workspaces for existing, email-confirmed accounts, transfer a workspace presidency, and remove ordinary member access. A transfer demotes the previous president to an ordinary member; transfer the presidency before removing that person's membership.
- Association media uses the private `association-media` Storage bucket. It accepts PNG, JPEG, and WebP files up to 5 MB; uploaded paths are scoped to an association UUID and object access is controlled by Storage RLS. The editor requires bilingual alt text and confirmation of image rights/consent before upload.
- Apply and review `supabase/migrations/20261102112518_association_workspace_management.sql` and deploy the updated `supabase/functions/manage-users/` to the verified project before relying on workspace administration or media uploads. Do not push this migration without checking the linked project and its migration history.

## Licensing

Licensing in this repository is separated by content type:

- **Website and application code:** [MIT License](LICENSE).
- **Documentation and educational resources:** [CC BY 4.0](LICENSE-DOCUMENTATION.md).
- **Association name, logo, and other branding:** not covered by either license; see [BRANDING.md](BRANDING.md).

Please keep these notices with their corresponding materials when reusing them.
