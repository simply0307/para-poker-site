import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { PromptStudioForm } from "@/components/admin-newsroom/PromptStudioForm";

export default function AdminPromptStudioPage() {
  return (
    <AdminShell
      title="Prompt Studio"
      description="Form-driven prompt configuration for session recaps, player profiles, moments, standings, articles, and social copy."
    >
      <PromptStudioForm />
    </AdminShell>
  );
}
