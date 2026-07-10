import Link from "next/link";
import { NewsroomShell, PageHeader } from "@/components/newsroom/NewsroomShell";

export default function Home() {
  return (
    <NewsroomShell>
      <PageHeader title="Generated coverage for a small poker league.">
        <p>
          Structured Para League data moves through context packets, story plans,
          Gemini generation, editorial review, and published public prose.
        </p>
      </PageHeader>
      <div className="flex flex-wrap gap-3 py-4">
        <Link className="rounded-md bg-amber-300 px-4 py-3 font-black text-stone-950" href="/sessions">
          Read Sessions
        </Link>
        <Link className="rounded-md border border-white/15 px-4 py-3 font-bold text-white" href="/admin">
          Open Admin
        </Link>
      </div>
    </NewsroomShell>
  );
}
