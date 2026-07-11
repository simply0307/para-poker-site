import { HomepageModuleRenderer } from "@/components/newsroom/HomepageModules";
import { NewsroomShell } from "@/components/newsroom/NewsroomShell";
import { buildHomeViewModel } from "@/lib/newsroom/viewModels/home";

export const revalidate = 60;

export default async function Home() {
  const viewModel = await buildHomeViewModel();

  return (
    <NewsroomShell>
      <HomepageModuleRenderer viewModel={viewModel} />
    </NewsroomShell>
  );
}
