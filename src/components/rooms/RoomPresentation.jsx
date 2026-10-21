import Link from "next/link";
import { stamps, modules as moduleLabels } from "@/lib/rooms/registry.mjs";
import { affiliations } from "@/lib/hub/catalog.mjs";
import Image from "next/image";
import { workAssets } from "@/lib/rooms/registry.mjs";
import { projectBrand, isPokerClient } from "@/lib/hub/destinations.mjs";
import { PokerClientMark } from "@/components/hub/PokerClientMark";
export function Avatar({ id }) {
  return (
    <span
      className={"room-avatar avatar-" + id}
      aria-label={id + " avatar"}
      role="img"
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {id === "egg" ? (
          <>
            <ellipse cx="50" cy="51" rx="29" ry="37" />
            <circle cx="41" cy="52" r="3" />
            <circle cx="59" cy="52" r="3" />
            <path d="M43 65q7 6 14 0" />
          </>
        ) : id === "orbit" ? (
          <>
            <circle cx="50" cy="50" r="24" />
            <ellipse
              cx="50"
              cy="50"
              rx="43"
              ry="12"
              transform="rotate(-30 50 50)"
            />
          </>
        ) : id === "flower" ? (
          <>
            <path d="M50 9C25 5 26 30 12 34S9 68 31 67S35 96 53 88S71 74 88 60S70 28 62 28S70 8 50 9Z" />
            <circle cx="50" cy="50" r="12" />
          </>
        ) : (
          <path d="m50 7 11 30 31 13-31 12-11 31-12-31L7 50l31-13Z" />
        )}
      </svg>
    </span>
  );
}
function contentFor(key, m) {
  if (key === "bio") return m.bio ? <p className="room-bio">{m.bio}</p> : null;
  if (key === "affiliation")
    return m.affiliation ? (
      <p className="room-affiliation">
        {affiliations[m.affiliation] || m.affiliation}
      </p>
    ) : null;
  if (key === "favorites")
    return m.favorites?.length ? (
      <ul className="room-favorites">
        {m.favorites.map((p) => (
          <li key={p.id}>
            <Link href={"/projects/" + p.slug}>{p.title} ↗</Link>
          </li>
        ))}
      </ul>
    ) : null;
  if (key === "featured_note")
    return m.featured_note || m.pinned_project ? (
      <>
        <p className="room-bio">{m.featured_note}</p>
        {m.pinned_project ? (
          <Link href={"/projects/" + m.pinned_project.slug}>
            {m.pinned_project.title} ↗
          </Link>
        ) : null}
      </>
    ) : null;
  if (key === "showcase")
    return m.showcase?.length ? (
      <ol className="room-showcase">
        {m.showcase.map((item) => (
          <li key={item.type + item.id}>
            <Link
              href={
                (item.type === "work" ? "/library/" : "/projects/") + item.slug
              }
            >
              <span
                className={"showcase-art " + item.type}
                data-asset={item.asset}
                aria-hidden="true"
              >
                {item.type === "work" && workAssets[item.asset] ? (
                  <Image
                    src={workAssets[item.asset].src}
                    alt=""
                    width={180}
                    height={180}
                    unoptimized
                  />
                ) : item.type === "project" && projectBrand(item) ? (
                  <Image
                    src={projectBrand(item).src}
                    alt=""
                    width={180}
                    height={180}
                    unoptimized
                  />
                ) : item.type === "project" && isPokerClient(item) ? (
                  <PokerClientMark />
                ) : (
                  item.title
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 3)
                    .join("")
                )}
              </span>
              <small>
                {item.type === "work" ? "FROM THE LIBRARY" : "PROJECT"}
              </small>
              <b>{item.title}</b>
            </Link>
          </li>
        ))}
      </ol>
    ) : null;
  return null;
}
export function RoomPresentation({ room, children, toolbar }) {
  const a = room.appearance,
    m = room.modules;
  return (
    <div
      className="personal-room"
      data-theme={a.theme}
      data-wallpaper={a.wallpaper}
      data-accent={a.accent}
    >
      <div className={"room-cover cover-" + a.cover}>
        <span>EGGS / PERSONAL INTERNET</span>
        <b aria-hidden="true">
          {a.cover === "airmail"
            ? "SPECIAL DELIVERY"
            : a.cover === "orbit"
              ? "A WORLD OF YOUR OWN"
              : a.cover === "midnight"
                ? "AFTER THE WORLD GOES QUIET"
                : "HELLO, POSSIBILITIES."}
        </b>
        <span className="room-cover-mark" aria-hidden="true">
          ✳
        </span>
      </div>
      <div className="room-layout">
        <aside className="room-identity">
          <Avatar id={a.avatar} />
          <h1>{room.profile.display_name}</h1>
          <p className="room-handle">@{room.profile.handle}</p>
          <p className="room-membership">A little corner of EGGS.</p>
          {toolbar}
          <div className="room-stamps">
            {a.stamps.map((id) => (
              <span className={"room-stamp stamp-" + id} key={id}>
                {stamps[id]}
              </span>
            ))}
          </div>
          <Link className="room-home-link" href="/">
            ← Explore EGGS
          </Link>
        </aside>
        <div className="room-content">
          {room.module_order.map((key) => {
            const content = contentFor(key, m);
            return content ? (
              <section className={"room-module module-" + key} key={key}>
                <div className="window-bar">
                  <h2>{moduleLabels[key]}</h2>
                  <span aria-hidden="true">✦</span>
                </div>
                <div className="room-module-body">{content}</div>
              </section>
            ) : null;
          })}
          {children}
        </div>
      </div>
    </div>
  );
}
export function previewRoom(profile, value, projects, works) {
  const e = value.expression,
    m = {},
    visible = value.module_visibility;
  if (visible.bio) m.bio = value.profile.bio;
  if (visible.affiliation) m.affiliation = e.affiliation;
  if (visible.favorites)
    m.favorites = e.favorite_project_ids
      .map((id) => projects.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => ({ id: p.id, slug: p.slug, title: p.content.title }));
  if (visible.featured_note) {
    m.featured_note = e.featured_note;
    const p = projects.find((p) => p.id === e.pinned_project_id);
    if (p) m.pinned_project = { slug: p.slug, title: p.content.title };
  }
  if (visible.showcase)
    m.showcase = value.showcase
      .map((item) => {
        const target = (item.type === "work" ? works : projects).find(
          (x) => x.id === item.id,
        );
        return target
          ? {
              ...item,
              slug: target.slug,
              title: target.content.title,
              asset:
                item.type === "work"
                  ? target.content.asset_id
                  : target.content.asset,
            }
          : null;
      })
      .filter(Boolean);
  return {
    profile: { ...profile, display_name: value.profile.display_name },
    appearance: value.appearance,
    module_order: value.module_order,
    modules: m,
  };
}
