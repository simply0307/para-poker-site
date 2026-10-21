# Reath Digest reader: source and release boundary

Audit date: October 20, 2026. This inventory is internal implementation evidence;
the private source identifiers below must never be copied into public page data.
No Reath repository, hosted service, editorial record, source file, or permission
was changed by this reader work.

## Reader destination

The existing Hub catalog's `reath-digest` project has ID
`a0000000-0000-4000-8000-000000000004`. Its old destination,
`https://reath-digest.netlify.app`, opens the Reath editorial shell, whose source
homepage links to `/wire`. It is not the public publications catalog requested
for EGGS. The EGGS reader destination is `/reath-digest`; Wire remains a separate
editorial tool and receives no new access or consumer identity mapping.

The reader queries the existing anonymous `publicWorks()` published-snapshot
surface only. It requires the exact Reath project association, a publication
timestamp, a registered asset and verified `site-public` provenance. It never
queries Reath Stories, source items, drafts, editorial queues, audits or Drive.
Published work details and source/permission credits remain at `/library/[slug]`.
The shelf DTO explicitly includes only ID, slug, title, summary, registered asset
ID, format, publication timestamp and public creator attribution.

Optional work formats are `article`, `issue`, `comic`, `funnies`, and `video`.
Older five-key work content remains valid and is labeled generically
“Publication”; it is not reclassified as journalism. Funnies appear on both the
Reath Funnies and Comics & Art shelves. Video releases require a canonical
approved HTTPS YouTube watch or Vimeo URL. The reader itself does not fetch or
embed remote media and does not expose private storage URLs.

## Governing publishing sources

- [Reath Publishing Architecture — Operational v1](https://docs.google.com/document/d/1zcEW-ZRrCrcfhmHF9OpAAUtHncGxOao4RRO0QEF3eIY/edit)
  defines Digest as the EGGS publishing hub containing news and essays, Reath
  Funnies, comics, video adaptations, archives and approved community work. Wire
  and its ingester are tools inside the editorial desk. Digest hosting does not
  promote depicted material into governing canon. Its Rumin magazine direction
  is a next draft, not evidence that the issue has been released.
- [Reath Funnies — Operational dossier](https://docs.google.com/document/d/1jqEmB_ttoRbDfiEM27db_kHBQ2O-VhzhHV09ytr7Xm0/edit)
  requires literal Reath Funnies identification, explicit fiction-within-fiction
  framing, creator attribution or chosen anonymity, rights clearance and editorial
  acceptance. It does not require a single stable Funnies visual identity.
- Local Reath source at
  `C:/Users/gjoep/OneDrive/Desktop/Reath Digest/docs/publication-domain.md`
  distinguishes evidence Stories from human-authored Publications and requires
  immutable reviewed releases. Its PR5–PR7 publication/CMS/public-renderer work
  is described as future architecture, not an enacted release catalog.
- The local Reath `AGENTS.md`, `README.md` and runtime documents retain their
  own database and editorial authority. This EGGS change does not alter that
  database, ingestor, Netlify functions, AI calls or migration plan.

## Actual media located, not cleared for this public shelf

Connected Drive reads found real media in the Reath Animation Archive
(`1J2YsvMIsgpJlG-yVvCVVFVjvBvkXGxdH`). These reads are an inventory, not
publication authorization. All inspected file metadata reports `shared:false`
and `source_visibility_status:not_shared`. No source link or private media bytes
are exposed by the reader.

| Private collection | Drive folder ID                     | Actual material                                                                          |
| ------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| Reath Funnies      | `1x6ESKLU31h4Dd3Rl9qBgh83Nu6lkyyrs` | Operational dossier; no public release catalog in this folder.                           |
| A Natural Choice   | `1Qnhb0NXIA63LVFo_ok1XtR2dRxADfDNh` | Five MP4 exports, two WAV files, two scene-video ZIPs, one 24-panel ZIP and timing CSVs. |
| Moon Bars          | `1l55l9vtIp1mrfoAzQLJlU_19K1OOvg5P` | Four MP4 exports, WAV, panel ZIP and corrected page PNGs.                                |
| Short-form Memes   | `1GjJ2II2NHlJeSShMZ8iDgkkIbvIikLuK` | Four MP4 exports; no verified release clearance located.                                 |

[AGENT-0093 — A Natural Choice Editorial Decision Packet](https://docs.google.com/document/d/17Xr2qb88vlZIWIZpSbt1Epw4wV4H1n5B0fZB9XeGlW4/edit)
explicitly identifies the package as private/internal and denies publication or
release authorization. It records unresolved creator/voice/audio/image rights,
consent, captions, identity, fictional notice, editorial acceptance and final-file
selection. File names such as `final` and `proper_timing` are not release decisions.
This implementation does not promote those sources or bypass those decisions.

No verified public release catalog or approved public video destination was found
in the audited sources. Therefore the page has useful collection/search controls
and honest empty states. Real publications populate it through the existing
explicit publisher workflow, with their Reath project association and actual
credit/permission records. Community posts remain separate from official Digest
publication.

## Branding

The reader uses `/brand/reath-digest.png`, the existing Digest logo supplied and
visually verified by the parent implementation from
`C:/Users/gjoep/Downloads/reathdigest.png`. It remains byte-for-byte unchanged,
including its baked checkerboard, on a light logo plate. No fictional faction
artwork, private comic panel or generated imitation logo was used by this task.
Public deployment/release remains separately gated.
