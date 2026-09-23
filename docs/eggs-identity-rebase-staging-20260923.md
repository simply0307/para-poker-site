# PR #2 production-baseline rebase and staging verification

## Current checkpoint

PR #2 is rebased onto production PR #3 / `629e5b48cd2524a60940079bf95dccb40e59372a`. Production deployment, production Auth configuration, and the consumer migration remain unchanged. Hosted consumer verification is incomplete; this is not a launch approval.

The rebase preserves the seven generation guards and relocates the production Gemini client without changing its bytes. It still uses `GOOGLE_GEMINI_BASE_URL`, the `x-goog-api-key` header, and the existing provider/model selection. The only conflict resolutions concerned module import paths and duplicate imports. Production's generation-handler and Gemini routing regression tests were retained and adapted to the relocated files.

The additive candidate is unchanged: `20260922231308_eggs_consumer_identity_reviewed_claims.sql`, SHA-256 after LF normalization `4413c817e9bd5e0473e093e4c3894c18ffc4f6fcfe8a1a702d7a8ad6a37aa292`. No retention/timeout/hold infrastructure was reintroduced.

## Fresh validation

| Check | Result |
| --- | --- |
| `npm test` | 103 passed, 0 failed, 1 inherited opt-in remote-import skip |
| Native disposable PostgreSQL 17 | All 18 identity scenarios plus parent passed; no identity skips |
| `npm run build` | Passed with Next 16.3.6 |
| `npm run lint` | Passed |
| Training, homepage, Para import, stats validators | All four passed |
| `npm audit --omit=dev --json` | Zero production dependency vulnerabilities |
| `npm audit --json` | Zero vulnerabilities including development dependencies |
| Production Gemini parity | Exact source-byte parity after LF normalization and relocation |

The database suite includes RLS, anon/owner/unrelated/operator behavior, canonical and concurrent handle reservations, claim submission/withdrawal, real concurrent competing approvals, account deletion, full rollback, and legacy schema/data/mapping preservation. The HTTP suite exercises all protected methods and separates consumer/operator sessions.

## Rebased hosted deployment

The existing staging site `d538177f-1890-4894-8efa-7b7b3bb117b4` published commit `b3bd5fba841072094c60a36030421802d9158a69` at 2026-09-23 20:18:25 UTC. Deploy ID: `6ab433efa6e4efe4f0984c38`; URL: https://eggs-consumer-staging.netlify.app. Its isolated Supabase target remains `xokrweqdvkfcexczsewl`. One staging build was requested, with 251.9 of 300 Free-plan included credits remaining beforehand and no payment method or paid add-on. Subsequent documentation-only commits do not require another deployment.

Fresh anonymous requests on this deployment passed: all seven generation POST endpoints returned 401 with `no-store`; consumer profile and claim GET endpoints returned 401 with `private,no-store`; `/login` and `/para/poker` returned 200. These checks did not call an AI provider or create drafts. They do not replace authenticated hosted verification.

A read-only production check still found no `public.eggs_profiles` and eight historical migrations. Production deploy `6ab427a6c3b8490008f671c6` remains the verified `629e5b4` baseline. No production deployment or Auth change was performed.

## Hosted security findings

Existing staging Supabase `xokrweqdvkfcexczsewl` is ACTIVE_HEALTHY on PostgreSQL 17.6. It retains the two staging migration entries, one synthetic player, one consumer profile, one staging operator, two claims and zero approved links at the initial checkpoint. Auth configuration dry-run found no differences in the locally declared staging settings; it wrote nothing.

**Function execution:** Staging does not contain production's `public.rls_auto_enable()` or `ensure_rls`. The checked-in [transactional rehearsal](../tests/database/rls-auto-enable-staging-rehearsal.sql) refuses production/non-fixture targets and refuses to replace existing functions/triggers. It cloned the exact production function/trigger inside a staging transaction, reproduced its grants, and tested:

```sql
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
```

Both roles' direct calls were denied; service-role execution remained; the owner remained postgres; the function definition was unchanged; the trigger remained enabled; a new public probe table automatically enabled RLS. The transaction rolled back. Follow-up confirmed no probe/function/trigger remained and staging application counts were unchanged. This is a successful hosted rehearsal, not a production grant change or another consumer migration.

**Leaked passwords:** The live staging security advisor reports protection disabled. Supabase's [password-security documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) requires Pro or above for the built-in feature. It cannot be marked enabled or verified under the current $0 constraint. No upgrade or substitute check was introduced. This remains a launch-security decision/blocker.

## Hosted consumer flow still required

The previous real staging account is already confirmed. Its earlier signup/email delivery, login, profile privacy changes, and claim submission/withdrawal have evidence, but the PKCE callback was not proven. Reusing its consumed confirmation link cannot fix that. Supabase's [default SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp) also prevent assuming that an arbitrary new alias can receive mail.

A fresh signup requires either explicit permission to reset only the existing disposable staging identity/profile, preserving durable claims and handle reservations, or an unused accessible address that the configured sender permits. Preserve the existing test identity until that choice is made. The password and confirmation link stay out of reports/chat. The user must complete credential entry and click the new confirmation link in the same browser that submits signup.

After confirmation, verify callback/session establishment, password login, profile creation, private/public and unrelated-user visibility, direct user-token PostgREST/RLS, synthetic player claim and operator review, hidden-default link, explicit Poker-summary opt-in, token refresh, logout, and old-session/token denial. Do not mark local fixture results as hosted passes.

## Production rollout boundary

The detailed rollout in [the implementation report](eggs-consumer-identity-implementation.md#remaining-blockers-and-exact-production-rollout-sequence) remains conditional on completed hosted evidence, canonical EGGS domain selection, SMTP readiness, the leaked-password decision, and explicit production authorization. Preserve production baseline `629e5b4`; never deploy the pre-hotfix Para baseline as a rollback. Gauntlet and Reath remain untouched.
