import Link from "next/link";
import { AdminShell, AdminStat } from "@/components/admin-newsroom/AdminShell";
import { ImportSessionManager } from "@/components/admin-newsroom/ImportSessionManager";
import { RawHandImportPanel } from "@/components/admin-newsroom/RawHandImportPanel";
import { buildImportHealthViewModel } from "@/lib/newsroom/importHealth";
import { formatNumber } from "@/lib/newsroom/data";
import { readSeasonSettings } from "@/lib/newsroom/seasonSettings";

export const dynamic = "force-dynamic";

function statusClass(status) {
  if (status === "Ready") return "border-emerald-600/30 bg-emerald-50 text-emerald-800";
  if (status === "Partial actions") return "border-amber-600/30 bg-amber-50 text-amber-800";
  return "border-rose-600/30 bg-rose-50 text-rose-800";
}

export default async function AdminImportsPage() {
  const [health, seasonSettings] = await Promise.all([buildImportHealthViewModel(), readSeasonSettings()]);

  return (
    <AdminShell
      title="Import control room"
      description="Import raw hand-history CSV files into Supabase, then audit session, hand, action, moment, result, and player-stat coverage before generating or publishing coverage."
    >
      <RawHandImportPanel initialSeasonCode={seasonSettings.activeSeasonCode} existingSessions={health.sessions} />
      <ImportSessionManager sessions={health.sessions} />

      <section className="mt-8 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <AdminStat label="Sessions" value={formatNumber(health.totals.sessions)} />
        <AdminStat label="Hands" value={formatNumber(health.totals.hands)} />
        <AdminStat label="Actions" value={formatNumber(health.totals.actions)} />
        <AdminStat label="Notable hands" value={formatNumber(health.totals.notableHands)} />
        <AdminStat label="Ready" value={formatNumber(health.totals.readySessions)} />
        <AdminStat label="Needs attention" value={formatNumber(health.totals.sessionsNeedingAttention)} />
      </section>

      <section className="mt-8 rounded-lg border border-zinc-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Pipeline audit</p>
            <h2 className="mt-1 text-2xl font-black">Session coverage</h2>
          </div>
          <p className="text-sm text-zinc-500">Generated {new Date(health.generatedAt).toLocaleString("en-US")}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-zinc-100 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">Session</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Hands</th>
                <th className="px-5 py-3 text-right">With actions</th>
                <th className="px-5 py-3 text-right">Action rows</th>
                <th className="px-5 py-3 text-right">Results</th>
                <th className="px-5 py-3 text-right">Stats</th>
                <th className="px-5 py-3 text-right">Moments</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Links</th>
              </tr>
            </thead>
            <tbody>
              {health.sessions.map((session) => (
                <tr key={session.id} className="border-t border-zinc-200 align-top">
                  <td className="px-5 py-4">
                    <p className="font-black">{session.sessionCode}</p>
                    <p className="text-xs text-zinc-500">{session.tableName}</p>
                    {session.issues.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                        {session.issues.slice(0, 3).map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{session.playedAtLabel}</td>
                  <td className="px-5 py-4 text-right">
                    {formatNumber(session.handsImported)}
                    {session.declaredHands ? <span className="text-zinc-400"> / {formatNumber(session.declaredHands)}</span> : null}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {formatNumber(session.handsWithActions)}
                    {session.actionCoverage !== null ? <span className="text-zinc-400"> ({session.actionCoverage}%)</span> : null}
                  </td>
                  <td className="px-5 py-4 text-right">{formatNumber(session.actionRows)}</td>
                  <td className="px-5 py-4 text-right">{formatNumber(session.resultRows)}</td>
                  <td className="px-5 py-4 text-right">{formatNumber(session.statRows)}</td>
                  <td className="px-5 py-4 text-right">{formatNumber(session.notableHands)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(session.importStatus)}`}>
                      {session.importStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.08em]">
                      <Link className="text-amber-700 hover:text-amber-900" href={`/admin/sessions/${encodeURIComponent(session.sessionCode)}`}>
                        Draft desk
                      </Link>
                      <Link className="text-zinc-600 hover:text-zinc-950" href={`/sessions/${encodeURIComponent(session.sessionCode)}`}>
                        Public page
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">CSV-first pipeline</p>
          <h2 className="mt-1 text-2xl font-black">Operational import lane</h2>
          <p className="mt-3 leading-7 text-zinc-600">
            Raw hand CSV uploads are the active import path for league coverage. Legacy completed-session package tools remain available
            for direct maintenance only, but the admin control room now centers the CSV workflow that feeds sessions, hand history, actions,
            moments, standings evidence, and newsroom context.
          </p>
          <pre className="mt-4 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700">{`{
  "scope": "session|player|hand|moment|standings|article",
  "source_id": "existing row id or stable code",
  "field_path": "public field to override",
  "value": "reviewed replacement",
  "reason": "why this correction exists"
}`}</pre>
        </div>

        <div className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Names seen</p>
          <h2 className="mt-1 text-2xl font-black">Result/stat rows</h2>
          <div className="mt-4 space-y-2">
            {health.playersSeen.length ? health.playersSeen.map((player) => (
              <div key={player.name} className="flex items-center justify-between border-b border-zinc-100 py-2 text-sm last:border-0">
                <span className="font-bold">{player.name}</span>
                <span className="text-zinc-500">{formatNumber(player.count)} rows</span>
              </div>
            )) : <p className="text-sm text-zinc-500">No result/stat player rows found yet.</p>}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
