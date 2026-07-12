import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { HomepageSettingsForm } from "@/components/admin-newsroom/HomepageSettingsForm";
import { PageHeroSettingsForm } from "@/components/admin-newsroom/PageHeroSettingsForm";
import { readHomepageSettings } from "@/lib/newsroom/homepageSettings";
import { readPageHeroSettings } from "@/lib/newsroom/pageHeroSettings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [homepageSettings, pageHeroSettings] = await Promise.all([
    readHomepageSettings(),
    readPageHeroSettings(),
  ]);

  return (
    <AdminShell
      title="Settings"
      description="League-wide controls for the public homepage, season status, default prompt configs, and provider diagnostics."
    >
      <div className="grid gap-8">
        <HomepageSettingsForm initialSettings={homepageSettings} />
        <PageHeroSettingsForm initialSettings={pageHeroSettings} />
      </div>
    </AdminShell>
  );
}
