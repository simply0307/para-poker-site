import ProfileSectionFrame from "./ProfileSectionFrame";
import PlayerHeroModule from "./PlayerHeroModule";
import FeaturedDisplayModule from "./FeaturedDisplayModule";
import PublicHudModule from "./PublicHudModule";
import MomentsModule from "./MomentsModule";
import AchievementsModule from "./AchievementsModule";
import LockedSectionsModule from "./LockedSectionsModule";
import styles from "./ProfileLayout.module.css";

export default function PlayerProfileLayout({ profileData }) {
  const backgrounds = profileData.customization?.sectionBackgrounds || {};

  return (
    <main className={styles.layout}>
      <ProfileSectionFrame
        hero
        backgroundUrl={backgrounds.hero || "/images/para-poker-profile-hero.webp"}
      >
        <PlayerHeroModule
          identity={profileData.identity}
          seasonStatus={profileData.seasonStatus}
          coreStats={profileData.coreStats}
        />
      </ProfileSectionFrame>

      <ProfileSectionFrame
        eyebrow="Player showcase"
        title="Featured Display"
        description="Selected stats, results, and moments from the current profile."
        backgroundUrl={backgrounds.featuredDisplay}
      >
        <FeaturedDisplayModule cards={profileData.featuredDisplay?.cards} />
      </ProfileSectionFrame>

      <ProfileSectionFrame
        eyebrow="Free profile data"
        title="Public HUD"
        description={`Tracked public statistics for ${profileData.seasonStatus?.seasonCode || "the current season"}.`}
        backgroundUrl={backgrounds.publicHud}
        tone="alt"
      >
        <PublicHudModule stats={profileData.publicHud?.stats} />
      </ProfileSectionFrame>

      <ProfileSectionFrame
        eyebrow="Season highlights"
        title="Season Highlights"
        description="Short recaps of the hands, pressure spots, and results shaping this player file."
        backgroundUrl={backgrounds.moments}
      >
        <MomentsModule moments={profileData.moments} />
      </ProfileSectionFrame>

      <ProfileSectionFrame
        eyebrow="Profile progress"
        title="Achievements"
        description="Current public badges and season milestones."
        backgroundUrl={backgrounds.achievements}
        tone="alt"
      >
        <AchievementsModule achievements={profileData.achievements} />
      </ProfileSectionFrame>

      <ProfileSectionFrame
        eyebrow="Scouting products"
        title="Scouting & HUD"
        description="A preview of deeper player intelligence planned for future access tiers."
        backgroundUrl={backgrounds.lockedSections}
        tone="muted"
      >
        <LockedSectionsModule sections={profileData.lockedSections} />
      </ProfileSectionFrame>
    </main>
  );
}
