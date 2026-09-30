# Existing-account email sign-in and staging security continuation

PR #2 remains based on production `629e5b48cd2524a60940079bf95dccb40e59372a`. This continuation adds the user-requested email sign-in option for the existing confirmed staging account. Production migration, production deployment, production Auth settings and consumer rollout remain unchanged. Gauntlet and Reath are untouched.

## Application change

The sign-in form can send an email link without a password. The Auth route calls Supabase `signInWithOtp` with `shouldCreateUser:false`, the configured exact `/auth/callback` URL, and the existing SSR PKCE storage. It neither creates an account nor changes its password. Password sign-in and signup remain available. Unknown accounts and dispatched links share the same public status/message; provider rate limits remain 429 and unexpected failures become a sanitized 503. Caller-supplied redirects and extra fields are rejected. The callback itself is unchanged.

The new HTTP coverage verifies CSRF denial, field allowlists, the S256 challenge, a one-hour HttpOnly verifier cookie, no session on link request, missing-verifier denial, one-time code exchange, fixed redirect, existing profile preservation, and consumer/operator session separation. Fixture callback success is not hosted email evidence.

Only two development dependency lock entries changed: `brace-expansion` 1.1.18 to 1.1.21 and 5.0.9 to 5.0.12. These are patched versions in the [maintainer advisory](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr). No production dependency or Gemini configuration changed.

## Migration and production preservation

There is no migration diff in this continuation. The existing unapplied production candidate remains `20260922231308_eggs_consumer_identity_reviewed_claims.sql`, LF-normalized SHA-256 `4413c817e9bd5e0473e093e4c3894c18ffc4f6fcfe8a1a702d7a8ad6a37aa292`. Claims have no automatic expiration; evidence, decisions and permanent handle reservations remain durable. No retention, timeout, hold, redaction or worker machinery was added.

The relocated Gemini client still matches production exactly after LF normalization. Regression coverage retains all seven generation guards. The production Netlify site still points to deploy `6ab427a6c3b8490008f671c6`; no production mutation was performed.

## Independent hosted user and RLS results

Twenty-eight checks passed against the existing isolated staging Supabase `xokrweqdvkfcexczsewl` and its current hosted application. A disposable admin-confirmed Auth fixture obtained a real authenticated user token, without a legacy operator mapping. Its self-asserted owner metadata did not grant privileges. This fixture tests RLS, not email delivery or confirmation.

The unrelated user could create its own private profile but could not read another private profile, claims, evidence or hidden Poker link; modify that profile or summary opt-in; impersonate its claimant; withdraw or review its claim; or load the operator queue. Operator-session creation and all seven generation requests returned 403 before any AI call. The original owner could still read their private profile, and explicitly public presentation became visible after the owner's visibility was restored.

Before/after fingerprints matched for the original operator mapping, players, claim/review history, evidence and approved links. The original consumer profile's content and identity were preserved; privacy-test updates advanced its update timestamp. Disposable Auth users and profiles were cleaned up. Their two handles remain permanently retired, as designed. Final staging counts: one Auth user, one consumer profile, one operator, one synthetic player, two claims, one approved link and three permanent handle reservations. Neither disposable Auth user remains.

An initial harness expectation incorrectly treated direct `evidence_note` column access as a zero-row result. The real grant correctly rejects that column with 42501. The assertion was corrected; the successful run explicitly requires that denial. No database grant or application change was made to accommodate the test.

## Validation and hosted email checkpoint

Final validation passed: `npm test` reported 104 passed, zero failed and one inherited opt-in remote-import skip (105 records). All 18 native PostgreSQL identity scenarios plus their parent passed, including RLS, competing approvals, handle races, deletion, rollback and legacy preservation. Build, lint and all four validators passed. Full and production-only dependency audits both report zero vulnerabilities.

An intermediate validation run overlapped a rebuild with HTTP tests that use `.next`, making that run invalid. The completed build was then held stable for the passing full-suite run above. No application change was needed for those intermediate failures.

The existing real staging account is preserved. Prior hosted evidence covers signup/confirmation, password login, refresh, profile creation/privacy, claim submission/withdrawal, operator approval, explicit Poker-summary opt-in, logout and invalidated session/token replay. The independent unrelated-user gap is now closed. Do not reuse old consumed links or substitute an admin-generated link for delivery evidence.

The real email flow subsequently reached a successful PKCE exchange: staging Auth logs record `/otp` HTTP 200 at 04:49:48 and 04:55:07 UTC, followed by `/token` with `grant_type=pkce`, action `login`, HTTP 200 at 04:55:24. Verified `/user` calls returned 200 afterward. The original Auth user and consumer profile IDs, confirmation timestamp, two claims and opted-in approved association remain unchanged; the latest sign-in and new session timestamp match that exchange. No account was recreated.

