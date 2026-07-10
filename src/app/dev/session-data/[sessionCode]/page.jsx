import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function sanitizeForDebug(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeForDebug);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (/secret|token|password|key/i.test(key)) {
          return [key, "[redacted]"];
        }

        return [key, sanitizeForDebug(entry)];
      })
    );
  }

  return value;
}

async function safeQuery(label, query) {
  const { data, error, count } = await query;

  if (error) {
    return {
      label,
      data: null,
      count: null,
      error: error.message,
    };
  }

  return {
    label,
    data,
    count: count ?? null,
    error: null,
  };
}

async function safeCount(label, table, sessionId) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  return {
    label,
    count: error ? null : count ?? 0,
    error: error?.message || null,
  };
}

export default async function DevSessionDataPage({ params }) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { sessionCode } = await params;
  const cleanSessionCode =
    typeof sessionCode === "string" ? sessionCode.trim() : "";

  if (!cleanSessionCode) {
    notFound();
  }

  const sessionResult = await safeQuery(
    "session",
    supabase
      .from("sessions")
      .select("*")
      .ilike("session_code", cleanSessionCode)
      .maybeSingle()
  );
  const session = sessionResult.data;

  if (!session) {
    return (
      <main style={pageStyle}>
        <p style={eyebrowStyle}>Development/debug view only.</p>
        <h1 style={headingStyle}>Session not found</h1>
        <section style={noticeStyle}>
          <p style={{ margin: 0 }}>
            No Supabase session matched session_code &quot;{cleanSessionCode}&quot;.
          </p>
          {sessionResult.error ? (
            <p style={{ margin: "8px 0 0" }}>Error: {sessionResult.error}</p>
          ) : null}
        </section>
      </main>
    );
  }

  const [
    sessionResults,
    playerSessionStats,
    notableHands,
    handsCount,
    actionsCount,
    rawLogEntriesCount,
  ] = await Promise.all([
    safeQuery(
      "session_results",
      supabase
        .from("session_results")
        .select("*")
        .eq("session_id", session.id)
        .order("finish", { ascending: true })
    ),
    safeQuery(
      "player_session_stats",
      supabase
        .from("player_session_stats")
        .select("*")
        .eq("session_id", session.id)
        .order("player_name", { ascending: true })
    ),
    safeQuery(
      "notable_hands",
      supabase
        .from("notable_hands")
        .select("*")
        .eq("session_id", session.id)
        .limit(50)
    ),
    safeCount("hands_count", "hands", session.id),
    safeCount("actions_count", "actions", session.id),
    safeCount("raw_log_entries_count", "raw_log_entries", session.id),
  ]);

  const debugData = {
    note: "Development/debug view only. No secrets are included.",
    session,
    relatedData: {
      sessionResults,
      playerSessionStats,
      notableHands,
    },
    counts: {
      hands: handsCount,
      actions: actionsCount,
      rawLogEntries: rawLogEntriesCount,
    },
  };

  return (
    <main style={pageStyle}>
      <p style={eyebrowStyle}>Development/debug view only.</p>
      <h1 style={headingStyle}>{session.session_code} session data JSON</h1>
      <p style={bodyStyle}>
        Server-rendered inspection page for the session, related stat rows,
        notable hands, and source table counts.
      </p>
      <pre style={preStyle}>
        {JSON.stringify(sanitizeForDebug(debugData), null, 2)}
      </pre>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: 32,
  background: "#0a0a0a",
  color: "#f5f5f5",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const eyebrowStyle = {
  color: "#fbbf24",
  fontWeight: 700,
  margin: "0 0 8px",
};

const headingStyle = {
  fontSize: 28,
  margin: "0 0 8px",
};

const bodyStyle = {
  color: "#a1a1aa",
  margin: "0 0 24px",
};

const noticeStyle = {
  border: "1px solid rgba(251, 191, 36, 0.35)",
  borderRadius: 8,
  padding: 16,
  marginTop: 24,
  background: "rgba(251, 191, 36, 0.08)",
};

const preStyle = {
  overflow: "auto",
  padding: 16,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#111",
  color: "#e5e7eb",
  fontSize: 13,
  lineHeight: 1.5,
};
