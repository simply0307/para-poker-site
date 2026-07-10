import { notFound } from "next/navigation";
import { getPlayerProfileData } from "@/lib/playerProfileData";

export const dynamic = "force-dynamic";

function sanitizeForDebug(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeForDebug);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (/secret|token|password|key/i.test(key)) {
          return [key, "[redacted]"];
        }

        return [key, sanitizeForDebug(entry)];
      })
    );
  }

  return value;
}

export default async function DevProfileDataPage({ params }) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { slug } = await params;
  const cleanSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";

  if (!cleanSlug) {
    notFound();
  }

  const profileData = await getPlayerProfileData(cleanSlug, "S0");
  const missingPlayer = profileData.playerName === "Player not found";

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 32,
        background: "#0a0a0a",
        color: "#f5f5f5",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <p style={{ color: "#fbbf24", fontWeight: 700, margin: "0 0 8px" }}>
        Development/debug view only.
      </p>
      <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>
        Player profileData JSON
      </h1>
      <p style={{ color: "#a1a1aa", margin: "0 0 24px" }}>
        This server-rendered page shows the normalized profile data returned by
        getPlayerProfileData(&quot;{cleanSlug}&quot;, &quot;S0&quot;).
      </p>

      {missingPlayer ? (
        <section
          style={{
            border: "1px solid rgba(251, 191, 36, 0.35)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            background: "rgba(251, 191, 36, 0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Player not found</h2>
          <p style={{ margin: 0, color: "#e4e4e7" }}>
            No Supabase player row matched slug &quot;{cleanSlug}&quot;.
          </p>
        </section>
      ) : null}

      <pre
        style={{
          overflow: "auto",
          padding: 16,
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "#111",
          color: "#e5e7eb",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {JSON.stringify(sanitizeForDebug(profileData), null, 2)}
      </pre>
    </main>
  );
}
