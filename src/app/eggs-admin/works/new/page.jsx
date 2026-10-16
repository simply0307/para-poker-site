import { notFound } from "next/navigation";
import { workspace } from "@/lib/hub/workspace";
import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { WorkEditor } from "@/components/rooms/WorkEditor";
export default async function NewWork() {
  if (!roomsEnabled()) notFound();
  const access = await workspace();
  if (access.error) return <p role="alert">{access.error}</p>;
  let projects;
  try {
    projects = await access.repository.published();
  } catch {
    return <p role="alert">Projects could not be loaded.</p>;
  }
  return (
    <>
      <h1>Create a work draft</h1>
      <WorkEditor projects={projects} />
    </>
  );
}
