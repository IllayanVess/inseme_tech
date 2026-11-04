# Supabase migrations

Store timestamped, forward-only SQL changes in this directory. The Supabase CLI
reads files named `<timestamp>_<description>.sql` in timestamp order.

## Docker-free workflow

Create a migration file with the project CLI, then write and review its SQL:

```sh
npx supabase migration new describe_the_change
```

With the intended Supabase project linked, check migration history, preview the
pending migration, then apply it:

```sh
npx supabase migration list --linked
npx supabase db push --dry-run --linked
npx supabase db push --linked
```

These commands target the linked hosted database; they do not start a local
Supabase stack. Check the linked project before applying changes.

## Existing prototype database

The hosted database already has `events`, `projects`, and `announcements`
created outside migration history. New migrations must change that existing
state incrementally. In particular, assigning `association_id` requires
backfilling existing rows before making the column `NOT NULL`.

`20261031182358_association_model.sql` is the first forward-only change for the
existing prototype. It assumes the three content tables already exist and are
empty, as reported when this migration was prepared. The CLI reported that this
migration was successfully applied to the hosted project. It adds the
association model and tenant ownership; it is not a baseline that creates the
old tables.

Continue to inspect the remote migration history before each push. The initial
schema remains outside migration history, so a fresh database cannot be rebuilt
from this folder alone until a reviewed baseline for the original schema is
added. Do not mark a baseline as applied with `supabase migration repair`
unless its SQL exactly represents the schema already present in the hosted
project.

`20261031190850_bilingual_event_and_media_rules.sql` is a local follow-up for
paired bilingual fields, time-zone metadata, accessible image labels, member
link consent, event report references, and related policies. It has not been
applied to the hosted project. Review and push it only after confirming the
linked project and remote migration history.

`20261104075728_association_admin_management.sql` adds the transaction-safe,
service-role-only database operations used by the account administration
function to create an association with its first president and transfer a
presidency. It is also pending review and application; deploy the matching
`manage-users` Edge Function only after the migration is applied to the same
verified project.

`20261104080708_association_member_directory.sql` adds the bilingual member
profile constraint and atomic service-role-only membership/profile creation
used by president invitations. It follows the association-model migration and
must be applied before deploying the matching `manage-users` Edge Function.
Configure the `SITE_URL` Edge Function secret and Auth redirect allow list
before sending member invitations.
