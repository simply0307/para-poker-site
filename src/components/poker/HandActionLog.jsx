import { present, text } from "@/lib/newsroom/data";
import { normalizeHandActionLog } from "@/lib/poker/handHistory";
import { stripPlayerHandlesFromText } from "@/lib/playerNames";

export function HandActionLog({ actionLog }) {
  if (!actionLog?.hasAction) {
    return (
      <div className="mt-3 rounded-md border border-white/10 bg-stone-950/60 p-3 text-sm text-stone-300">
        {actionLog?.summaryFacts?.length ? (
          <div className="grid gap-2">
            {actionLog.summaryFacts.map((fact) => (
              <p key={fact.label}>
                <span className="font-bold text-stone-400">{fact.label}:</span> {text(fact.body)}
              </p>
            ))}
          </div>
        ) : null}
        <p className="mt-3 text-stone-500">{actionLog?.unavailableReason || "Action log not available for this hand."}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-amber-300/20 bg-stone-950/75 p-3 font-mono text-sm leading-6 text-stone-200">
      {actionLog.raw ? <pre className="overflow-auto whitespace-pre-wrap">{actionLog.raw}</pre> : null}
      {!actionLog.raw && actionLog.parsed ? <pre className="overflow-auto whitespace-pre-wrap">{actionLog.parsed}</pre> : null}
      {!actionLog.raw && !actionLog.parsed && actionLog.streets?.length ? (
        <div className="grid gap-3">
          {actionLog.streets.map((street) => (
            <section key={street.street}>
              <p className="font-black uppercase tracking-[0.14em] text-amber-300">{street.street}</p>
              {street.actions?.length ? (
                <ol className="mt-2 grid gap-1">
                  {street.actions.map((action, index) => (
                    <li
                      key={`${action.id || action.order || action.line}-${index}`}
                      className="grid gap-2 rounded border border-white/5 bg-white/[0.025] px-3 py-2 md:grid-cols-[2.5rem_1fr_auto]"
                    >
                      <span className="text-stone-500">{index + 1}.</span>
                      <span>
                        {action.player_name ? <strong className="text-stone-100">{stripPlayerHandlesFromText(action.player_name)}</strong> : null}
                        {action.position ? <span className="ml-2 text-stone-500">({action.position})</span> : null}
                        <span className="ml-2 text-stone-300">{action.action || action.line}</span>
                        {action.all_in ? <span className="ml-2 font-bold text-rose-300">all in</span> : null}
                        {action.raw_entry ? <span className="block text-xs text-stone-500">{stripPlayerHandlesFromText(action.raw_entry)}</span> : null}
                      </span>
                      {action.amount_text ? <span className="font-bold text-amber-200">{action.amount_text}</span> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <pre className="mt-1 overflow-auto whitespace-pre-wrap">{text(street.body)}</pre>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HandHistoryBlock({ hand, compact = false }) {
  const actionLog = hand.actionLog || normalizeHandActionLog(hand);
  const title = hand.hand_no ? `Hand #${hand.hand_no}` : "Recorded hand";
  const isFullHistory = actionLog.kind === "action_log";
  const detailLabel = isFullHistory ? "View Full Hand History" : "View Hand Summary";

  return (
    <article className="rounded-md border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black text-white">{title}</h3>
        {present(hand.pot_collected) ? <strong className="text-amber-200">{Number(hand.pot_collected).toLocaleString("en-US")} chips</strong> : null}
      </div>
      <div className={compact ? "mt-3 grid gap-x-5 md:grid-cols-3" : "mt-3 grid gap-x-5 md:grid-cols-2"}>
        <Fact label="Winner" value={hand.winner_name} playerText />
        <Fact label="Board" value={hand.board} />
        <Fact label="Winning hand" value={hand.winning_hand} />
        <Fact label="Result" value={hand.raw_result || hand.summary} playerText />
        <Fact label="Players" value={hand.players_involved || hand.player_names || hand.involved_players} playerText />
      </div>
      <details className="mt-4 rounded-md border border-white/10 bg-stone-950/50 p-3">
        <summary className="cursor-pointer font-bold text-amber-200">{detailLabel}</summary>
        <HandActionLog actionLog={actionLog} />
      </details>
    </article>
  );
}

function Fact({ label, value, playerText = false }) {
  if (!present(value)) return null;
  const displayValue = Array.isArray(value) ? value.map((item) => text(item)).join(", ") : text(value);
  return (
    <p className="mt-2 text-sm leading-6 text-stone-300">
      <span className="font-bold text-stone-400">{label}:</span> {playerText ? stripPlayerHandlesFromText(displayValue) : displayValue}
    </p>
  );
}
