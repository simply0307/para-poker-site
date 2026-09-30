import { AdminCard, AdminShell, AdminStat } from "@/modules/para-poker/components/admin-newsroom/AdminShell";
import { getAdminDashboardRoutes } from "@/modules/para-poker/lib/newsroom/adminRoutes";
import { readSeasonSettings } from "@/modules/para-poker/lib/newsroom/seasonSettings";

export default async function AdminHome() {
  const adminRoutes = getAdminDashboardRoutes();
  const seasonSettings = await readSeasonSettings();

  return (
    <AdminShell
      eyebrow="Para Poker League operations"
      title="Newsroom control room"
      description="Admin pages generate editable drafts, expose context packets, show included editorial docs, and control publishing."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <AdminStat label="Active season" value={seasonSettings.activeSeasonCode} />
        <AdminStat label="Phase" value={seasonSettings.seasonPhase.replace(/_/g, " ")} />
        <AdminStat label="Status" value={seasonSettings.seasonStatus.replace(/_/g, " ")} />
      </section>
      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {adminRoutes.map((route) => (
          <AdminCard key={route.href} href={route.href} title={route.title} meta={route.group}>
            <p>{route.description}</p>
          </AdminCard>
        ))}
      </section>
    </AdminShell>
  );
}
