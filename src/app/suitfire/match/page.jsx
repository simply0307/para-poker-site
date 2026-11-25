import Link from "next/link";
import { notFound } from "next/navigation";
import SuitFireFrame from "../SuitFireFrame";
import { PublishedArticle } from "@/components/newsroom/NewsroomShell";
import { getPublishedDraft } from "@/lib/newsroom/repositories/draftRepository";
import { draftHeadline, draftHtml, draftParagraphs, draftSubheadline } from "@/lib/newsroom/rendering";
import { approvedMatch } from "@/lib/suitfire/league";

export const dynamic = "force-dynamic";

export default async function DuelReport({ searchParams }) {
  const { sessionId } = await searchParams;
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(sessionId)) notFound();
  const match = await approvedMatch(sessionId);
  if (!match) notFound();
  const story = await getPublishedDraft({ scope: "session", sourceSessionId: sessionId });
  const title = match.players.map(player => player.name).join(" vs. ");
  return <SuitFireFrame section="seasons">
    <Link href="/suitfire" className="underline">SuitFire Para League</Link>
    <h1 className="mt-5 text-3xl font-bold">{title}</h1>
    <p>{match.season} · {new Date(match.playedAt).toISOString().slice(0, 10)}</p>
    <ul className="my-5">{match.players.map(player => <li key={player.seat}>{player.name} · {player.faction || "Classic"} · {player.result} · {player.finalLife} final life</li>)}</ul>
    {story ? <PublishedArticle title={draftHeadline(story, title)} subheadline={draftSubheadline(story)} paragraphs={draftParagraphs(story)} html={draftHtml(story)} /> : <p>Reath coverage has yet to be published for this match.</p>}
  </SuitFireFrame>;
}
