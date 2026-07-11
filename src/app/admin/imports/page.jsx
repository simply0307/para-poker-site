import { AdminPlaceholder, AdminShell } from "@/components/admin-newsroom/AdminShell";

export default function AdminImportsPage() {
  return (
    <AdminShell
      title="Imports"
      description="Data pipeline workspace for reviewing session imports, hand coverage, action coverage, and import health."
    >
      <AdminPlaceholder title="Import control room pending">
        <p>
          This route is reserved for upload/review tools, session detection, hand/action coverage checks, import errors, and re-run controls.
          The current generation flow remains available from the session draft desks.
        </p>
      </AdminPlaceholder>
    </AdminShell>
  );
}
