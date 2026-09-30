import fs from "node:fs/promises";
import path from "node:path";

const EDITORIAL_DOCS = [
  {
    id: "newsroom-product-model",
    title: "Newsroom Product Model",
    filename: "00-product-model.md",
    purpose: "Generation-first product loop and public/admin behavior.",
  },
  {
    id: "public-vs-internal-ui",
    title: "Public vs Admin",
    filename: "01-public-vs-admin.md",
    purpose: "Rules for hiding debug/source metadata from public recap copy.",
  },
  {
    id: "recap-voice-guide",
    title: "Session Recap Voice",
    filename: "02-session-recap-voice.md",
    purpose: "Voice, examples, allowed liberties, and forbidden claims.",
  },
  {
    id: "draft-formats",
    title: "Draft Formats",
    filename: "03-draft-formats.md",
    purpose: "Session, profile, moment, standings, and article draft formats.",
  },
  {
    id: "generation-rules",
    title: "Generation Rules",
    filename: "04-generation-rules.md",
    purpose: "Generation boundaries, inspection requirements, and draft workflow.",
  },
];

function clampContent(value, maxChars = 12000) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[Truncated for prompt size; source doc continues in repo.]`;
}

export async function loadNewsroomEditorialDocs() {
  const docsRoot = path.join(process.cwd(), "docs", "newsroom");
  const docs = await Promise.all(
    EDITORIAL_DOCS.map(async (doc) => {
      const relativePath = `docs/newsroom/${doc.filename}`;
      const absolutePath = path.join(docsRoot, doc.filename);
      try {
        const content = await fs.readFile(absolutePath, "utf8");
        return {
          ...doc,
          relativePath,
          included: true,
          charCount: content.length,
          content: clampContent(content),
        };
      } catch (error) {
        return {
          ...doc,
          relativePath,
          included: false,
          charCount: 0,
          content: "",
          error: error instanceof Error ? error.message : "Could not read document.",
        };
      }
    })
  );

  return {
    version: "newsroom-editorial-docs-v1",
    manifest: docs.map(({ id, title, relativePath, purpose, included, charCount, error }) => ({
      id,
      title,
      path: relativePath,
      purpose,
      included,
      charCount,
      error: error || "",
    })),
    documents: docs
      .filter((doc) => doc.included)
      .map(({ id, title, purpose, content }) => ({
        id,
        title,
        purpose,
        content,
      })),
  };
}

export function editorialDocIds(editorialDocs) {
  return (editorialDocs?.manifest || [])
    .filter((doc) => doc.included)
    .map((doc) => doc.id);
}

export async function loadSessionRecapMagicGuide() {
  const relativePath = "newsroom-library/docs/09-session-recap-magic-guide.md";
  const absolutePath = path.join(process.cwd(), "newsroom-library", "docs", "09-session-recap-magic-guide.md");

  try {
    const content = await fs.readFile(absolutePath, "utf8");
    return {
      id: "session-recap-magic-guide",
      title: "Session Recap Magic Guide",
      path: relativePath,
      included: true,
      charCount: content.length,
      content: clampContent(content, 14000),
    };
  } catch (error) {
    return {
      id: "session-recap-magic-guide",
      title: "Session Recap Magic Guide",
      path: relativePath,
      included: false,
      charCount: 0,
      content: "",
      error: error instanceof Error ? error.message : "Could not read magic guide.",
    };
  }
}

export async function loadProseStyleExamples() {
  const relativePath = "newsroom-library/docs/15-prose-style-examples.md";
  const absolutePath = path.join(process.cwd(), "newsroom-library", "docs", "15-prose-style-examples.md");

  try {
    const content = await fs.readFile(absolutePath, "utf8");
    return {
      id: "prose-style-examples",
      title: "Prose Style Examples",
      path: relativePath,
      included: true,
      charCount: content.length,
      content: clampContent(content, 14000),
    };
  } catch (error) {
    return {
      id: "prose-style-examples",
      title: "Prose Style Examples",
      path: relativePath,
      included: false,
      charCount: 0,
      content: "",
      error: error instanceof Error ? error.message : "Could not read prose style examples.",
    };
  }
}

export async function loadTaskGuide(filename, id, title) {
  const relativePath = `newsroom-library/docs/${filename}`;
  const absolutePath = path.join(process.cwd(), "newsroom-library", "docs", filename);

  try {
    const content = await fs.readFile(absolutePath, "utf8");
    return {
      id,
      title,
      path: relativePath,
      included: true,
      charCount: content.length,
      content: clampContent(content, 12000),
    };
  } catch (error) {
    return {
      id,
      title,
      path: relativePath,
      included: false,
      charCount: 0,
      content: "",
      error: error instanceof Error ? error.message : "Could not read task guide.",
    };
  }
}
