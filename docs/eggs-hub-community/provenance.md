# EGGS Hub community update: brand and publication provenance

Reviewed October 20, 2026. This document records the assets and destinations used
by the local implementation. It is internal review evidence, not a publication,
rights clearance, production deployment, or account-linking decision. No asset
was copied, modified, uploaded, published, or re-permissioned while preparing
this inventory.

## Existing project marks

Both newly checked-in PNG marks were supplied from existing local project files,
visually inspected by the parent implementation, and copied without changing
their bytes. Source-to-repository SHA-256 equality was rechecked for this record.
An original artist, standalone third-party license, or broader commercial scope
cannot be inferred from a file name or a matching hash. The user's request
authorizes development with the existing project marks; production release
remains separately gated.

| Identity | Verified source | Repository asset | Dimensions / bytes | SHA-256, identical for source and copy |
| --- | --- | --- | --- | --- |
| Reath Digest | `C:/Users/gjoep/Downloads/reathdigest.png` | `public/brand/reath-digest.png` | 1024 × 1024 / 1,019,099 bytes | `000bf1581e3f9908b4bb334b4c1441d0e7482b943c9e4778fd0c0985af56d614` |
| Gauntlet | `C:/Users/gjoep/Downloads/gauntlet.png` | `public/brand/gauntlet.png` | 2508 × 2508 / 1,071,855 bytes | `9d470de00b67f21f63196ef47d619c85cb527b6fff4ab2b267be72448250c4e0` |

`src/lib/hub/destinations.mjs` selects these marks by their stable project UUID,
not by a user-supplied title. `StudioProject`, `ProjectPresentation`, and room
showcases use the shared registry. The Digest reader uses the Reath mark with
meaningful image alternative text, rather than generating an imitation logo.

The Reath PNG contains a baked checkerboard in its RGB pixels. It was not treated
as genuine transparency, background-removed, recolored, retraced, or exported as
a new derivative. `src/app/reath.css` places the unchanged image on a light plate
with a clipped fixed-height presentation and `object-fit: cover`.
`src/app/product.css` applies a corresponding centered display crop on project
cards. This changes the visible viewport only; the source bytes and full image
remain preserved. Gauntlet uses contained responsive display sizing. These
presentational crops are recorded rather than misrepresented as transparent
master artwork.

## Para identities stay distinct

The existing Para Poker League wordmark remains
`public/images/para-wordmark.svg`, SHA-256
`470c035ece6af18ec7cdd222a4a0218e7d57e7af30a0280260c91fcbd84ac34b`.
It is used for Para League references, not as an EGGS, Reath, or Gauntlet logo.
Its existing SVG geometry is retained; CSS changes only its display sizing and
the light background needed for the dark mark.

The separate Poker client identifies as **ParaPoker / Prelaunch**. The parent
audit received HTTP 200 from `https://eggspoker.netlify.app` on October 20, 2026,
with the title **ParaPoker Prelaunch** and friends-only/play-money presentation.
Its source-observed code-native `P` and `ParaPoker` identity is represented by
`src/components/hub/PokerClientMark.jsx`, with the explicit descriptor
`PLAY-MONEY / PRELAUNCH`. This Hub component renders that existing identity using
text and CSS; it is not a newly supplied image master or a byte-for-byte copy of
the client's application file. No external client code, mark, authentication,
tables, invitations, or game behavior was edited. This is a source-observed
representation, not a new official image logo. The Hub does not rename the
live client into a released EGGS game or imply that an EGGS account grants access.

Exact source evidence: `C:/Users/gjoep/OneDrive/Documents/parapoker official client/src/App.tsx:105`
renders the `app-brand` with the label `ParaPoker play-money client`, a text `P`,
`ParaPoker`, and `Competition client`; `src/index.css:114` in that client defines
its native styling. Matching strings were observed in the deployed bundle
`https://eggspoker.netlify.app/assets/index-BpybokYI.js` on October 20. The new Hub
renderer adds the explicit prelaunch descriptor; no source client file changed.

## EGGS master mark and original ornament

A verified EGGS master logo suitable for this application was not available in
the audited sources. `StudioShell.jsx` therefore keeps the literal **EGGS** text
masthead. The previously encountered “EGGS corporate type logo” spells
**Eternal Galaxy** and is not substituted for EGGS. No invented master logo,
unapproved faction artwork, or fictional logo attribution was introduced.

`public/brand/eggs-initial.svg` is a deterministic text-only **E** site icon in
the existing cream/green palette. It identifies the browser tab and avoids a
missing default favicon request. It is an interface ornament, not a recovered
EGGS master or a newly declared official brand mark. Para Poker retains its own
existing favicon through its nested layout metadata.

The two studio treatments and room ornaments are CSS/SVG interface work. Existing
original deterministic work assets and their hashes, source records, and site-use
permission remain inventoried in
[`../eggs-personal-internet/provenance.json`](../eggs-personal-internet/provenance.json).
Their presence in the asset registry is not evidence that a Reath publication
exists. The Digest reader lists actual published snapshots only.

