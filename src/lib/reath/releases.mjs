import data from "./release-data.json" with { type: "json" };
export const reathSource = Object.freeze({
  url: "https://reath-digest.carrd.co/",
  credit: "Eternal Galaxy Gaming Studio",
  notice: data.notice,
  checked_on: data.checked_on,
});
export const eggsChannel = Object.freeze(data.channel);
const mediaId = /^[A-Za-z0-9_-]{11}$/u;
export const publicPageImage = (value) =>
  typeof value === "string" &&
  /^https:\/\/reath-digest\.carrd\.co\/assets\/images\/(?:gallery[0-9]{2}\/[a-f0-9]{8}_original|image[0-9]{2})\.jpg\?v=[a-f0-9]{8}$/u.test(
    value,
  );
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export function existingReathReleases() {
  return data.releases
    .filter(
      (item) =>
        slugPattern.test(item.slug) &&
        /^https:\/\/reath-digest\.carrd\.co\/#[a-z0-9-]+$/u.test(
          item.source_url,
        ) &&
        item.gallery.every((page) => publicPageImage(page.url)),
    )
    .map((item) => ({
      ...item,
      id: "release:" + item.slug,
      href: "/reath-digest/" + item.slug,
      attribution: item.credit,
      cover_url: item.gallery[0]?.url || null,
      topics: [
        ...item.articles,
        ...item.subjects.flatMap((subject) => [
          subject.name,
          ...subject.aliases,
        ]),
      ],
    }));
}
export function publicChannelVideos() {
  return data.videos
    .filter(
      (video) =>
        mediaId.test(video.id) &&
        video.source_url === "https://www.youtube.com/watch?v=" + video.id,
    )
    .map((video) => ({
      ...video,
      id: "video:" + video.id,
      slug: "video-" + video.id,
      format: "video",
      href: "/watch/" + video.id,
      attribution: video.credit,
      cover_url: null,
      topics: [],
      summary: video.summary || "A public video from the EGGS channel.",
    }));
}
export function existingReathCatalog() {
  return [
    ...existingReathReleases(),
    ...publicChannelVideos().filter((video) =>
      ["reath", "reath-funnies"].includes(video.scope),
    ),
  ];
}
export function mergeReathCatalog(works) {
  // Curated existing releases keep their original public source. They are not
  // fabricated Hub snapshots and never acquire a synthetic publisher identity.
  return [...existingReathCatalog(), ...works].filter(
    (item, index, all) =>
      all.findIndex((other) => other.id === item.id) === index,
  );
}
