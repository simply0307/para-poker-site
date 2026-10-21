import Link from "next/link";
import Image from "next/image";
import { categories, statuses } from "@/lib/hub/catalog.mjs";
import {
  projectBrand,
  projectLanding,
  isPokerClient,
} from "@/lib/hub/destinations.mjs";
import { PokerClientMark } from "@/components/hub/PokerClientMark";
export function StudioProject({ project }) {
  const c = project.content;
  const brand = projectBrand(project);
  return (
    <article className={"studio-window studio-project project-" + project.slug}>
      <div className="window-bar">
        <span>
          {categories[c.category]} / {statuses[c.status]}
        </span>
        <span aria-hidden="true">↗</span>
      </div>
      <Link href={projectLanding(project)}>
        <div className="studio-poster" aria-hidden="true">
          {brand ? (
            <Image
              className={"project-brand project-brand-" + project.slug}
              src={brand.src}
              width={brand.width}
              height={brand.height}
              alt=""
              unoptimized
            />
          ) : isPokerClient(project) ? (
            <PokerClientMark />
          ) : (
            <>
              <span className="poster-orbit" />
              <b>
                {c.title
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 3)
                  .join("")}
              </b>
              <small>EGGS / {c.category.toUpperCase()}</small>
            </>
          )}
        </div>
        <div className="window-copy">
          <h2>{c.title}</h2>
          <p>{c.summary}</p>
          <span className="studio-arrow">Find your way in ↗</span>
        </div>
      </Link>
    </article>
  );
}
