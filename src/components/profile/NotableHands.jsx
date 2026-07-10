export default function NotableHands({ hands }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
      <h2 className="text-2xl font-black mb-5">Notable Hands</h2>

      {!hands?.length ? (
        <p className="text-zinc-500">No notable hands yet.</p>
      ) : (
        <div className="space-y-4">
          {hands.map((hand) => (
            <div
              key={hand.id}
              className="rounded-2xl bg-white/5 border border-white/10 p-4"
            >
              <div className="text-amber-300 font-bold">
                {hand.tags?.join(", ") || "Notable Hand"}
              </div>

              <p className="text-zinc-300 mt-2 leading-6">
                {hand.summary}
              </p>

              <div className="text-xs text-zinc-500 mt-3">
                Pot: {hand.pot_collected} - Hand #{hand.hand_no}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
