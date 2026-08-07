# Admin operator authorization

The league uses Supabase Auth as its identity authority. A verified
`auth.users.id` is linked to exactly one `public.profiles.auth_user_id`; runtime
authorization never accepts email, form fields, headers claiming a role, user
metadata, or browser-local state as proof of operator status.

Only the existing `admin` and `owner` profile roles may use the privileged admin
surface. Other authenticated roles receive 403. Missing or invalid credentials
receive 401. A profile lookup failure fails closed with 503.

## Request boundary

1. The browser signs in to Supabase Auth with the public URL and publishable key.
2. `/api/operator-session` verifies the access token using `auth.getUser` and
   then resolves the profile by stable Auth UUID using the server-only client.
3. A successful operator session is stored in an HttpOnly, Secure (production),
   SameSite=Strict cookie for at most one hour.
4. Every exported method under `/api/admin/**` independently repeats token and
   profile-role verification before its repository is invoked.
5. `/admin` has an additional layout and Proxy gate for coherent UI behavior.
   These are defense in depth and are not the API security boundary.

Required runtime variables are `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and
the server-only `SUPABASE_SERVICE_ROLE_KEY`. The first two are intentionally
browser-safe. The service key must remain restricted to server build/functions
scopes and must never use a `NEXT_PUBLIC_` or `VITE_` prefix.

## Privileged route inventory

There are no intentionally public handlers under `/api/admin/**`.

Read-only privileged methods:

- `GET /api/admin/homepage-settings`
- `GET /api/admin/imports/sessions/[sessionId]/results`
- `GET /api/admin/moment-curation`
- `GET /api/admin/newsroom/dataset/export` (also retains its advanced export token)
- `GET /api/admin/page-heroes`
- `GET /api/admin/prompt-presets`
- `GET /api/admin/public-copy`
- `GET /api/admin/rules`
- `GET /api/admin/season-settings`
- `GET /api/admin/training-examples`
- `GET /api/admin/upcoming-events`

Mutating privileged methods:

- `POST, DELETE /api/admin/articles/[articleId]/video`
- `PUT /api/admin/homepage-settings`
- `POST /api/admin/imports/eggs-sessions/preview`
- `POST /api/admin/imports/eggs-sessions/commit`
- `POST /api/admin/imports/raw-hands/preview`
- `POST /api/admin/imports/raw-hands/commit`
- `PATCH, DELETE /api/admin/imports/sessions/[sessionId]`
- `POST, PUT /api/admin/imports/sessions/[sessionId]/results`
- `PUT /api/admin/moment-curation`
- `POST, DELETE /api/admin/moments/[momentId]/video`
- `PUT /api/admin/page-heroes`
- `POST /api/admin/prompt-presets`
- `DELETE /api/admin/prompt-presets/[presetId]`
- `PUT /api/admin/public-copy`
- `PATCH, DELETE /api/admin/recap-drafts/[draftId]`
- `POST /api/admin/recap-drafts/[draftId]/publish`
- `POST /api/admin/rules`
- `PUT /api/admin/season-settings`
- `PATCH, POST /api/admin/training-examples`
- `PUT /api/admin/upcoming-events`

## Database migration and rollback

`sql/20260807_admin_operator_authorization.sql` is additive: it adds the nullable
foreign-key column and a partial unique index, then bridges the existing eligible
profile to its matching existing Auth user once. RLS, grants, policies, evidence
triggers, and import RPCs are unchanged.

If the application commit is first rolled back, this migration alone can be
reversed with:

```sql
begin;
drop index if exists public.profiles_auth_user_id_key;
alter table public.profiles drop column if exists auth_user_id;
commit;
```
