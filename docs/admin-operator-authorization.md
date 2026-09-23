# Admin operator authorization

The league uses Supabase Auth as its identity authority. A verified
`auth.users.id` is linked to exactly one `public.profiles.auth_user_id`; runtime
authorization never accepts email, form fields, headers claiming a role, user
metadata, or browser-local state as proof of operator status.

Only the existing `admin` and `owner` profile roles may use the privileged admin
surface. Other authenticated roles receive 403. Missing or invalid credentials
receive 401. A profile lookup failure fails closed with 503.

These are **Para Poker League operations**, not universal EGGS administration.
Source ownership is explicit in `src/app/admin/(para-poker)` and
`src/app/api/(para-poker)` while all operational URLs remain stable.
The role lookup and cookie contract live in `src/modules/para-poker/lib/auth`;
shared `src/lib/auth/verifiedIdentity.js` verifies identity only.

## Request boundary

1. The browser signs in to Supabase Auth with the public URL and publishable key.
2. `/api/operator-session` verifies the access token using `auth.getUser` and
   then resolves the profile by stable Auth UUID using the server-only client.
3. A successful operator session is stored in an HttpOnly, Secure (production),
   SameSite=Strict cookie for at most one hour.
4. Every exported method under `/api/admin/**` and every generation POST
   independently repeats token and profile-role verification before parsing
   input, invoking a repository or calling a provider.
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
- `GET /api/admin/player-claims`
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
- `POST /api/admin/imports/gauntlet-matches/preview`
- `POST /api/admin/imports/gauntlet-matches/commit`
- `POST /api/admin/imports/raw-hands/preview`
- `POST /api/admin/imports/raw-hands/commit`
- `PATCH, DELETE /api/admin/imports/sessions/[sessionId]`
- `POST, PUT /api/admin/imports/sessions/[sessionId]/results`
- `PUT /api/admin/moment-curation`
- `POST, DELETE /api/admin/moments/[momentId]/video`
- `PUT /api/admin/page-heroes`
- `POST /api/admin/player-claims/[claimId]/review`
- `POST /api/admin/player-claims/[claimId]/hold`
- `POST /api/admin/prompt-presets`
- `DELETE /api/admin/prompt-presets/[presetId]`
- `PUT /api/admin/public-copy`
- `PATCH, DELETE /api/admin/recap-drafts/[draftId]`
- `POST /api/admin/recap-drafts/[draftId]/publish`
- `POST /api/admin/rules`
- `PUT /api/admin/season-settings`
- `PATCH, POST /api/admin/training-examples`
- `PUT /api/admin/upcoming-events`

Operator-protected generation methods (all POST):

- `/api/articles/generate`
- `/api/moments/generate`
- `/api/player-session-recaps/generate`
- `/api/profiles/generate` (editorial player copy, not consumer accounts)
- `/api/recaps/generate`
- `/api/social-captions/generate`
- `/api/standings/generate`

`GET` and `POST /api/operator-session` also require operator authorization.
`DELETE /api/operator-session` only expires the caller's cookie and intentionally
requires no operator role. No repository or provider is invoked there.

Operator inventory: 34 API paths, 52 methods, 51 protected methods. Consumer
`/api/eggs/**` routes are counted separately and do not use operator authorization.
The new claim routes additionally use the verified operator's user-token client
and a fresh database role/session check; no service client writes the decision.
See the [consumer identity report](eggs-consumer-identity-implementation.md).
The static inventory
and built-app HTTP tests enumerate every exported method, checking rejection
before work, anonymous 401 and non-operator 403. Dataset export retains both its
operator cookie and independent export token; its bearer token is not reused as
an Auth token. Successful privileged mutations are not exercised against live data.

## Database migration and rollback

This is historical league migration documentation, not part of the EGGS shell
change. The current phase preserves `profiles.auth_user_id` and applies no SQL.

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
