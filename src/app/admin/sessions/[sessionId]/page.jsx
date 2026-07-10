import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionRecapData } from "@/lib/recapData";
import { getLatestSessionDraft } from "@/lib/newsroom/drafts";
import { SessionRecapDraftEditor } from "@/components/admin-newsroom/SessionRecapDraftEditor";

export const dynamic = "force-dynamic";

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function formatDate(value) {
  if (!value) return "Date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date pending";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function AdminSessionNewsroomPage({ params, searchParams }) {
  const { sessionId } = await params;
  const query = await searchParams;
  const cleanSessionId = typeof sessionId === "string" ? sessionId.trim() : "";

  if (!cleanSessionId) notFound();

  const sessionData = await getSessionRecapData(cleanSessionId);
  if (!sessionData) notFound();

  const latestDraft = await getLatestSessionDraft(sessionData.session.id);

  return (
    <main style={pageStyle}>
      <p style={eyebrowStyle}>Admin newsroom - unauthenticated</p>
      <h1 style={headingStyle}>{text(sessionData.session.session_code, "Session")} editorial draft desk</h1>
      <p style={bodyStyle}>
        Generate and edit public recap drafts from verified league data. The public session page keeps working separately until a draft is reviewed and intentionally wired into publishing.
      </p>

      <nav style={linkRowStyle} aria-label="Session links">
        <Link href={`/sessions-v2/${encodeURIComponent(text(sessionData.session.session_code || cleanSessionId))}`}>
          Public session recap
        </Link>
        <Link href="/sessions-v2">Session index</Link>
        <Link href={`/dev/session-data/${encodeURIComponent(text(sessionData.session.session_code || cleanSessionId))}`}>
          Debug data
        </Link>
      </nav>

      {query?.setup === "recap-drafts" ? (
        <p style={noticeStyle}>Run sql/20260710_newsroom_recap_workflow.sql in Supabase before generating drafts.</p>
      ) : null}

      <section style={summaryStyle}>
        <SummaryStat label="Date" value={formatDate(sessionData.session.played_at)} />
        <SummaryStat label="Players" value={String(sessionData.participants.length || "-")} />
        <SummaryStat label="Hands" value={text(sessionData.session.hands_count, "-")} />
        <SummaryStat label="Moments available" value={String(sessionData.notableHands.length || 0)} />
      </section>

      <SessionRecapDraftEditor
        sessionKey={text(sessionData.session.session_code || cleanSessionId)}
        initialDraft={latestDraft}
      />
    </main>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div style={statStyle}>
      <span style={statLabelStyle}>{label}</span>
      <strong style={statValueStyle}>{value}</strong>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: 32,
  background: "#f4f4f5",
  color: "#18181b",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
};
const eyebrowStyle = { margin: "0 0 8px", color: "#52525b", fontSize: 13, fontWeight: 800, textTransform: "uppercase" };
const headingStyle = { maxWidth: 900, margin: 0, fontSize: "clamp(32px, 6vw, 58px)", lineHeight: 1 };
const bodyStyle = { maxWidth: 860, margin: "14px 0 20px", color: "#52525b", lineHeight: 1.55 };
const linkRowStyle = { display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 24 };
const noticeStyle = { maxWidth: 920, padding: 12, background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e" };
const summaryStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  maxWidth: 980,
  margin: "0 0 24px",
};
const statStyle = { padding: 16, background: "#fff", border: "1px solid #d4d4d8", borderRadius: 8 };
const statLabelStyle = { display: "block", color: "#71717a", fontSize: 12, fontWeight: 800, textTransform: "uppercase" };
const statValueStyle = { display: "block", marginTop: 6, fontSize: 22 };
