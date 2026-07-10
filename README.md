# Para-Poker Site

Next.js frontend for Para-Poker player profiles. Supabase provides player,
stat, and standing data on the server side. Plasmic controls the visual player
profile template.

## Development

On Windows PowerShell, run:

```powershell
npm.cmd run dev
```

Then open http://localhost:3000.

## Routes

- `/players` is the player directory.
- `/players/[slug]` is the clean public player URL and redirects to the Plasmic profile route.
- `/plasmic-profile/[slug]` renders the dynamic player profile with Supabase data and the Plasmic template.
- `/plasmic-host` is the Plasmic Studio host route. Keep it available for Plasmic editing.
- `/plasmic/*` is the Plasmic catchall route and is still present for now.

## Data And Templates

Supabase access is server-side only through `src/lib/supabase.js`. Do not import
that client into browser components.

The profile page fetches the Plasmic `PlayerProfileTemplate` component and maps
Supabase values into the existing Plasmic layer names. Do not rename those layers
without also updating the prop mapping.
