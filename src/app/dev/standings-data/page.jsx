import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const seasonCode = "S0";

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

export default async function DevStandingsDataPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const [standingsResult, sessionsResult] = await Promise.all([
    safeQuery(
      "standings",
      supabase
        .from("standings")
        .select("*")
        .eq("season_code", seasonCode)
        .order("rank", { ascending: true })
    ),
    safeQuery(
      "sessions",
      supabase
        .from("sessions")
        .select("id, session_code, session_number, played_at, status")
        .eq("season_code", seasonCode)
        .order("session_number", { ascending: true })
    ),
  ]);

  const sessionIds = (sessionsResult.data || []).map((session) => session.id);
  const approvedSessionResults = sessionIds.length
    ? await safeQuery(
        "approved_session_results",
        supabase
          .from("session_results")
          .select("*")
          .in("session_id", sessionIds)
          .eq("approved", true)
          .order("finish", { ascending: true })
      )
    : {
        label: "approved_session_results",
        data: [],
        count: 0,
        error: null,
      };

  const debugData = {
    note: "Development/debug view only. No secrets are included.",
    seasonCode,
    standings: standingsResult,
    sessions: sessionsResult,
    approvedSessionResults,
  };

  return (
    <main style={pageStyle}>
      <p style={eyebrowStyle}>Development/debug view only.</p>
      <h1 style={headingStyle}>S0 standings data JSON</h1>
      <p style={bodyStyle}>
        Server-rendered inspection page for current standings and approved
        session_results feeding the S0 standings.
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
