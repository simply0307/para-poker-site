# Consumer identity proposal — UNAPPLIED

Historical Phase 1 proposal. The project has since been restored with user
permission and audited. See the [Phase 2 audit and reconciled migration](eggs-phase2-identity-audit.md)
for verified facts, differences, disposable test evidence and the still-unapplied
SQL candidate. The original proposal below is retained for comparison.

Date: 2026-09-22. Review design only. No consumer tables, policies, migrations,
triggers, endpoints, cookies, onboarding or claim writes were implemented.
The existing Supabase project `uzderzjbitmghfvrllvz` reports INACTIVE; its original
schema and live RLS/grants cannot yet be verified. SQL is deliberately deferred
until actual FK types, grants and deployed schema are known.

## Identity and ownership

```text
auth.users.id
  -> profiles.auth_user_id          existing operator role; unchanged
  -> eggs_profiles.auth_user_id     proposed consumer owner (unique)
       -> para_poker_profile_links  explicit reviewed association
            -> players.id          existing detailed league record
```

Use independent stable UUIDs for public EGGS profile identity. Never expose an
Auth UUID as a public account identifier. Names, email, PokerNow names and slugs
may aid a human review; none establishes ownership or forms a durable join key.
Later projects get their own typed FK associations, not a polymorphic text ID
with unenforced references. The existing Gauntlet evidence importer remains a
league operation and does not establish a Gauntlet account association.

## Proposed tables

| Table | Proposed fields and constraints |
| --- | --- |
| `eggs_profiles` | `id uuid` PK; `auth_user_id uuid NOT NULL UNIQUE` FK to `auth.users.id`; canonical `handle text NOT NULL UNIQUE`; `display_name text`; `avatar_path text`; bounded `bio text`; `visibility` constrained to `private` or `public`, default `private`; server-maintained `created_at`, `updated_at` |
| `eggs_profile_preferences` | `profile_id uuid` PK/FK to `eggs_profiles.id`; explicit, validated owner-only preference columns when a concrete setting exists; no speculative JSON feature store |
| `para_poker_profile_links` | `profile_id uuid` PK/FK to `eggs_profiles.id`; `player_id` NOT NULL UNIQUE FK to the actual `players.id` type; `verified_at`; `verified_by_auth_user_id` FK to Auth; `show_on_profile boolean NOT NULL DEFAULT false` |
| `para_poker_player_claims` | `id uuid` PK; `claimant_profile_id` FK; `player_id` FK; constrained `status` (`pending`, `approved`, `rejected`, `withdrawn`); submission/review timestamps; reviewer Auth FK; private bounded evidence reference and decision reason |

The first consumer milestone needs the profile and reviewed link, not every
optional field or a preferences editor. Profile songs, music, library/artifact
relationships and social features remain future extensions. Poker rank, points,
hands, stats, league achievements and game state stay out of `eggs_profiles`.

Handle proposal: 3–30 characters, lowercase ASCII letters/digits/underscore,
validated and reserved-name checked by one server operation. Normalize before
the database unique constraint. A handle is a changeable URL label, never a
foreign key. Decide alias retention before enabling handle changes. Validate
presentation lengths and avatar paths; user input cannot set arbitrary storage
ownership, Auth identity, verification fields, roles or timestamps.

Proposed deletion behavior: deleting an Auth account removes its consumer
profile, preferences and public association but never a Poker player or league
evidence. A linked player's deletion is restricted pending explicit review.
Review-history retention/anonymization and reviewer deletion require a concrete
policy before final FK actions are selected. Do not silently cascade away an
ownership decision or retain private claim evidence indefinitely.

## Access matrix to prove before implementation

| Operation | Anonymous | Signed-in profile owner | Other consumer | Existing league operator |
| --- | --- | --- | --- | --- |
| Read public profile DTO | Public fields only | Public fields | Public fields | Same public projection |
| Read private profile/preferences | Denied | Own only | Denied | No blanket consumer access |
| Create profile | Denied | One for verified Auth UUID | Cannot create for another user | No operator-only onboarding dependency |
| Update presentation/preferences | Denied | Own allowlisted fields only | Denied | No blanket consumer edit permission |
| Submit/read claim | Denied | Own submission/status | Denied | Review queue through existing operator guard |
| Approve/transfer association | Denied | Denied | Denied | Explicit audited transaction |
| Read public Poker summary link | Only when profile public and `show_on_profile` | Own summary allowed | Public projection only | Same public projection |

