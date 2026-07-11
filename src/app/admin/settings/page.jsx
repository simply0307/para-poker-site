import { AdminPlaceholder, AdminShell } from "@/components/admin-newsroom/AdminShell";

export default function AdminSettingsPage() {
  return (
    <AdminShell
      title="Settings"
      description="League-wide settings for season status, homepage modules, default prompt configs, and provider diagnostics."
    >
      <AdminPlaceholder title="Settings workspace pending">
        <p>
          Official login, durable admin preferences, default prompt config storage, and homepage module ordering can be added here when the
          foundation is ready. Environment files and provider secrets remain server-side only.
        </p>
      </AdminPlaceholder>
    </AdminShell>
  );
}
