import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function sourceFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const filename = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(filename));
    else files.push(filename);
  }
  return files;
}

export async function apiInventory() {
  const root = path.resolve("src/app");
  const entries = [];
  for (const filename of await sourceFiles(path.join(root, "api"))) {
    if (!filename.endsWith(`${path.sep}route.js`)) continue;
    const source = await readFile(filename, "utf8");
    const route = "/" + path.relative(root, filename).split(path.sep)
      .filter(segment => !segment.startsWith("(") && segment !== "route.js").join("/");
    for (const match of source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/gu)) {
      entries.push({ route, method: match[1], filename });
    }
  }
  return entries;
}

export function requiresOperator({ route, method }) {
  // Session deletion clears only the caller's browser cookie. It neither
  // invokes a repository nor mutates privileged server data.
  return !(route === "/api/operator-session" && method === "DELETE");
}

export function concreteRoute(route) {
  return route.replace(/\[[^\]]+\]/gu, "11111111-1111-4111-8111-111111111111");
}
