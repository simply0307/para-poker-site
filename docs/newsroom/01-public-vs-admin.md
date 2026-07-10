# Public vs Admin

Public UI may show:

- session codes
- player names
- hand numbers
- approved standings
- published recaps, profiles, articles, summaries, and blurbs
- polished waiting states when no draft is approved

Public UI must not show:

- UUIDs
- raw source IDs
- database field names
- model names
- prompt metadata
- fallback traces
- source fact dumps
- draft status
- generation errors

Admin UI may show:

- context packets
- docs included
- story plans
- provider and model used
- generation logs
- fallback traces
- confidence notes
- missing data warnings
