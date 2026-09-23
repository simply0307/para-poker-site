import { AdminShell } from "@/modules/para-poker/components/admin-newsroom/AdminShell";
import { PlayerClaimReview } from "@/modules/para-poker/components/admin-newsroom/PlayerClaimReview";
import { consumerConfiguration } from "@/lib/eggs/consumerCore.mjs";

export default function PlayerClaimsPage() {
  return <AdminShell title="Player claims" description="Review EGGS accounts requesting a connection to an existing Para Poker player. Every ownership decision is explicit and recorded.">
    {consumerConfiguration() ? <PlayerClaimReview /> : <p>Player claim review is not available yet.</p>}
  </AdminShell>;
}
