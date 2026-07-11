import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { DataOverridesManager } from "@/components/admin-newsroom/DataOverridesManager";
import { readDataOverrides } from "@/lib/newsroom/dataOverrides";

export const dynamic = "force-dynamic";

export default async function AdminOverridesPage() {
  const overrides = await readDataOverrides();

  return (
    <AdminShell
      title="Data overrides"
      description="Admin-only correction records for reviewed public display values. Overrides are stored separately from imported league data."
    >
      <DataOverridesManager initialOverrides={overrides} />
    </AdminShell>
  );
}
