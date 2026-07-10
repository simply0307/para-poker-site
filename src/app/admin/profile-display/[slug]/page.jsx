import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { getPlayerProfileData } from "@/lib/playerProfileData";
import {
  buildFeaturedCardOptions,
  mergeCurrentCardsIntoOptions,
  normalizeFeaturedCard,
  optionKeyForCard,
  sanitizeBackgroundUrl,
} from "@/lib/playerProfileDisplay";

export const dynamic = "force-dynamic";

const SEASON_CODE = "S0";
const FEATURED_SLOTS = ["featured_1", "featured_2", "featured_3"];
const BACKGROUND_FIELDS = [
  ["hero_bg_url", "Hero background URL", "hero"],
  ["featured_display_bg_url", "Featured Display background URL", "featuredDisplay"],
  ["public_hud_bg_url", "Public HUD background URL", "publicHud"],
  ["moments_bg_url", "Moments background URL", "moments"],
  ["achievements_bg_url", "Achievements background URL", "achievements"],
  ["locked_sections_bg_url", "Locked Sections background URL", "lockedSections"],
];

async function saveFeaturedDisplay(formData) {
  "use server";

  const slug = cleanSlug(formData.get("slug"));
  if (!slug) redirect("/admin/profile-display/unknown?error=Invalid+player+slug");

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, slug")
    .ilike("slug", slug)
    .maybeSingle();

  if (playerError || !player) {
    redirect(`/admin/profile-display/${encodeURIComponent(slug)}?error=Player+not+found`);
  }

  const profileData = await getPlayerProfileData(slug, SEASON_CODE);
  const options = mergeCurrentCardsIntoOptions(
    buildFeaturedCardOptions(profileData),
    profileData.featuredDisplay?.cards || []
  );
  const optionByKey = new Map(options.map((item) => [item.key, item.card]));
  const selectedKeys = FEATURED_SLOTS.map((slot) => String(formData.get(slot) || ""));

  if (selectedKeys.some((key) => !optionByKey.has(key))) {
    redirect(`/admin/profile-display/${encodeURIComponent(slug)}?error=Choose+three+valid+showcase+cards`);
  }

  if (new Set(selectedKeys).size !== 3) {
    redirect(`/admin/profile-display/${encodeURIComponent(slug)}?error=Choose+three+different+showcase+cards`);
  }

  const featuredCards = selectedKeys.map((key, index) =>
    normalizeFeaturedCard(optionByKey.get(key), index)
  );
  const backgroundValues = Object.fromEntries(
    BACKGROUND_FIELDS.map(([fieldName]) => [
      fieldName,
      sanitizeBackgroundUrl(formData.get(fieldName)),
    ])
  );
  const { error } = await supabase.from("player_profile_display").upsert(
    {
      player_id: player.id,
      season_code: SEASON_CODE,
      display_mode: "player_selected",
      featured_cards: featuredCards,
      ...backgroundValues,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id,season_code" }
  );

  if (error) {
    const message = isMissingDisplayTable(error)
      ? "player_profile_display table is missing; run the base SQL file in Supabase first"
      : isMissingCustomizationColumns(error)
        ? "Background columns are missing; run sql/player_profile_display_customization.sql in Supabase first"
        : `Could not save Featured Display: ${error.message}`;
    redirect(`/admin/profile-display/${encodeURIComponent(slug)}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/admin/profile-display/${slug}`);
  revalidatePath(`/plasmic-profile/${slug}`);
  revalidatePath(`/players-v2/${slug}`);
  revalidatePath("/players-v2");
  revalidatePath(`/dev/profile-data/${slug}`);
  redirect(`/admin/profile-display/${encodeURIComponent(slug)}?saved=1`);
}

export default async function ProfileDisplayEditorPage({ params, searchParams }) {
  const { slug: slugParam } = await params;
  const query = await searchParams;
  const slug = cleanSlug(slugParam);
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, slug, display_name, pokernow_name")
    .ilike("slug", slug)
    .maybeSingle();

  if (playerError || !player) {
    return (
      <main style={pageStyle}>
        <p style={eyebrowStyle}>Admin utility</p>
        <h1 style={headingStyle}>Player not found</h1>
        <p style={noticeStyle}>No player matched the slug &quot;{slug || slugParam}&quot;.</p>
      </main>
    );
  }

  const [profileData, displayResult] = await Promise.all([
    getPlayerProfileData(slug, SEASON_CODE),
    supabase
      .from("player_profile_display")
      .select("id, display_mode, featured_cards, hero_bg_url, featured_display_bg_url, public_hud_bg_url, moments_bg_url, achievements_bg_url, locked_sections_bg_url, updated_at")
      .eq("player_id", player.id)
      .eq("season_code", SEASON_CODE)
      .maybeSingle(),
  ]);
  const currentCards = profileData.featuredDisplay?.cards || [];
  const sectionBackgrounds = profileData.customization?.sectionBackgrounds || {};
  const options = mergeCurrentCardsIntoOptions(
    buildFeaturedCardOptions(profileData),
    currentCards
  );
  const tableError = displayResult.error;
  const tableMessage = tableError
    ? isMissingDisplayTable(tableError)
      ? "The player_profile_display table is not available yet. Run sql/player_profile_display.sql in the Supabase SQL Editor before saving."
      : isMissingCustomizationColumns(tableError)
        ? "The background fields are not available yet. Run sql/player_profile_display_customization.sql in the Supabase SQL Editor before saving."
        : `Featured Display storage is unavailable: ${tableError.message}`
    : "";

  return (
    <main style={pageStyle}>
      <p style={eyebrowStyle}>Admin utility - unauthenticated</p>
      <h1 style={headingStyle}>{profileData.playerName} Featured Display</h1>
      <p style={bodyStyle}>
        Choose exactly three showcase cards for season {SEASON_CODE}. Plasmic controls where these cards appear on the public profile.
      </p>

      <nav style={linkRowStyle} aria-label="Profile links">
        <Link href={`/players-v2/${slug}`}>Native public profile</Link>
        <Link href={`/plasmic-profile/${slug}`}>Plasmic profile</Link>
        <Link href={`/dev/profile-data/${slug}`}>Debug data</Link>
      </nav>

      {query?.saved === "1" ? <p style={successStyle}>Featured Display saved.</p> : null}
      {query?.error ? <p style={errorStyle}>{query.error}</p> : null}
      {tableMessage ? <p style={errorStyle}>{tableMessage}</p> : null}

      <section style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Current showcase</h2>
        <p style={mutedStyle}>Mode: {profileData.featuredDisplay?.mode || "default"}</p>
        <div style={cardGridStyle}>
          {currentCards.map((card) => <CardPreview key={card.slot} card={card} />)}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Select showcase cards</h2>
        <form action={saveFeaturedDisplay} style={formStyle}>
          <input type="hidden" name="slug" value={slug} />
          {FEATURED_SLOTS.map((slot, index) => {
            const selectedKey = optionKeyForCard(currentCards[index] || {});
            return (
              <label key={slot} style={fieldStyle}>
                <span style={labelStyle}>Featured card {index + 1}</span>
                <select name={slot} defaultValue={selectedKey} required style={selectStyle}>
                  <option value="" disabled>Select a card</option>
                  {options.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
            );
          })}
          <div style={formSectionStyle}>
            <h3 style={formHeadingStyle}>Section background images</h3>
            <p style={mutedStyle}>
              Paste an image URL. Upload support/gallery presets can be added later.
            </p>
            {BACKGROUND_FIELDS.map(([fieldName, label, customizationKey]) => (
              <label key={fieldName} style={fieldStyle}>
                <span style={labelStyle}>{label}</span>
                <input
                  type="url"
                  name={fieldName}
                  defaultValue={sectionBackgrounds[customizationKey] || ""}
                  placeholder="https://example.com/image.jpg"
                  style={selectStyle}
                />
              </label>
            ))}
          </div>
          <button type="submit" disabled={Boolean(tableError)} style={buttonStyle}>
            Save Featured Display
          </button>
        </form>
      </section>
    </main>
  );
}

function CardPreview({ card }) {
  return (
    <article style={cardStyle}>
      <div style={cardLabelStyle}>{card.label}</div>
      <strong style={cardTitleStyle}>{card.title}</strong>
      {card.value ? <div style={cardValueStyle}>{card.value}</div> : null}
      {card.subtitle ? <p style={cardSubtitleStyle}>{card.subtitle}</p> : null}
    </article>
  );
}

function cleanSlug(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isMissingDisplayTable(error) {
  const value = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return value.includes("pgrst205") || value.includes("42p01") || value.includes("relation public.player_profile_display does not exist");
}

function isMissingCustomizationColumns(error) {
  const value = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return value.includes("pgrst204") || BACKGROUND_FIELDS.some(([fieldName]) => value.includes(fieldName));
}

const pageStyle = { minHeight: "100vh", padding: 32, background: "#f4f4f5", color: "#18181b", fontFamily: "ui-sans-serif, system-ui, sans-serif" };
const eyebrowStyle = { margin: "0 0 8px", color: "#52525b", fontSize: 13, fontWeight: 700, textTransform: "uppercase" };
const headingStyle = { margin: 0, fontSize: 30 };
const bodyStyle = { maxWidth: 760, margin: "10px 0 18px", color: "#52525b", lineHeight: 1.5 };
const linkRowStyle = { display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 24 };
const sectionStyle = { maxWidth: 960, marginTop: 24, paddingTop: 20, borderTop: "1px solid #d4d4d8" };
const sectionHeadingStyle = { margin: "0 0 6px", fontSize: 20 };
const mutedStyle = { margin: "0 0 14px", color: "#71717a" };
const noticeStyle = { maxWidth: 720, padding: 16, border: "1px solid #d4d4d8", background: "white" };
const successStyle = { maxWidth: 920, padding: 12, background: "#dcfce7", border: "1px solid #86efac", color: "#166534" };
const errorStyle = { maxWidth: 920, padding: 12, background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b" };
const cardGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 12, width: "100%", maxWidth: "100%" };
const cardStyle = { boxSizing: "border-box", minWidth: 0, maxWidth: "100%", padding: 16, border: "1px solid #d4d4d8", borderRadius: 6, background: "white", overflow: "hidden" };
const cardLabelStyle = { color: "#71717a", fontSize: 12, fontWeight: 700, textTransform: "uppercase" };
const cardTitleStyle = { display: "block", marginTop: 8, fontSize: 18, overflowWrap: "anywhere" };
const cardValueStyle = { marginTop: 6, fontSize: 24, fontWeight: 800, overflowWrap: "anywhere" };
const cardSubtitleStyle = { margin: "8px 0 0", color: "#52525b", lineHeight: 1.4, overflowWrap: "anywhere" };
const formStyle = { display: "grid", gap: 16, maxWidth: 760, marginTop: 16 };
const formSectionStyle = { display: "grid", gap: 14, marginTop: 10, paddingTop: 18, borderTop: "1px solid #d4d4d8" };
const formHeadingStyle = { margin: 0, fontSize: 18 };
const fieldStyle = { display: "grid", gap: 6 };
const labelStyle = { fontWeight: 700 };
const selectStyle = { width: "100%", padding: "10px 12px", border: "1px solid #a1a1aa", borderRadius: 4, background: "white", color: "#18181b" };
const buttonStyle = { justifySelf: "start", padding: "10px 16px", border: 0, borderRadius: 4, background: "#18181b", color: "white", fontWeight: 700, cursor: "pointer" };
