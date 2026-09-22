import { HomepageModuleRenderer } from "@/modules/para-poker/components/newsroom/HomepageModules";
import { NewsroomShell } from "@/modules/para-poker/components/newsroom/NewsroomShell";
import { buildHomeViewModel } from "@/modules/para-poker/lib/newsroom/viewModels/home";

export const revalidate = 60;

export default async function Home() {
  const viewModel = await buildHomeViewModel();

  return (
    <NewsroomShell>
      <HomepageModuleRenderer viewModel={viewModel} />
    </NewsroomShell>
  );
}