Enable RLS and explicit grants on every new table. Owner predicates compare
`auth.uid()` with `auth_user_id` (or an indexed profile FK); writes require both
`USING` and `WITH CHECK` as applicable. Do not allow owner updates to ownership,
verification or role columns. Index FK columns used by policies and review
queries; a unique constraint already provides an index on its columns.

RLS controls rows, not sensitive columns. Keep Auth IDs, preferences and claim
evidence out of public responses. Use an explicitly allowlisted public DTO and
column grants or a carefully checked projection; do not expose the base profile
table with a broad `SELECT *` grant. If a view is used, verify invoker security,
underlying permissions and anon/authenticated behavior. Avoid an owner-rights
view or general service-role endpoint that bypasses the intended policy.

Future `requireEggsUser()` may share `verifyAccessToken()` with operators but
must accept ordinary authenticated users without querying `profiles.role` or
minting `para_league_operator`. Use a request-scoped, user-token data client for
consumer queries so RLS applies. The existing league service client is not a
consumer repository. Define email verification/anonymous-account requirements,
refresh/logout, cookie scope and CSRF handling before enabling sessions.

## Reviewed player claims

1. Verify the consumer's Auth identity and resolve their own profile server-side.
2. Accept a stable player ID and bounded private supporting evidence. Display
   names/slugs are lookup aids only; do not auto-link from an email or name match.
3. Store an owner-visible pending claim. Deduplicate a profile/player's pending
   requests and make retries idempotent. Consumers cannot set review outcomes.
4. A reviewer passes existing `requireOperator()`. A restricted transaction
   locks the claim and relevant identities, rechecks status and conflicting
   links, then inserts the association and records the decision atomically.
5. Unique constraints on both profile and player prevent competing approvals.
   A conflict rolls back; it never silently replaces the current owner.
   Transfers/revocations require a separately recorded review transaction.
6. The EGGS profile later shows an authorized summary and links to the existing
   full `/para/poker/players/[playerId]` dossier. Stats remain sourced from the
   league repositories. Hiding the association does not alter league evidence.

An approval RPC must not trust caller-supplied reviewer IDs. Derive them from
verified identity, constrain execution grants and `search_path`, and prove all
alternate write paths cannot bypass the review. Idempotency and concurrent
approval tests are required in a disposable environment before applying SQL.

## Exact live verification blockers

1. **Schema and identity:** actual `profiles` and `players` DDL, PK/FK types,
   uniqueness, nullability, deployed migrations, `auth_user_id` backfill state,
   duplicate/conflicting mappings and orphan records. Repository fixtures are
   inferred and cannot establish these facts.
2. **Privileges:** table/column/schema/function grants, anon/authenticated and
   service-role behavior, exposed schemas, all RLS policies, security-definer
   functions, views and triggers. In particular, prove a consumer cannot assign
   an operator role, change a reviewed owner or read private claim material.
3. **Auth lifecycle:** signup/provider settings, email confirmation, anonymous
   Auth users, JWT/session expiry, refresh/revocation, redirect allowlist and
   production host/cookie behavior using actual test accounts.
4. **Storage and deletion:** existing avatar/media buckets, object ownership,
   path validation and policies; account/player/reviewer deletion effects and
   agreed claim evidence retention.
5. **Real application compatibility:** live operator login and role lookup,
   public dossier parity, existing import/publication RPCs and their policies.
   This phase proves local route and denial behavior, not live workflows.

Once the existing project is accessible, complete the read-only audit, finalize
the schema and access matrix, and test migrations/rollback/concurrency in a
confirmed disposable environment. Deployment or migration application remains
a separate action. The next milestone is only authentication -> profile ->
reviewed player link -> summary -> detailed league dossier.

Design references: [Supabase user-data relationships](https://supabase.com/docs/guides/auth/managing-user-data),
[Data API security and explicit grants](https://supabase.com/docs/guides/api/securing-your-api).
