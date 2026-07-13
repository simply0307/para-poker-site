# Controlled Presentation Modularity Notes

These notes describe future public-page presentation controls that should stay
inside the Para Poker design system. They are intentionally not a page builder.

## Player Profiles

Allowed future controls:

- `heroVariant`: `identity_card`, `record_first`, `featured_moment`
- `featuredMomentId`: one approved/public moment
- `profileHeadline`: authored public headline
- `profileDek`: short authored public dek
- `visibleSections`: approved keys only
- `sectionOrder`: approved keys only
- `featuredSessionId`: one public session
- `avatarSource`: stored public player image or monogram fallback

Approved section keys:

- `snapshot`
- `current_form`
- `player_story`
- `featured_moment`
- `recent_sessions`
- `records`
- `what_to_watch`

Locked in code:

- verified rank
- verified points
- verified stats
- sessions
- hands
- moments
- player identity matching

## Session Pages

Allowed future controls:

- `heroVariant`: `coverage_first`, `result_first`, `moment_first`
- `featuredMomentId`: one public moment from the session
- `selectedRecapDraftId`: one published/public recap
- `visibleSections`: approved keys only
- `sectionOrder`: approved keys only
- `whatComesNext`: optional reviewed editorial copy

Approved section keys:

- `recap`
- `results`
- `participants`
- `key_moments`
- `hand_history`
- `standings_context`
- `what_comes_next`

Locked in code:

- session identity
- participants
- results
- hand count
- notable hand data
- hand actions
- standings facts

## Moments Index

Allowed future controls:

- `featuredMomentIds`: approved/public moments only
- `introCopy`: reviewed public intro
- `itemLimit`
- `variant`: `archive_clippings`, `featured_and_index`, `compact_index`
- `ordering`: `newest`, `featured_first`

Locked in code:

- detected moment facts
- public/published filtering
- hand numbers
- pot values
- winner/result data

## Articles Index

Allowed future controls:

- `featuredArticleIds`: published articles only
- `introCopy`: reviewed public intro
- `itemLimit`
- `variant`: `headline_list`, `lead_and_briefs`, `three_column`
- `ordering`: `newest`, `featured_first`

Locked in code:

- unpublished drafts remain hidden
- article route structure
- title/body rendering
- author/date formatting

## Storage Boundary

Future presentation settings should be stored through dedicated read/write
repository functions, not read directly from components. Local filesystem JSON is
acceptable for staging. Production should move to Supabase or another durable
store without changing public renderers.