End-to-end browser session persistence remains unresolved. The user later reached an expired/invalid-link page; a later `/verify` event exists at 04:56:43, but the logs alone do not prove which link was opened or why the browser lost access. At 04:57–04:59, the supplied public profile displayed the intended synthetic Poker summary, while a fresh navigation to the private `/profile` editor redirected to login. Do not label the public page or the successful exchange alone as a complete persistent-browser-session pass.

One user-authorized retry at 04:59:47 returned HTTP 429 with `over_email_send_rate_limit`; the UI displayed the wait message. No new email was sent for that retry. Stop repeated requests until the email allowance recovers; do not change Auth rate limits, SMTP, passwords, accounts, or billing to bypass it. No deploy or code change was required for this diagnostic continuation.

The user subsequently chose a supported $0 custom SMTP setup, created a Resend account and saved its API key directly in staging Supabase. Resend's live Usage page confirmed Transactional Free, 0/100 daily and 0/3,000 monthly usage before testing; pay-as-you-go switches were disabled and off. No card, paid feature, domain purchase, Netlify deploy or new database was introduced by the agent.

Only staging project `xokrweqdvkfcexczsewl` was configured. The non-secret sender and SMTP username were completed through its dashboard without changing the saved password. Because the dashboard rendered these fields empty after reload, an independent read-only `supabase config pull --dry-run` verified the actual remote settings: SMTP enabled, sender `onboarding@resend.dev`, sender name `EGGS Staging`, host `smtp.resend.com`, port 465, username `resend`, and an email limit of 30/hour. The key was not read, printed, committed or replaced. No production Auth setting changed.

This uses Resend's own-account-only test sender, so delivery is restricted to the email associated with the Resend account; it does not establish production SMTP readiness or choose a canonical EGGS domain. One new request through the existing staging UI succeeded at 05:12:09 UTC (`/otp` HTTP 200). Resend's Emails page reported **Delivered** for that sign-in message. The agent stopped for the user to open it once in the same browser; persistent authenticated browser access after that click remains the next check. See [Resend's test-domain restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) and [Free-plan pricing and caps](https://resend.com/docs/knowledge-base/what-is-resend-pricing).

Netlify billing was checked before deployment: 236.1 of 300 included credits remained, Free plan $0, no payment card, and no overage charges. One build was explicitly triggered for the existing staging site `d538177f-1890-4894-8efa-7b7b3bb117b4`, branch `codex/eggs-shell`. Deploy `6abc9446416488a79c1d834b` published runtime commit `e967bb5e9a9d44a2f8d06609ea53feffd6ac8c70` at 2026-09-30 04:47:33.737 UTC. No paid resource, upgrade or credit purchase was made. Documentation-only follow-ups do not need another deploy.

Eleven post-deploy checks passed at 04:49 UTC: login and `/para/poker` returned 200, the new sign-in control was present, all seven anonymous generation POSTs returned 401 with `no-store`, and both consumer profile and Poker-claim endpoints rejected anonymous access with 401. The browser also displayed the new email-link option. A fresh production deployment lookup still returned `6ab427a6c3b8490008f671c6`. No AI generation occurred in these security checks.

## Remaining production gates

Built-in leaked-password protection remains unavailable under the strict $0 requirement; it is not a passed check. The exact `rls_auto_enable()` EXECUTE revocation already passed a hosted transactional rehearsal with automatic RLS preserved and everything rolled back. Production grants remain unchanged. See the [previous hosted report](eggs-identity-rebase-staging-20260923.md#hosted-security-findings).

After persistent browser access following the real email callback is verified, launch still needs the canonical EGGS production origin and SMTP readiness, resolution of leaked-password protection, and explicit authorization for the migration, production grants/Auth settings, deployment and consumer enablement. The legacy Poker hostname must not become the permanent EGGS Auth origin.

Follow the [exact conditional rollout sequence](eggs-consumer-identity-implementation.md#remaining-blockers-and-exact-production-rollout-sequence): re-audit production and checkpoint it; apply the existing additive candidate once with consumers disabled; verify legacy data/mappings and deploy the shell disabled; verify real Para data and protected newsroom routes under `/para/poker`; apply separately approved security/Auth settings; enable consumers only with launch authorization. Before database commit, rollback is transactional. After commit, disable consumer access and preserve profiles, reservations, claims, evidence and links while fixing forward. An app rollback must retain baseline `629e5b4`'s guards and Gemini gateway and does not undo committed database changes.
