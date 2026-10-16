// Identifiers are shared by server validation and rendering; SQL independently validates them.
export const themes = {
  carton: "Carton Classic",
  "after-hours": "After Hours",
};
export const wallpapers = {
  plain: "Plain paper",
  graph: "Graph paper",
  dots: "Confetti dots",
  stripes: "Airmail stripes",
  checker: "Checker paper",
  stars: "Night signals",
};
export const covers = {
  sunrise: "Sunrise department",
  airmail: "Special delivery",
  orbit: "Orbital diagram",
  midnight: "Midnight notice",
};
export const avatars = {
  egg: "Good egg",
  orbit: "Orbit",
  flower: "Paper flower",
  spark: "Spark",
};
export const stamps = {
  approved: "APPROVED",
  local: "LOCALLY WEIRD",
  dreamer: "DAYDREAM DEPT.",
  open: "OPEN TO IDEAS",
  fragile: "FRAGILE GENIUS",
  original: "ORIGINAL COPY",
  visitor: "VISITOR PASS",
  "night-owl": "NIGHT SHIFT",
  player: "PLAYER ONE",
  maker: "MADE SOMETHING",
  "good-egg": "GOOD EGG",
  "handle-with-care": "HANDLE WITH CARE",
};
export const modules = {
  bio: "About me",
  affiliation: "My corner",
  favorites: "Favorite games",
  featured_note: "Pinned note",
  showcase: "Featured Eight",
};
export const workAssets = {
  "signal-grid": { title: "Signal grid", src: "/eggs/works/signal-grid.svg" },
  "night-ticket": {
    title: "Night ticket",
    src: "/eggs/works/night-ticket.svg",
  },
  "room-map": { title: "Room map", src: "/eggs/works/room-map.svg" },
};
export const defaultAppearance = {
  theme: "carton",
  wallpaper: "graph",
  cover: "sunrise",
  avatar: "egg",
  accent: "sage",
  stamps: [],
};
export const defaultOrder = Object.keys(modules);
export const defaultVisibility = Object.fromEntries(
  defaultOrder.map((k) => [k, true]),
);
