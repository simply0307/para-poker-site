import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { PromptStudioForm } from "@/components/admin-newsroom/PromptStudioForm";
import { readPromptPresetSettings } from "@/lib/newsroom/promptPresetStore";

export const dynamic = "force-dynamic";

export default async function AdminPromptStudioPage() {
  const presetSettings = await readPromptPresetSettings();

  return (
    <AdminShell
      title="Prompt Studio"
      description="Form-driven prompt configuration for session recaps, player profiles, moments, standings, articles, and social copy."
    >
      <PromptStudioForm initialPresetSettings={presetSettings} />
    </AdminShell>
  );
}
