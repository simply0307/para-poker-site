import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { HomepageSettingsForm } from "@/components/admin-newsroom/HomepageSettingsForm";
import { readHomepageSettings } from "@/lib/newsroom/homepageSettings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const homepageSettings = await readHomepageSettings();

  return (
    <AdminShell
      title="Settings"
      description="League-wide controls for the public homepage, season status, default prompt configs, and provider diagnostics."
    >
      <HomepageSettingsForm initialSettings={homepageSettings} />
    </AdminShell>
  );
}
