# Production owner and newsroom verification

Checkpoint: September 23, 2026, 18:49 UTC. Production remains the legacy
`parapokerleague.netlify.app` deploy `6a88df898ba41e0008ee7240`, source commit
`ca431bb734fab97c8da1dfeae0d515cf2ac1305f`. PR #2 remains at the separately
pushed `dda1b1d`; no deployment, migration or consumer launch was performed.
The expected `/para/poker` production 404 is not a reason to deploy early.

## Results

| Requested check | Result |
| --- | --- |
| Original production owner authorization | PASS: user signed in; protected admin screens loaded; original owner identity and profile mapping remain intact. |
| Existing admin/newsroom data | PASS for dashboard, session list/desks, saved S0-001 recap, import library, player list and standings draft desk. |
| One real draft-only AI smoke | FAILED: one S0-002 Generate Draft request reached Gemini and was rejected for an invalid API key. No retry or substitute provider. |
| Actual provider/model | Provider: Google Gemini. Requested model: `gemini-2.5-flash-lite`. No model successfully generated output. |
| Preserve publication, results and evidence | PASS: all 42 public-table row fingerprints matched before/after; all 26 pre-existing draft rows matched individually. |
| Anonymous generation denial | FAILED: deployed generation handlers lack operator guards; previous same-deployment probes returned 400/500, not 401. |

## Owner identity and protected reads

The live `profiles.auth_user_id` relationship still links operator profile
`b04d22ff-dfa4-4bb4-ae72-e028f3b7326d` (role `owner`) to Auth user
`b4a05c86-36d6-4bb7-ab6b-d853d2beccc8`, display name `simply`. Its confirmed
email was verified and provided to the user in chat; no credential is included
here. Auth records the successful sign-in at `2026-09-23T18:42:37.485496Z`.
There is still exactly one mapped operator. No account or mapping was replaced.

Verification used the signed-in browser's protected admin pages and the exact
deployed admin layout: it verifies the cookie's token with Supabase `getUser`,
then resolves `profiles.auth_user_id` and permits only admin/owner roles. A fresh
anonymous `/admin` GET redirected to `/operator-login` (307), and anonymous
`GET /api/operator-session` returned 401. An attempted direct navigation to the
authenticated session JSON endpoint was blocked by the browser client; the
owner conclusion rests on the protected layout and live identity mapping, not
on a claimed successful inspection of that JSON response.

Read-only UI checks showed:

- Three S0 session desks, including S0-002 with two players and 29 hands.
- Existing S0-001 published recap content and metadata loaded unchanged. Its
  historical `gemini-3.5-flash` label is not the model selected for today's test.
- Import control room loaded four sessions, 365 hands, 2,350 actions and 114
  notable hands; the displayed coverage audit marked all four sessions Ready.
- All seven existing player entries loaded, including preserved proof players.
- Standings draft desk loaded its existing saved editorial piece.
- Draft Studio remains an MVP navigation page, not a combined saved-draft queue.

These are read/render checks. No import, replacement, metadata save, stat
recalculation, backfill, result confirmation, draft edit, publish or unpublish
control was used. The UI's Ready labels do not substitute for an end-to-end
import/write acceptance test on disposable data.

The local password-recovery helper was stopped after the user's successful
production sign-in; its port is no longer listening. Password entry/recovery
was user-operated. The agent did not read a password or change project Auth
configuration.

## Single real AI attempt

In the authenticated production browser, opened
`/admin/sessions/S0-002` and clicked **Generate Draft** exactly once, using its
existing default Official Session Recap / Turning point led settings. The editor
invoked production `POST /api/recaps/generate` with existing session evidence.
The deployed handler builds the real packet and sends the model request; this
was not a stub or local simulation.

Observed UI failure:

> Gemini API request failed: API key not valid. Please pass a valid API key.

The returned fallback trace contained one failed model:
`gemini-2.5-flash-lite`. Deployed source sends this request to Google's
`generativelanguage.googleapis.com` API. That error is produced from the
provider's non-success response, rather than from the application's missing-key
check. No fallback model or second generation action was attempted.

No draft was saved, so there is no new draft ID, validated AI output or completed
generation to approve. Existing provider adapters and historical drafts remain
unchanged. Do not describe this as a successful AI-generation test.

The exact credential origin remains unresolved. The earlier readable Netlify
site/shared/build environment metadata did not establish a manually configured
provider key. Netlify can automatically inject provider API keys together with
gateway base URLs. The deployed raw REST code ignores a gateway base URL and
calls Google directly. A gateway-key/direct-endpoint mismatch is therefore a
possible explanation, not a proven root cause. Verify the effective credential
source and paired endpoint before rotating anything or selecting a replacement
provider. See [Netlify's gateway environment behavior](https://docs.netlify.com/build/ai-gateway/overview/#how-it-works).
Do not enable paid usage, buy credits or create a new provider subscription.

## Anonymous generation protection remains a release blocker

At 18:38:48 UTC, before the successful owner login, seven anonymous `{}` POSTs
against the same published deployment produced:

| Endpoint | HTTP |
| --- | ---: |
| `/api/recaps/generate` | 400 |
| `/api/profiles/generate` | 400 |
| `/api/articles/generate` | 500 |
| `/api/standings/generate` | 500 |
| `/api/social-captions/generate` | 500 |
| `/api/moments/generate` | 500 |
| `/api/player-session-recaps/generate` | 500 |

Inspection of all seven exact deployed handlers confirmed they lack
`requireOperator` / `withOperatorAuthorization`. Validation/provider failures
are not an authentication boundary. No further anonymous generation probes were
sent during this signed-in verification. The guarded PR candidate's earlier
401 results must not be presented as deployed production protection.

## Preservation and remaining approvals

The checkpoint covered every current public table: 42 row counts and sorted-row
MD5 fingerprints, taken after owner sign-in and again after the smoke/read checks.
All matched. Individual fingerprints of all 26 existing `recap_drafts` also
matched (13 approved, 13 draft). This includes operator mappings, Poker client
authority, preserved archive objects, hands/actions, imports, evidence revisions,
sessions, results, stats, standings and publication records. It is row-preservation
evidence, not a database backup or a claim about external provider/platform logs.

Remaining production work requires separately approved changes:

1. Deploy a narrowly scoped generation-authorization fix to the existing league
   release. Preserve its current public routes; do not deploy the whole EGGS
   branch merely to remove the expected `/para/poker` 404. Recheck anonymous
   denial and existing owner access against the actual deployed fix.
2. Resolve the production Gemini credential/endpoint configuration. Do not expose
   the key, silently switch providers/models, or activate billable infrastructure.
   After the approved repair, authorize and run one fresh draft-only smoke;
   record the new draft ID, provider/model, private status and preservation checks.
3. Continue the previously documented Para acceptance and EGGS staging/security/
   origin gates before any separately approved additive migration, deployment
   or consumer rollout. Gauntlet and Reath remain audit/design work only.

No application code, environment variable, Auth setting, migration, deployment,
league record or publication state was changed in this verification turn.
