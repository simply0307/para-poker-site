"use client";

export async function accountFetch(url, { method = "GET", body } = {}) {
  const response = await fetch(url, { method, credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The request could not be completed. Please try again.");
  return result;
}
