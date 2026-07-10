import { notFound } from "next/navigation";
import SessionRecapPage from "@/components/session-recap-v2/SessionRecapPage";
import { getSessionRecapData } from "@/lib/recapData";
import { supabase } from "@/lib/supabase";

export const revalidate = 60;

export async function generateStaticParams() {
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, session_code");

  if (error || !sessions) {
    return [];
  }

  return sessions
    .map((session) => session.session_code)
    .filter(Boolean)
    .map((sessionId) => ({ sessionId: String(sessionId) }));
}

export async function generateMetadata({ params }) {
  const { sessionId } = await params;
  const sessionData = await getSessionRecapData(sessionId);

  if (!sessionData) {
    return {
      title: "Para Poker Session Recap",
    };
  }

  return {
    title: `${sessionData.session.session_code || "Session"} | Para Poker Recap`,
    description: sessionData.recaps.session.summary,
  };
}

export default async function NativeSessionRecapRoute({ params }) {
  const { sessionId } = await params;
  const cleanSessionId = typeof sessionId === "string" ? sessionId.trim() : "";

  if (!cleanSessionId) {
    notFound();
  }

  const sessionData = await getSessionRecapData(cleanSessionId);

  if (!sessionData) {
    notFound();
  }

  return <SessionRecapPage sessionData={sessionData} />;
}
