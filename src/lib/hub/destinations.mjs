// Studio destinations are tied to stable project identities, never a supplied title.
const REATH = "a0000000-0000-4000-8000-000000000004";
const GAUNTLET = "a0000000-0000-4000-8000-000000000002";
export const isPokerClient = (project) =>
  project.id === "a0000000-0000-4000-8000-000000000003";
export function projectBrand(project) {
  if (project.id === REATH)
    return {
      src: "/brand/reath-digest.png",
      alt: "Reath Digest",
      width: 1024,
      height: 1024,
    };
  if (project.id === GAUNTLET)
    return {
      src: "/brand/gauntlet.png",
      alt: "Gauntlet",
      width: 2508,
      height: 2508,
    };
  if (project.id === "a0000000-0000-4000-8000-000000000001")
    return {
      src: "/images/para-wordmark.svg",
      alt: "Para Poker League",
      width: 320,
      height: 110,
    };
  return null;
}
export function projectLanding(project) {
  return project.id === REATH ? "/reath-digest" : "/projects/" + project.slug;
}
export function projectDestination(project) {
  return project.id === REATH
    ? "/reath-digest"
    : project.content.destination || "";
}
export function readerProject(project) {
  if (isPokerClient(project))
    return {
      ...project,
      content: {
        ...project.content,
        status: "playtest",
        summary:
          "The ParaPoker friends-only play-money prelaunch client, in the EGGS family.",
        description:
          "The current client identifies as ParaPoker Prelaunch. Play-money tables and account access remain with that existing client; EGGS membership does not grant an invitation. Official Para Poker League records continue through the reviewed league pipeline.",
        participation:
          "Use your existing client account or invitation. This is a friends-only prelaunch, with its own access rules.",
      },
    };
  if (project.id !== REATH) return project;
  return {
    ...project,
    content: {
      ...project.content,
      destination: "/reath-digest",
      status: "available",
      summary:
        "Publications, Reath Funnies, comics, and moving pictures. A place for our stories.",
      description:
        "Reath Digest is the reader's home for EGGS publications: stories and essays, Reath Funnies, comics, video, and the archive. Released work is collected here; the editorial desk remains separate.",
      participation:
        "Explore the collections, find a story, and make Reath part of your corner of EGGS.",
    },
  };
}
