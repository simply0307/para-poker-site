export function isMissingSchemaFieldError(error, fieldName) {
  if (!error || !fieldName) return false;
  const code = String(error.code || "");
  if (code !== "42703" && code !== "PGRST204") return false;
  const description = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return description.includes(String(fieldName).toLowerCase());
}
