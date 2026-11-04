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

- `index.html`, `a-propos/`, `activites/`, `associations/`, `compte/`, and `en/` contain the directly addressable French and English routes. Account administration is split between `/compte/admin/associations/` and `/compte/admin/comptes/`, with equivalent English routes.
- `src/main.js` is the browser entry point and initializes shared page features.
- `src/features/` contains page behavior and DOM rendering.
- `src/services/` contains Supabase data queries; `src/lib/` contains the Supabase client setup.
- `src/style.css` contains shared site styles.
- `netlify/functions/` is the location for future server-side functions that need secrets, privileged writes, or request validation.

## Member accounts and roles

- French and English account pages are available at `/compte/` and `/en/account/`. Platform administrators manage associations at `/compte/admin/associations/` and account roles at `/compte/admin/comptes/`, with matching `/en/account/admin/` pages.
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in local development and Netlify. Browser code must never receive a Supabase secret or service-role key.
- Disable public user sign-ups in Supabase Auth so direct API sign-ups are blocked. Association presidents can invite a member from their workspace; the invite creates a Supabase Auth account when needed and automatically links the account to that association. Existing Supabase accounts can be added by email. Configure a production email sender (SMTP), set the server-side `SITE_URL` Edge Function secret to the deployed site origin, and add the deployed `/compte/` and `/en/account/` URLs to the Auth redirect allow list.
- Deploy `supabase/functions/manage-users/` to the same verified Supabase project as the site. Keep JWT verification enabled.
- Before initial setup, add `INITIAL_ADMIN_EMAIL` as an Edge Function secret in the Supabase Dashboard. Set it to the email that will own the first administrator account; do not commit it. Create that user in Authentication → Users and confirm the email before using the one-time setup button. Setup is refused if any administrator already exists.
- New accounts are ordinary members. Administrators can assign `member` or `admin` platform roles, create association workspaces, and assign or transfer each association's active president from the bilingual account page. Create and confirm a Supabase Auth account before assigning it as president. The first active president is also added as an association member; a handover changes the previous president to an ordinary member without changing their platform-admin role.
- Association presidents can edit and publish only their own association page from their account workspace. Supabase RLS enforces this boundary, so an association president cannot edit another association by changing browser data. Platform administrators can edit all association pages and can also be presidents of their own associations.
- Presidents can create, edit, publish, unpublish, or archive events for their own association in the account workspace. Event reads and writes are scoped by association ID and enforced by Supabase RLS; platform administrators can manage events for any association.
- Members can set a password after accepting an invitation and control whether their bilingual member profile is public. Profiles start private; only active members who explicitly consent appear in the association’s member directory and public member page. The directory uses `/associations/<slug>/members/` and `/associations/<slug>/members/<member>/`, with equivalent `/en/` routes.
- Association creation and first-president assignment are a single atomic action through the authenticated Edge Function and service-role-only database transaction. After creation, the admin is taken to that association’s workspace editor. Later president transfers use the same association administration page. Association page edits use the signed-in Supabase client and association-scoped RLS; both paths store data in Supabase.
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
