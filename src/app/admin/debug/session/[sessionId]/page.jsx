import { notFound } from "next/navigation";
import { buildSessionViewModel, getSessionByIdOrCode, normalizeHandActionLog, safeQuery, supabase } from "@/lib/newsroom/data";

export const dynamic = "force-dynamic";

const ACTION_FIELDS = [
  "raw_hand_history",
  "raw_text",
  "hand_history",
  "action_log",
  "actions",
  "parsed_actions",
  "raw",
  "details",
  "metadata",
  "preflop",
  "flop",
  "turn",
  "river",
  "showdown",
  "summary",
  "raw_result",
];

function columnSummary(rows = []) {
  return [...new Set(rows.flatMap((row) => Object.keys(row || {})))].sort();
}

function actionFieldSummary(rows = []) {
  return rows.map((row) => ({
    id: row.id || row.hand_id || row.hand_no || null,
    hand_no: row.hand_no || null,
    fields_present: ACTION_FIELDS.filter((field) => row[field] !== null && row[field] !== undefined && row[field] !== ""),
    normalized_action_log: normalizeHandActionLog(row),
    all_columns: Object.keys(row || {}).sort(),
    row,
  }));
}

function actionsByHandSummary(actions = []) {
  const groups = new Map();
  for (const action of actions) {
    const key = action.hand_no || action.hand_id || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(action);
  }

  return [...groups.entries()].map(([hand, rows]) => ({
    hand,
    action_count: rows.length,
    streets: [...new Set(rows.map((row) => row.street).filter(Boolean))],
    first_action: rows[0]?.raw_entry || rows[0]?.action || "",
    last_action: rows[rows.length - 1]?.raw_entry || rows[rows.length - 1]?.action || "",
  }));
}

export default async function SessionDebugPage({ params }) {
  const { sessionId } = await params;
  const session = await getSessionByIdOrCode(sessionId);
  if (!session) notFound();

  const [sessionResults, playerSessionStats, notableHands, hands, actions, players, viewModel] = await Promise.all([
    safeQuery(supabase.from("session_results").select("*").eq("session_id", session.id).order("finish", { ascending: true }), []),
    safeQuery(supabase.from("player_session_stats").select("*").eq("session_id", session.id).order("player_name", { ascending: true }), []),
    safeQuery(supabase.from("notable_hands").select("*").eq("session_id", session.id).order("hand_no", { ascending: true }), []),
    safeQuery(supabase.from("hands").select("*").eq("session_id", session.id).order("hand_no", { ascending: true }), []),
    safeQuery(supabase.from("actions").select("*").eq("session_id", session.id).order("log_order", { ascending: true }).limit(5000), []),
    safeQuery(supabase.from("players").select("*").order("display_name", { ascending: true }), []),
    buildSessionViewModel(session.id),
  ]);

  const payload = {
    session,
    summaries: {
      session_results: { count: sessionResults.length, columns: columnSummary(sessionResults) },
      player_session_stats: { count: playerSessionStats.length, columns: columnSummary(playerSessionStats) },
      notable_hands: { count: notableHands.length, columns: columnSummary(notableHands) },
      hands: { count: hands.length, columns: columnSummary(hands) },
      actions: { count: actions.length, columns: columnSummary(actions), by_hand: actionsByHandSummary(actions) },
      players: { count: players.length, columns: columnSummary(players) },
      action_fields_checked: ACTION_FIELDS,
    },
    session_results: sessionResults,
    player_session_stats: playerSessionStats,
    notable_hands: actionFieldSummary(notableHands),
    hands: actionFieldSummary(hands),
    actions,
    players_involved: viewModel?.participants || [],
    view_model: viewModel,
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Admin debug</p>
      <h1 className="mt-3 text-4xl font-black">{session.session_code || session.id}</h1>
      <p className="mt-2 text-zinc-400">Raw session data and action-field audit.</p>
      <pre className="mt-6 max-h-[80vh] overflow-auto rounded-lg border border-white/10 bg-black p-4 text-xs leading-5">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </main>
  );
}
