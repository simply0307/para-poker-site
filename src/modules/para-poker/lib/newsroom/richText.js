const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "div",
  "em",
  "h2",
  "h3",
  "h4",
  "i",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "u",
  "ul",
]);

const ALLOWED_STYLE_PROPS = new Set([
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "line-height",
  "text-align",
  "text-decoration",
]);

export function hasRichTextMarkup(value = "") {
  return /<\/?[a-z][\s\S]*>/iu.test(String(value || ""));
}

export function plainTextToHtml(value = "") {
  return String(value || "")
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/gu, "<br />")}</p>`)
    .join("");
}

export function sanitizeRichText(value = "") {
  const withoutDangerousBlocks = String(value || "")
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/giu, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea)[^>]*\/?\s*>/giu, "");

  return withoutDangerousBlocks.replace(/<\s*(\/?)\s*([a-z0-9]+)([^>]*)>/giu, (_match, closing, rawTag, rawAttrs) => {
    const tag = String(rawTag || "").toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (closing) return `</${tag}>`;
    if (tag === "br") return "<br />";
    return `<${tag}${sanitizeAttrs(tag, rawAttrs)}>`;
  });
}

function sanitizeAttrs(tag, rawAttrs = "") {
  const attrs = [];
  const styleMatch = String(rawAttrs).match(/\sstyle\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/iu);
  const styleValue = styleMatch?.[2] || styleMatch?.[3] || styleMatch?.[4] || "";
  const safeStyle = sanitizeStyle(styleValue);
  if (safeStyle) attrs.push(`style="${escapeAttr(safeStyle)}"`);

  if (tag === "a") {
    const hrefMatch = String(rawAttrs).match(/\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/iu);
    const href = hrefMatch?.[2] || hrefMatch?.[3] || hrefMatch?.[4] || "";
    if (safeHref(href)) {
      attrs.push(`href="${escapeAttr(href)}"`);
      attrs.push('rel="noopener noreferrer"');
    }
  }

  return attrs.length ? ` ${attrs.join(" ")}` : "";
}

function sanitizeStyle(value = "") {
  return String(value)
    .split(";")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const [rawProp, ...rawValue] = rule.split(":");
      const prop = String(rawProp || "").trim().toLowerCase();
      const val = rawValue.join(":").trim();
      if (!ALLOWED_STYLE_PROPS.has(prop)) return "";
      if (/url\s*\(|expression\s*\(|javascript:/iu.test(val)) return "";
      return `${prop}: ${val}`;
    })
    .filter(Boolean)
    .join("; ");
}

function safeHref(value = "") {
  const href = String(value || "").trim();
  return /^(https?:|mailto:|\/|#)/iu.test(href) && !/javascript:/iu.test(href);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;");
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/"/gu, "&quot;");
}
