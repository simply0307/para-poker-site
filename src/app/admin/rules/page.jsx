import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { LeagueRulesForm } from "@/components/admin-newsroom/LeagueRulesForm";
import { previewStandingsFromRules, readLeagueRules } from "@/lib/league/rulesRepository";

export const dynamic = "force-dynamic";

export default async function AdminRulesPage() {
  const result = await readLeagueRules("S0");
  const standings = await previewStandingsFromRules(result.rules);

  return (
    <AdminShell
      title="Rules admin"
      description="Control league scoring by updating session result points and rebuilding the standings table."
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
