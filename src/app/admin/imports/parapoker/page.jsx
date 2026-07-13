import Link from "next/link";
import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { ParaPokerPackageImportPanel } from "@/components/admin-newsroom/ParaPokerPackageImportPanel";

export const dynamic = "force-dynamic";

export default function AdminParaPokerImportPage() {
  return (
    <AdminShell
      title="ParaPoker Package Import"
      description="Validate completed-session JSON packages from the official client, confirm participant mapping, preview derived evidence rows, and commit atomically to Supabase."
      actions={
        <Link href="/admin/imports" className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-700 hover:border-zinc-900">
          Import control room
        </Link>
      }
    >
      <ParaPokerPackageImportPanel />
    </AdminShell>
  );
}
