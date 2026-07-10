import ProfileSectionFrame from "@/components/profile-layout/ProfileSectionFrame";
import FeaturedDisplayModule from "@/components/profile-layout/FeaturedDisplayModule";

export function registerProfileLayoutComponents(loader) {
  loader.registerComponent(ProfileSectionFrame, {
    name: "ProfileSectionFrame",
    displayName: "Profile Section Frame",
    description: "Reusable full-width profile section with an optional heading and background image.",
    props: {
      eyebrow: "string",
      title: { type: "string", defaultValue: "Profile Section" },
      description: "string",
      backgroundUrl: "string",
      tone: {
        type: "choice",
        options: ["default", "alt", "muted"],
        defaultValue: "default",
      },
      hero: "boolean",
      children: "slot",
    },
  });

  loader.registerComponent(FeaturedDisplayModule, {
    name: "FeaturedDisplayModule",
    displayName: "Featured Display Module",
    description: "Responsive three-card player showcase using the Featured Display card contract.",
    props: {
      cards: {
        type: "array",
        itemType: {
          type: "object",
          nameFunc: (item) => item?.title || item?.label || "Featured card",
          fields: {
            slot: "string",
            type: "string",
            label: "string",
            title: "string",
            value: "string",
            subtitle: "string",
            source: "string",
            sourceId: "string",
          },
        },
        defaultValue: [
          {
            slot: "featured_1",
            type: "stat",
            label: "Featured Stat",
            title: "VPIP",
            value: "42.0%",
            subtitle: "Free public HUD stat",
            source: "preview",
            sourceId: "vpip_pct",
          },
          {
            slot: "featured_2",
            type: "result",
            label: "Season Standing",
            title: "Ranked #2 in S0",
            value: "#2",
            subtitle: "7 points through 1 approved session",
            source: "preview",
            sourceId: "rank",
          },
          {
            slot: "featured_3",
            type: "moment",
            label: "Featured Moment",
            title: "Showdown Win",
            value: "Hand #12",
            subtitle: "Tracked profile moment",
            source: "preview",
            sourceId: "moment",
          },
        ],
      },
    },
  });
}
