import { AdminShell } from "@/modules/para-poker/components/admin-newsroom/AdminShell";
import { UpcomingEventsForm } from "@/modules/para-poker/components/admin-newsroom/UpcomingEventsForm";
import { readUpcomingEventsSettings } from "@/modules/para-poker/lib/newsroom/upcomingEvents";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const settings = await readUpcomingEventsSettings();

  return (
    <AdminShell
      title="Event Draft Room"
      description="Stage future table cards for the public homepage. These are manual newsroom placeholders until the game-site schedule feed is connected."
    >
      <UpcomingEventsForm initialSettings={settings} />
    </AdminShell>
  );
}
