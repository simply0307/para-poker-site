import Link from "next/link";
import { CardGrid, LeagueHero, MomentCard, PlayerCard, SessionCard, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { cleanName, formatDate, formatNumber, text } from "@/lib/newsroom/data";

export function HomepageModuleRenderer({ viewModel }) {
  return (
    <>
      {viewModel.modules.map((module, index) => (
        <HomeModule key={`${module.type}-${index}`} module={module} viewModel={viewModel} />
      ))}
    </>
  );
}

function HomeModule({ module, viewModel }) {
  if (module.type === "hero_board") return <HeroBoard module={module} viewModel={viewModel} />;
  if (module.type === "stat_strip") return <HomeStatStrip module={module} viewModel={viewModel} />;
  if (module.type === "latest_session") return <LatestSessionModule module={module} viewModel={viewModel} />;
  if (module.type === "upcoming_events") return <UpcomingEventsModule module={module} />;
  if (module.type === "current_standings") return <CurrentStandingsModule module={module} viewModel={viewModel} />;
  if (module.type === "featured_players") return <FeaturedPlayersModule module={module} viewModel={viewModel} />;
  if (module.type === "featured_moments") return <FeaturedMomentsModule module={module} />;
  if (module.type === "latest_articles") return <LatestArticlesModule module={module} />;
  return null;
}

function moduleTitle(module, fallback) {
  return text(module.title, fallback);
}

function moduleDek(module, fallback = "") {
  return text(module.dek, fallback);
}

function ModuleSection({ module, fallbackTitle, fallbackDek = "", children, className = "" }) {
  return (
    <section className={`mt-10 border-t border-white/10 pt-7 ${className}`}>
      {module.showSectionHeader !== false ? (
        <header className="mb-5 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(220px,420px)] md:items-end">
          <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{moduleTitle(module, fallbackTitle)}</h2>
          {moduleDek(module, fallbackDek) ? <p className="text-sm leading-6 text-stone-400">{moduleDek(module, fallbackDek)}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

function sessionHref(session) {
  return `/sessions/${encodeURIComponent(text(session?.session_code || session?.id))}`;
}

function articleHref(article) {
  return `/articles/${encodeURIComponent(text(article?.slug || article?.id))}`;
}

function eventDate(event) {
  return text(event.displayDate, event.startsAt ? formatDate(event.startsAt) : "Date pending");
}

function HeroBoard({ module, viewModel }) {
  const selection = module.resolvedContent?.[0] || {};
  const { latest, winner, biggestPot } = viewModel;
  const selectedSession = selection.kind === "session" ? selection.item : latest;
  const selectedArticle = selection.kind === "article" ? selection.item : null;
  const isLeagueBoard = selection.kind === "league_board" || module.variant === "league_board";
  const title = selectedArticle?.title || text(viewModel.hero?.title, "Para League");
  const dek = selectedArticle
    ? text(selectedArticle.body?.subheadline || selectedArticle.subheadline, "Published Para League coverage.")
    : text(viewModel.hero?.dek, "The first sessions are setting the board.");

  return (
    <LeagueHero
      eyebrow={text(viewModel.hero?.eyebrow, "Season 0 / Preseason / Current Board")}
      title={module.variant === "session_result" && selectedSession ? text(selectedSession.session_code, title) : title}
      dek={module.variant === "session_result" && selectedSession ? sessionResultDek(selectedSession, winner, biggestPot) : dek}
      aside={
        isLeagueBoard ? (
          <HeroBoardAside viewModel={viewModel} />
        ) : selectedArticle ? (
          <ArticleLeadAside article={selectedArticle} />
        ) : selectedSession ? (
          <SessionLeadAside session={selectedSession} winner={winner} biggestPot={biggestPot} />
        ) : (
          <p className="leading-7 text-stone-300">The first verified result will open the board.</p>
        )
      }
    >
      <div className="flex flex-wrap gap-3">
        {selectedArticle ? (
          <Link href={articleHref(selectedArticle)} className="rounded-sm bg-[#d8c087] px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#061019]">
            Read coverage
          </Link>
        ) : selectedSession ? (
          <Link href={sessionHref(selectedSession)} className="rounded-sm bg-[#d8c087] px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#061019]">
            Open session
          </Link>
        ) : (
          <Link href="/standings" className="rounded-sm bg-[#d8c087] px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#061019]">
            View board
          </Link>
        )}
        <Link href="/players" className="rounded-sm border border-[#d8c087]/30 px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#fff1bf]">
          Player archive
        </Link>
      </div>
    </LeagueHero>
  );
}

function sessionResultDek(session, winner, biggestPot) {
  const pieces = [
    winner ? `${cleanName(winner.player_name)} owns the result line` : "Coverage will appear after the result is reviewed",
    session?.hands_count ? `${session.hands_count} hands` : "",
    biggestPot?.pot_collected ? `${formatNumber(biggestPot.pot_collected)} biggest pot` : "",
  ].filter(Boolean);
  return pieces.join(" / ");
}

function SessionLeadAside({ session, winner, biggestPot }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d8c087]">Session report</p>
      <h2 className="text-2xl font-black text-white">{text(session.session_code, "Session")}</h2>
      <p className="text-sm leading-6 text-stone-300">{formatDate(session.played_at)}</p>
      <div className="grid gap-2 text-sm text-stone-300">
        <p>{winner ? `${cleanName(winner.player_name)} finished #${winner.finish || 1}.` : "Result pending review."}</p>
        <p>{session.hands_count ? `${session.hands_count} hands tracked.` : "Hand count pending."}</p>
        <p>{biggestPot?.pot_collected ? `${formatNumber(biggestPot.pot_collected)} chips at the top of the pot list.` : "Biggest pot pending."}</p>
      </div>
    </div>
  );
}

function ArticleLeadAside({ article }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d8c087]">Published coverage</p>
      <h2 className="mt-2 text-2xl font-black text-white">{article.title}</h2>
      <p className="mt-3 text-sm leading-6 text-stone-300">
        {[article.author || "Para League Desk", article.display_date ? formatDate(article.display_date) : ""].filter(Boolean).join(" / ")}
      </p>
    </div>
  );
}

function HeroBoardAside({ viewModel }) {
  const leader = viewModel.standings?.[0];
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d8c087]">Current board</p>
      <h2 className="mt-2 text-2xl font-black text-white">{leader ? cleanName(leader.player_name, "Leader pending") : "Board pending"}</h2>
      <p className="mt-3 text-sm leading-6 text-stone-300">
        {leader ? `${formatNumber(leader.total_points || leader.points || leader.league_points, "-")} points on the current line.` : "The first verified result will open the board."}
      </p>
    </div>
  );
}

