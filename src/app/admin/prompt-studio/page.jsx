import { AdminShell } from "@/modules/para-poker/components/admin-newsroom/AdminShell";
import { PromptStudioForm } from "@/modules/para-poker/components/admin-newsroom/PromptStudioForm";
import { readPromptPresetSettings } from "@/modules/para-poker/lib/newsroom/promptPresetStore";
import { readSeasonSettings } from "@/modules/para-poker/lib/newsroom/seasonSettings";

export const dynamic = "force-dynamic";

export default async function AdminPromptStudioPage() {
  const [presetSettings, seasonSettings] = await Promise.all([readPromptPresetSettings(), readSeasonSettings()]);

  return (
    <AdminShell
      title="Prompt Studio"
      description="Form-driven prompt configuration for session recaps, player profiles, moments, standings, articles, and social copy."
    >
      <PromptStudioForm initialPresetSettings={presetSettings} seasonSettings={seasonSettings} />
    </AdminShell>
  );
}
