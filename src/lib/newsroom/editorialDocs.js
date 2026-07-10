import fs from "node:fs/promises";
import path from "node:path";

const EDITORIAL_DOCS = [
  {
    id: "native-v2-product-brief",
    title: "Native v2 Product Brief",
    filename: "00-product-brief.md",
    purpose: "Product purpose, audience, feel, and public loop.",
  },
  {
    id: "public-vs-internal-ui",
    title: "Public vs Internal UI",
    filename: "02-public-vs-internal-ui.md",
    purpose: "Rules for hiding debug/source metadata from public recap copy.",
  },
  {
    id: "recap-formats",
    title: "Recap Formats",
    filename: "03-recap-formats.md",
    purpose: "Moment, session, profile, and digest format rules.",
  },
  {
    id: "recap-voice-guide",
    title: "Recap Voice Guide",
    filename: "04-recap-voice-guide.md",
    purpose: "Voice, examples, allowed liberties, and forbidden claims.",
  },
  {
    id: "player-archetypes",
    title: "Player Archetypes",
    filename: "05-player-archetypes.md",
    purpose: "Player-facing style language and dignity rules.",
  },
  {
    id: "sample-session-s0-001",
    title: "Sample Session S0-001",
    filename: "06-sample-session-S0-001.md",
    purpose: "Grounded sample recap shape and factual boundaries.",
  },
  {
    id: "acceptance-criteria",
    title: "Acceptance Criteria",
    filename: "07-acceptance-criteria.md",
    purpose: "Done-state rules for public recap tone and internal separation.",
  },
  {
    id: "implementation-brief",
    title: "Implementation Brief",
    filename: "08-implementation-brief.md",
    purpose: "Native v2 implementation and editorial UX requirements.",
  },
];

function clampContent(value, maxChars = 12000) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[Truncated for prompt size; source doc continues in repo.]`;
}

export async function loadNewsroomEditorialDocs() {
  const docsRoot = path.join(process.cwd(), "docs", "native-v2");
  const docs = await Promise.all(
    EDITORIAL_DOCS.map(async (doc) => {
      const relativePath = `docs/native-v2/${doc.filename}`;
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
    version: "native-v2-editorial-docs-v1",
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
