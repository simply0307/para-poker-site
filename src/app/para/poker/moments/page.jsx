import LeaguePage from "@/modules/para-poker/pages/moments/page.jsx";
import { LeagueAvailability } from "@/modules/para-poker/components/LeagueAvailability";

export const dynamic = "force-dynamic";

export default function Page(props) {
  return <LeagueAvailability><LeaguePage {...props} /></LeagueAvailability>;
}