## Reath publication authority and private media

The publishing hierarchy was grounded in these private operational sources,
which are retained in documentation only:

- [Reath Publishing Architecture — Operational v1](https://docs.google.com/document/d/1zcEW-ZRrCrcfhmHF9OpAAUtHncGxOao4RRO0QEF3eIY/edit):
  Digest is the publishing and distribution container for news, essays, comics,
  Funnies, video adaptations, archives, and approved community contributions.
  Reath Wire and the ingester are editorial tools, not the reader-facing Digest.
- [Reath Funnies — Operational dossier](https://docs.google.com/document/d/1jqEmB_ttoRbDfiEM27db_kHBQ2O-VhzhHV09ytr7Xm0/edit):
  literal Reath Funnies identification, clear fiction-within-fiction framing,
  creator attribution or chosen anonymity, rights, and editorial acceptance are
  required. Digest hosting does not promote depicted events into governing canon.
- [AGENT-0093 — A Natural Choice Editorial Decision Packet](https://docs.google.com/document/d/17Xr2qb88vlZIWIZpSbt1Epw4wV4H1n5B0fZB9XeGlW4/edit):
  the existing video/panel package is private and not approved for publication or
  release. Its rights, consent, captions, identity/fiction notice, editorial and
  final-file gates remain unresolved.

Actual private media located in the Animation Archive includes A Natural Choice,
Moon Bars, and Short-form Memes. Inspected metadata reports `shared:false` and
`source_visibility_status:not_shared`. The detailed folder IDs and inventory
are in [`reath-sources.md`](reath-sources.md). No private file, Drive URL, comic
panel, MP4, source item, or editorial draft was copied into the public asset
tree, reader JSON, HTML, metadata, or embedded page payload.

The reader's only content source is anonymous `publicWorks()` published
snapshots with the exact Reath project UUID
`a0000000-0000-4000-8000-000000000004`, registered assets, a publication timestamp,
and verified `site-public` provenance. Works keep their real public creator
credit and canonical `/library/[slug]` detail with source/permission information.
Formats are article, issue, comic, Reath Funnies, and video; older five-key work
records retain a generic Publication label. Video entries require a nonempty
canonical approved YouTube or Vimeo watch URL. These are validated public links,
not a private-file storage integration.

No cleared public Reath release catalog was found in the audited sources.
Therefore an empty shelf is shown honestly until the existing explicit
publisher workflow releases a Reath-associated work. Ingested Stories and source
items remain private evidence objects; a source count, an internal route such as
`funnies`, a filename such as `final`, or a community post never publishes them.
Community posts and official Digest publications have separate authority.

## Destinations and current release meaning

These are the existing production destinations recorded by the portal and prior
read-only verification, together with the local application routes. The parent
audit's October 20 Poker-client HTTP 200 and title observation establish its
reader-facing prelaunch identity, not an end-to-end login, billing, game, or
backend health result. A separate web-reader attempt on October 20 could not
retrieve the four hosted sites; that tool limitation is not evidence that the
destinations are down. No new end-to-end availability claim is made for the other
hosted applications by this inventory.

| Surface | Destination | Accurate meaning in this implementation |
| --- | --- | --- |
| EGGS Hub and community | Local preview routes `/`, `/community`, `/people`, `/profile` | Development with disposable local data and simulated Auth for automated tests. Consumer/community production rollout remains disabled; no canonical production EGGS Auth origin is designated. |
| Para Poker League | `/para/poker`; existing production site `https://parapokerleague.netlify.app` | Existing league, evidence, imports, stats, dossiers, newsroom, operator Auth and Gemini pipeline are preserved. Local module routing does not authorize deploying the EGGS shell or replacing the current production site. |
| Gauntlet Online | `https://gauntlet-online.vercel.app` | Independent existing game destination. Accounts, matches, progression and access remain under its own application. A Hub favorite or community account is not an account link or game migration. |
| Poker client | `https://eggspoker.netlify.app` | Friends-only ParaPoker play-money prelaunch, with its own existing accounts/invitations. The Hub labels it Playtest/prelaunch; this hostname is not the canonical EGGS Auth origin. |
| Reath Digest reader | `/reath-digest` | Local reader for actual released Reath-associated works. `/projects/reath-digest` redirects here when the published project is available. The old editorial-site URL is not the reader CTA. |
| Reath Wire / editorial site | `https://reath-digest.netlify.app` | Existing separate invitation-controlled editorial entry point. No newsroom, ingestor, editorial Auth, database, publication release, deployment or access configuration was changed. |

The old reviewed Hub migration/bootstrap retains its historical Reath destination
data. `readerProject()` and `projectDestination()` in
`src/lib/hub/destinations.mjs` supply the new reader projection by stable UUID.
This corrects the public navigation without rewriting a reviewed predecessor
migration, mutating a hosted catalog, or redirecting the Reath editorial service.

Production migration, deployment, canonical origin/SMTP/security review, hosted
isolation verification, and any actual editorial release remain explicit later
gates. This provenance inventory authorizes none of those actions.
