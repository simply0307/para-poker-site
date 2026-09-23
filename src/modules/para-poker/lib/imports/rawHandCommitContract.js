const ALLOWED_COMMIT_FIELDS = new Set([
  "importId",
  "previewChecksum",
  "confirm",
  "confirmReplace",
  "expectedCurrentEvidenceRevisionId",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export function parseRawHandCommitBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TypeError("Commit body must be a JSON object.");
  const unknown = Object.keys(body).filter((key) => !ALLOWED_COMMIT_FIELDS.has(key));
  if (unknown.length) throw new TypeError(`Commit body contains unsupported fields: ${unknown.join(", ")}.`);
  if (!UUID_PATTERN.test(String(body.importId || ""))) throw new TypeError("importId must be a UUID.");
  if (!SHA256_PATTERN.test(String(body.previewChecksum || ""))) throw new TypeError("previewChecksum must be a lowercase SHA-256 value.");
  if (body.confirm !== true) throw new TypeError("confirm must be true.");
  if (typeof body.confirmReplace !== "boolean") throw new TypeError("confirmReplace must be boolean.");
  if (body.expectedCurrentEvidenceRevisionId !== null && !UUID_PATTERN.test(String(body.expectedCurrentEvidenceRevisionId || ""))) {
    throw new TypeError("expectedCurrentEvidenceRevisionId must be a UUID or null.");
  }
  return {
    importId: body.importId,
    previewChecksum: body.previewChecksum,
    confirm: true,
    confirmReplace: body.confirmReplace,
    expectedCurrentEvidenceRevisionId: body.expectedCurrentEvidenceRevisionId,
  };
}
