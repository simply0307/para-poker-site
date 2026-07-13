import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { HomepageSettingsForm } from "@/components/admin-newsroom/HomepageSettingsForm";
import { PageHeroSettingsForm } from "@/components/admin-newsroom/PageHeroSettingsForm";
import { getPlayersIndex, getSessionsIndex, formatDate } from "@/lib/newsroom/data";
import { readHomepageSettings } from "@/lib/newsroom/homepageSettings";
import { readPageHeroSettings } from "@/lib/newsroom/pageHeroSettings";
import { getPublishedArticlesIndex } from "@/lib/newsroom/repositories/draftRepository";
import { buildMomentsViewModel } from "@/lib/newsroom/viewModels/moments";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [homepageSettings, pageHeroSettings, sessions, players, momentModel, articles] = await Promise.all([
    readHomepageSettings(),
    readPageHeroSettings(),
    getSessionsIndex(),
    getPlayersIndex(),
    buildMomentsViewModel(),
    getPublishedArticlesIndex(),
  ]);
  const moments = momentModel.publicMoments || [];
  const selectionOptions = {
    sessions: (sessions || []).map((session) => ({
      id: session.session_code || session.id,
      label: session.session_code || `Session ${session.session_number || session.id}`,
      description: [formatDate(session.played_at), session.hands_count ? `${session.hands_count} hands` : ""].filter(Boolean).join(" / "),
    })),
    players: (players || []).map((player) => ({
      id: player.slug || player.id,
      label: player.display_name || player.pokernow_name || "Player",
      description: player.slug || player.id,
    })),
    moments: moments.map((moment) => ({
      id: moment.id || moment.momentId || moment.hand_id || String(moment.hand_no || ""),
      label: moment.hand_no ? `Hand #${moment.hand_no}` : moment.title || "Moment",
      description: [moment.potText, moment.displaySummary || moment.summary || moment.winner_name].filter(Boolean).join(" / "),
    })),
    articles: (articles || []).map((article) => ({
      id: article.slug || article.id,
      label: article.title || "Published article",
      description: [article.author, article.display_date ? formatDate(article.display_date) : ""].filter(Boolean).join(" / "),
    })),
  };

  return (
    <AdminShell
      title="Settings"
      description="League-wide controls for the public homepage, season status, default prompt configs, and provider diagnostics."
    >
      <div className="grid gap-8">
        <HomepageSettingsForm initialSettings={homepageSettings} selectionOptions={selectionOptions} />
        <PageHeroSettingsForm initialSettings={pageHeroSettings} />
      </div>
    </AdminShell>
  );
}
