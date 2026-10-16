import Link from "next/link";
import Image from "next/image";
import { categories, statuses } from "@/lib/hub/catalog.mjs";
export function StudioProject({ project }) {
  const c = project.content;
  return (
    <article className={"studio-window studio-project project-" + project.slug}>
      <div className="window-bar">
        <span>
          {categories[c.category]} / {statuses[c.status]}
        </span>
        <span aria-hidden="true">↗</span>
      </div>
      <Link href={"/projects/" + project.slug}>
        <div className="studio-poster" aria-hidden="true">
          {c.asset === "para" ? (
            <Image
              src="/images/para-wordmark.svg"
              width={220}
              height={75}
              alt=""
            />
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