function HomeStatStrip({ module, viewModel }) {
  if (module.variant === "hidden_support") return null;
  const compact = module.variant === "compact";
  return (
    <StatStrip>
      <StatCard label="Sessions" value={viewModel.sessions.length} />
      <StatCard label="Players" value={viewModel.players.length} />
      {!compact ? <StatCard label="Moments" value={viewModel.moments.length} /> : null}
      <StatCard label="Leader" value={cleanName(viewModel.standings[0]?.player_name, "Pending")} />
    </StatStrip>
  );
}

function LatestSessionModule({ module, viewModel }) {
  const session = module.resolvedContent?.[0] || viewModel.latest;
  if (!session) return <EmptyModule module={module} title="Latest Session" message="Coverage will appear after the result is reviewed." />;
  const isLatest = String(session.id) === String(viewModel.latest?.id) || String(session.session_code) === String(viewModel.latest?.session_code);
  const winner = isLatest ? viewModel.winner : null;
  const biggestPot = isLatest ? viewModel.biggestPot : null;

  if (module.variant === "result_strip") {
    return (
      <ModuleSection module={module} fallbackTitle="Latest Session" fallbackDek="The newest approved table result.">
        <Link href={sessionHref(session)} className="grid gap-3 rounded-md border border-[#d8c087]/16 bg-[#08111a]/78 p-4 md:grid-cols-4 md:items-center">
          <strong className="text-2xl font-black text-white">{text(session.session_code, "Session")}</strong>
          <span className="text-sm text-stone-300">{formatDate(session.played_at)}</span>
          <span className="text-sm text-stone-300">{winner ? cleanName(winner.player_name) : "Result reviewed on session page"}</span>
          <span className="text-sm text-[#fff1bf]">{session.hands_count ? `${session.hands_count} hands` : "Hands pending"}</span>
        </Link>
      </ModuleSection>
    );
  }

  return (
    <ModuleSection module={module} fallbackTitle="Latest Session" fallbackDek="The newest approved table result.">
      <div className={module.variant === "editorial_brief" ? "max-w-3xl" : ""}>
        <SessionCard href={sessionHref(session)} title={text(session.session_code, "Session")} meta={module.variant === "editorial_brief" ? "Editorial brief" : "Match report"}>
          <p>{winner ? `${cleanName(winner.player_name)} finished #${winner.finish || 1}.` : "The full session page carries the verified result."}</p>
          <p>{session.hands_count ? `${session.hands_count} hands` : "Hands pending"}</p>
          <p>{biggestPot?.pot_collected ? `${formatNumber(biggestPot.pot_collected)} biggest pot` : "The hand archive holds the full detail."}</p>
        </SessionCard>
      </div>
    </ModuleSection>
  );
}

