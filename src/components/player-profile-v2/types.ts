export type ProfileStat = {
  label: string;
  value: string;
  sourceKey?: string;
};

export type ProfileBadge = {
  label: string;
  tone?: "gold" | "green" | "blue" | "neutral" | string;
};

export type FeaturedProfileCard = {
  slot?: string;
  type?: string;
  label: string;
  title: string;
  value?: string;
  subtitle?: string;
  source?: string;
  sourceId?: string;
};

export type ProfileMoment = {
  id: string;
  title?: string;
  subtitle?: string;
  description?: string;
  displayTitle?: string;
  displaySummary?: string;
  displayMeta?: string;
  displayTags?: string[];
  contextLine?: string;
  sessionCode?: string;
  playedAt?: string;
  handNo?: string | number;
  potText?: string;
};

export type ProfileSession = {
  id: string;
  label: string;
  sessionCode?: string;
  dateText?: string;
  handsText?: string;
  resultText?: string;
  finishText?: string;
  pointsText?: string;
  approved?: boolean;
};

export type LockedProfileSection = {
  key: string;
  title: string;
  description: string;
  locked: boolean;
  requiredTier?: string;
};

export type RecapScope =
  | "hand"
  | "moment"
  | "session"
  | "player"
  | "season"
  | "division";

export type RecapStatus = "draft" | "approved" | "archived";

export type RecapTone =
  | "archive"
  | "sports"
  | "scouting"
  | "broadcast"
  | "neutral";

export type RecapSourceFact = {
  id: string;
  label: string;
  value: string;
  sourceTable: string;
  sourceId?: string;
  confidence?: "low" | "medium" | "high";
};

export type RecapArtifact = {
  id: string;
  scope: RecapScope;
  status: RecapStatus;
  tone?: RecapTone;
  visibility?: "public" | "private" | "unlisted";
  title: string;
  headline: string;
  dek?: string;
  summary: string;
  short_summary?: string;
  body: string;
  long_body?: string;
  key_takeaways?: string[];
  sourceSessionId?: string;
  sourceHandIds?: string[];
  source_hand_ids?: string[];
  source_fact_ids?: string[];
  sourcePlayerId?: string;
  seasonCode?: string;
  tags: string[];
  sourceFacts: RecapSourceFact[];
  createdAt?: string;
  updatedAt?: string;
  stored?: boolean;
};

export type MomentRecap = RecapArtifact & {
  scope: "hand" | "moment";
};

export type SessionRecap = RecapArtifact & {
  scope: "session";
};

export type PlayerRecap = RecapArtifact & {
  scope: "player" | "season";
};

export type PlayerProfileData = {
  playerName: string;
  slug: string;
  avatarUrl?: string;
  bio: string;
  rankText: string;
  pointsText: string;
  labelsText: string;
  coreStats: ProfileStat[];
  pokerStats: ProfileStat[];
  positionStats: ProfileStat[];
  notableHands: ProfileMoment[];
  recentSessions: ProfileSession[];
  badges: ProfileBadge[];
  identity?: {
    playerName: string;
    slug: string;
    avatarUrl?: string;
    bio: string;
    labelsText: string;
  };
  seasonStatus?: {
    seasonCode: string;
    rankText: string;
    pointsText: string;
    labelsText: string;
    approvedSessions?: number;
    bestFinish?: number | null;
  };
  publicHud?: {
    tier: "free" | string;
    stats: ProfileStat[];
  };
  featuredDisplay?: {
    mode: "default" | "player_selected" | string;
    cards: FeaturedProfileCard[];
    featuredMoment?: ProfileMoment | null;
    featuredStat?: ProfileStat | FeaturedProfileCard | null;
    badgeShelf?: ProfileBadge[];
  };
  styleProfile?: {
    primaryLabel?: string;
    secondaryLabel?: string;
    labelsText?: string;
    theme?: string;
    bannerUrl?: string;
    equippedBadges?: ProfileBadge[];
  };
  achievements?: ProfileBadge[];
  moments?: ProfileMoment[];
  lockedSections?: LockedProfileSection[];
  recaps?: {
    playerSeason?: PlayerRecap;
    featuredMoment?: MomentRecap;
    recentForm?: RecapArtifact;
    moments?: MomentRecap[];
  };
};
