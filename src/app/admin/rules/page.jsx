import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { LeagueRulesForm } from "@/components/admin-newsroom/LeagueRulesForm";
import { previewStandingsFromRules, readLeagueRules } from "@/lib/league/rulesRepository";
import { readSeasonSettings } from "@/lib/newsroom/seasonSettings";

export const dynamic = "force-dynamic";

export default async function AdminRulesPage() {
  const seasonSettings = await readSeasonSettings();
  const result = await readLeagueRules(seasonSettings.activeSeasonCode);
  const standings = await previewStandingsFromRules(result.rules);

  return (
    <AdminShell
      title="Rules admin"
      description={`Control ${seasonSettings.activeSeasonCode} scoring by updating session result points and rebuilding the standings table.`}
    >
      <LeagueRulesForm
        initialRules={result.rules}
        initialStorage={result.storage}
        initialWarning={result.warning}
        initialStandings={standings}
      />
    </AdminShell>
  );
}
