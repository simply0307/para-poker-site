import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { HomepageSettingsForm } from "@/components/admin-newsroom/HomepageSettingsForm";
import { PageHeroSettingsForm } from "@/components/admin-newsroom/PageHeroSettingsForm";
import { SeasonSettingsForm } from "@/components/admin-newsroom/SeasonSettingsForm";
import { getPlayersIndex, getSessionsIndex, formatDate } from "@/lib/newsroom/data";
import { readHomepageSettings } from "@/lib/newsroom/homepageSettings";
import { readPageHeroSettings } from "@/lib/newsroom/pageHeroSettings";
import { readSeasonSettings } from "@/lib/newsroom/seasonSettings";
import { getPublishedArticlesIndex } from "@/lib/newsroom/repositories/draftRepository";
import { listNewsroomDrafts } from "@/lib/newsroom/drafts";
import { readUpcomingEventsSettings } from "@/lib/newsroom/upcomingEvents";
import { buildMomentsViewModel } from "@/lib/newsroom/viewModels/moments";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [homepageSettings, pageHeroSettings, seasonSettings, eventsSettings, sessions, players, momentModel, articles, socialCaptions] = await Promise.all([
    readHomepageSettings(),
    readPageHeroSettings(),
    readSeasonSettings(),
    readUpcomingEventsSettings(),
    getSessionsIndex(),
    getPlayersIndex(),
    buildMomentsViewModel(),
    getPublishedArticlesIndex(),
    listNewsroomDrafts({ table: "social_caption_drafts", fallbackScope: "social_caption", visibility: "published", limit: 50 }),
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
    events: (eventsSettings.events || []).map((event) => ({
      id: event.id,
      label: event.title || "Future event",
      description: [event.displayDate || (event.startsAt ? formatDate(event.startsAt) : ""), event.venue, event.status].filter(Boolean).join(" / "),
    })),
    socialCaptions: (socialCaptions || []).map((caption) => ({
      id: caption.id,
      label: caption.draft?.headline || caption.draft?.caption || "Social caption",
      description: caption.draft?.caption || caption.generated_at || "",
    })),
  };

  return (
    <AdminShell
      title="Settings"
      description="League-wide controls for the public homepage, season status, default prompt configs, and provider diagnostics."
    >
      <div className="grid gap-8">
        <SeasonSettingsForm initialSettings={seasonSettings} />
        <HomepageSettingsForm initialSettings={homepageSettings} selectionOptions={selectionOptions} />
        <PageHeroSettingsForm initialSettings={pageHeroSettings} />
      </div>
    </AdminShell>
  );
}
