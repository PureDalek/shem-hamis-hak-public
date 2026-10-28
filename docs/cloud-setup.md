# Optional cloud setup for name game

The app works without an account. This integration adds an opt-in cloud backup and a protected editor that can publish catalog/settings revisions. It requires a Supabase project and a deployed app URL. The code and database policies have been tested locally with PostgreSQL and a minimal simulated authentication schema; they still need an end-to-end test against the actual Supabase project before enabling cloud access for visitors.

## Create and configure the project

1. Create a project on a suitable free Supabase plan and review its current limits. Use a separate project for development and production when possible.
2. Apply `supabase/migrations/202610280001_initial.sql` in the project's SQL editor or through the Supabase CLI. The migration creates `user_backups`, `site_content`, `content_revisions`, an admin membership table and restrictive access policies.
3. In Supabase Auth, configure the site URL and allowed redirect URLs for the actual deployed site and any deliberate local development URL. Enable email magic links and configure a suitable email sender for the intended traffic. Test delivery to a real address.
4. Add the project's **URL** and **publishable (or legacy anon) key** as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the hosting provider's build environment, then rebuild. For local development, copy `.env.example` to `.env.local` and fill the values. These two values are public in browser code; access is controlled by the database policies. Never put a secret or service-role key in a `VITE_` variable or source control.
5. Sign in once through the app. In the Supabase Auth user list, copy the exact UUID of the account that should manage content. In the project's privileged SQL editor, run the following with that UUID substituted:

   ```sql
   insert into public.admin_users(user_id)
   values ('00000000-0000-0000-0000-000000000000'::uuid);
   ```

   The all-zero UUID is a placeholder, not a working admin ID. Admin membership can only be changed through a privileged database connection, never through the browser client.
6. Reopen the app, sign in as the admin, and open the local editor. Review the catalog and settings and publish the first shared revision. Future publications are checked against the revision seen when the editor was opened; if someone else published first, refresh and review before retrying. The history list restores an earlier snapshot by publishing a new revision.

## Verify before enabling

Run `npm test`, `npm run build`, and, with Docker running, `npm run test:db`. The last command starts an isolated temporary PostgreSQL container, applies the migration with a test auth fixture, exercises access boundaries and stops its container. It does not provision or alter the hosted project.

On a private test deployment connected to the real Supabase project, additionally verify:

- Sign in using the real email flow and save, recover and delete a test backup on a second browser/device.
- A second signed-in account cannot read, alter or delete the first account's backup.
- A non-admin account and an anonymous visitor cannot publish, list revision history or grant themselves administration; a designated admin can publish and restore, and a stale publication is rejected.
- A new visitor sees the published catalog and settings after reload; an offline or unavailable database falls back to the bundled catalog.

Only enable public use after these checks pass. An individual explicitly chooses when to upload or restore a backup; uploads replace the previous backup for that account and do not merge concurrent device changes. Users can also export a local backup from the profile. Cloud publication includes catalog entries and game settings, never a user's search decisions or family names.

## Operational notes

- Published content is public; personal backups have user-specific row-level policies. Secret and service-role keys bypass those protections and must remain server-side.
- Existing local editorial overrides take precedence on that browser. A newer published revision updates default game settings when the app next loads, while a manager's local content draft remains local until publication.
- A site with no valid published content or an unreachable database uses its bundled catalog. The source remains deployable to ordinary static hosting.
- Review Supabase project backups and retention separately from the in-app revision history. That history covers catalog/settings, not user backups.
