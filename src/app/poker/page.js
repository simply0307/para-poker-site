import Link from "next/link";
import { HomepageModuleRenderer } from "@/components/newsroom/HomepageModules";
import { NewsroomShell } from "@/components/newsroom/NewsroomShell";
import { buildHomeViewModel } from "@/lib/newsroom/viewModels/home";

export const revalidate = 60;

export default async function Home() {
  const viewModel = await buildHomeViewModel();

  return (
    <NewsroomShell>
      <nav aria-label="Poker division" className="my-4 flex flex-wrap gap-5 text-amber-200">{["sessions","standings","players","moments","articles"].map(page => <Link key={page} className="capitalize underline" href={"/"+page}>{page}</Link>)}</nav>
      <HomepageModuleRenderer viewModel={viewModel} />
    </NewsroomShell>
  );
}