function UpcomingEventsModule({ module }) {
  const events = module.resolvedContent || [];
  if (!events.length) {
    return (
      <EmptyModule
        module={module}
        title="Upcoming Tables"
        message="Future league events will appear here once the desk stages the next table."
      />
    );
  }

  if (module.variant === "schedule_strip") {
    return (
      <ModuleSection module={module} fallbackTitle="Upcoming Tables" fallbackDek="Future events staged by the league desk.">
        <div className="grid gap-2">
          {events.map((event) => (
            <EventStrip key={event.id} event={event} />
          ))}
        </div>
      </ModuleSection>
    );
  }

  const displayEvents = module.variant === "single_teaser" ? events.slice(0, 1) : events;
  return (
    <ModuleSection module={module} fallbackTitle="Upcoming Tables" fallbackDek="Future events staged by the league desk.">
      <div className={module.variant === "single_teaser" ? "max-w-3xl" : "grid gap-3 md:grid-cols-2"}>
        {displayEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </ModuleSection>
  );
}

function EventCard({ event }) {
  const body = (
    <article className="h-full rounded-md border border-[#d8c087]/16 bg-[#08111a]/78 p-5 shadow-lg shadow-black/20">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d8c087]">{text(event.status, "draft").replace(/_/g, " ")}</p>
      <h3 className="mt-2 text-2xl font-black text-white">{text(event.title, "Future table")}</h3>
      <p className="mt-3 text-sm leading-6 text-stone-300">{text(event.dek, "The next table will appear here once the desk stages it.")}</p>
      <div className="mt-4 grid gap-2 text-sm text-stone-400">
        <p>{eventDate(event)}</p>
        {event.venue ? <p>{event.venue}</p> : null}
      </div>
      {event.ctaHref ? <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-[#fff1bf]">{text(event.ctaLabel, "Event details")}</p> : null}
    </article>
  );

  return event.ctaHref ? <Link href={event.ctaHref}>{body}</Link> : body;
}

function EventStrip({ event }) {
  const body = (
    <div className="grid gap-2 rounded-md border border-white/10 bg-black/25 p-3 text-sm md:grid-cols-[130px_minmax(0,1fr)_auto] md:items-center">
      <span className="font-bold text-[#fff1bf]">{eventDate(event)}</span>
      <span className="text-stone-300">{text(event.title, "Future table")}</span>
      <span className="text-stone-400">{event.venue || text(event.status, "draft")}</span>
    </div>
  );

  return event.ctaHref ? <Link href={event.ctaHref}>{body}</Link> : body;
}

function CurrentStandingsModule({ module, viewModel }) {
  const rows = viewModel.standings.slice(0, module.itemLimit || 5);
  if (!rows.length) return <EmptyModule module={module} title="Current Board" message="The first verified result will open the board." />;
  const isTopThree = module.variant === "top_three";

  return (
    <ModuleSection module={module} fallbackTitle="Current Board" fallbackDek="Rank and points stay tied to verified standings.">
      <div className={isTopThree ? "grid gap-3 md:grid-cols-3" : "grid gap-2"}>
        {rows.slice(0, isTopThree ? 3 : rows.length).map((row) => (
          <Link
            key={row.id || row.player_id || row.player_name}
            href={row.player_id ? `/players/${encodeURIComponent(text(row.player_id))}` : "/players"}
            className={`grid gap-3 rounded-md border border-white/10 bg-white/[0.035] p-4 ${isTopThree ? "" : "grid-cols-[48px_minmax(0,1fr)_auto] items-center"}`}
          >
            <span className="text-lg font-black text-[#fff1bf]">#{text(row.rank, "-")}</span>
            <span className="min-w-0 text-white">{cleanName(row.player_name, "Player")}</span>
            <span className="text-sm text-stone-300">{formatNumber(row.total_points || row.points || row.league_points, "-")} pts</span>
          </Link>
        ))}
      </div>
      {module.variant === "pressure_watch" ? (
        <p className="mt-4 text-sm leading-6 text-stone-400">
          The board is live, not final. The next approved session can change the read.
        </p>
      ) : null}
    </ModuleSection>
  );
}

function FeaturedPlayersModule({ module, viewModel }) {
  const players = module.resolvedContent || [];
  if (!players.length) return <EmptyModule module={module} title="Players To Know" message="This player record begins with the next approved session." />;
  const gridClass = module.variant === "identity_rail" ? "grid gap-3" : "grid gap-3 md:grid-cols-3";

  return (
    <ModuleSection module={module} fallbackTitle="Players To Know" fallbackDek="Names carrying the early public record.">
      <div className={gridClass}>
        {players.map((player) => {
          const standing = viewModel.standings.find((row) => String(row.player_id) === String(player.id) || row.player_name === player.display_name) || {};
          return (
            <PlayerCard
              key={player.id}
              href={`/players/${encodeURIComponent(text(player.slug || player.id))}`}
              name={cleanName(player.display_name || player.pokernow_name)}
              meta={standing.rank ? `Rank ${standing.rank}` : "Public profile"}
            >
              <p>{standing.total_points ? `${standing.total_points} points on the current board.` : "Their public record begins with the next approved session."}</p>
            </PlayerCard>
          );
        })}
      </div>
    </ModuleSection>
  );
}

function FeaturedMomentsModule({ module }) {
  const moments = module.resolvedContent || [];
  if (!moments.length) return <EmptyModule module={module} title="Moments From The Archive" message="No moment has entered the archive from this session yet." />;

  if (module.variant === "compact_strip") {
    return (
      <ModuleSection module={module} fallbackTitle="Moments From The Archive" fallbackDek="Hands that left a visible mark.">
        <div className="grid gap-2">
          {moments.map((moment) => (
            <MomentStrip key={moment.momentId || moment.id || moment.hand_no} moment={moment} />
          ))}
        </div>
      </ModuleSection>
    );
  }

  return (
    <ModuleSection module={module} fallbackTitle="Moments From The Archive" fallbackDek="Hands that left a visible mark.">
      <CardGrid>
        {moments.slice(0, module.variant === "featured_moment" ? 1 : moments.length).map((moment) => (
          <MomentCard
            key={moment.momentId || moment.id || moment.hand_no}
            href={moment.detailHref || (moment.id ? `/moments/${encodeURIComponent(text(moment.id))}` : "")}
            title={moment.hand_no ? `Hand #${moment.hand_no}` : "Table moment"}
            meta={moment.typeLabel || cleanName(moment.winner_name, "Winner pending")}
            pot={moment.potText || (moment.pot_collected ? `${formatNumber(moment.pot_collected)} chips` : "")}
          >
            {moment.video?.signed_url ? (
              <span className="mb-3 block overflow-hidden rounded-sm border border-amber-300/25 bg-black">
                <video className="aspect-video w-full object-cover" src={moment.video.signed_url} muted playsInline preload="metadata" />
              </span>
            ) : null}
            <p>{text(moment.displaySummary || moment.summary || moment.winning_hand || moment.board, "No moment has entered the archive from this session yet.")}</p>
          </MomentCard>
        ))}
      </CardGrid>
    </ModuleSection>
  );
}

function MomentStrip({ moment }) {
  return (
    <Link
      href={moment.detailHref || (moment.id ? `/moments/${encodeURIComponent(text(moment.id))}` : "/moments")}
      className="grid gap-2 rounded-md border border-white/10 bg-black/25 p-3 text-sm md:grid-cols-[110px_minmax(0,1fr)_auto] md:items-center"
    >
      <span className="font-bold text-[#fff1bf]">{moment.hand_no ? `Hand #${moment.hand_no}` : "Moment"}</span>
      <span className="text-stone-300">{text(moment.displaySummary || moment.summary || moment.winner_name, "Archive note pending.")}</span>
      <span className="text-stone-400">{moment.potText || (moment.pot_collected ? `${formatNumber(moment.pot_collected)} chips` : "")}</span>
    </Link>
  );
}

function LatestArticlesModule({ module }) {
  const articles = module.resolvedContent || [];
  if (!articles.length) return <EmptyModule module={module} title="Latest Coverage" message="Coverage will appear after the result is reviewed." />;
  const [lead, ...briefs] = articles;

  return (
    <ModuleSection module={module} fallbackTitle="Latest Coverage" fallbackDek="Approved newsroom pieces from the league desk.">
      {module.variant === "lead_and_briefs" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <ArticleCard article={lead} lead />
          <div className="grid gap-3">{briefs.map((article) => <ArticleCard key={article.id || article.slug} article={article} />)}</div>
        </div>
      ) : (
        <div className={module.variant === "three_column" ? "grid gap-3 md:grid-cols-3" : "grid gap-3"}>
          {articles.map((article) => <ArticleCard key={article.id || article.slug} article={article} />)}
        </div>
      )}
    </ModuleSection>
  );
}

function ArticleCard({ article, lead = false }) {
  return (
    <Link href={articleHref(article)} className={`block rounded-md border border-white/10 bg-black/20 p-4 hover:border-[#d8c087]/45 ${lead ? "md:p-6" : ""}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">
        {[article.author || "Para League Desk", article.display_date ? formatDate(article.display_date) : ""].filter(Boolean).join(" / ")}
      </p>
      <h3 className={`mt-2 font-bold text-white ${lead ? "text-3xl" : "text-xl"}`}>{article.title}</h3>
      {article.body?.subheadline || article.subheadline ? (
        <p className="mt-3 text-sm leading-6 text-stone-400">{article.body?.subheadline || article.subheadline}</p>
      ) : null}
    </Link>
  );
}

function EmptyModule({ module, title, message }) {
  if (module.enabled === false) return null;
  return (
    <ModuleSection module={module} fallbackTitle={title}>
      <p className="max-w-3xl rounded-md border border-white/10 bg-black/20 p-4 leading-7 text-stone-300">{message}</p>
    </ModuleSection>
  );
}
