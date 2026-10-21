import Link from "next/link";
import { notFound } from "next/navigation";
import { workspace } from "@/lib/hub/workspace";
import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { roomRepository } from "@/lib/rooms/repository.mjs";
export default async function WorksAdmin() {
  if (!roomsEnabled()) notFound();
  const access = await workspace();
  if (access.error) return <p role="alert">{access.error}</p>;
  let works;
  try {
    works = await roomRepository(access.client).drafts();
  } catch {
    return <p role="alert">Works could not be loaded.</p>;
  }
  return (
    <>
      <div className="hub-page-heading">
        <p className="eggs-eyebrow">EGGS publishing / {access.role}</p>
        <h1>The works shelf.</h1>
        <p>Source, permission, saved preview, then publication.</p>
        <Link className="eggs-button" href="/eggs-admin/works/new">
          Create a work +
        </Link>
      </div>
      <div className="hub-admin-list">
        {works.map((w) => (
          <article key={w.id}>
            <div>
              <span className="hub-chip">{w.state}</span>
              <h2>
                <Link href={"/eggs-admin/works/" + w.id}>
                  {w.content.title}
                </Link>
              </h2>
              <p>
                /{w.slug} · revision {w.version}
              </p>
            </div>
          </article>
        ))}
      </div>
      {works.length === 0 ? (
        <p>No works yet. Start with an original registered design.</p>
      ) : null}
    </>
  );
}
