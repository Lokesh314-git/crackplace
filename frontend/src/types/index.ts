export interface UserStats {
  totalQuestionsSolved: number;
  totalBattlesWon: number;
  totalMockTests: number;
}

export interface FavoriteItems {
  avatars?: string[];
  rings?: string[];
  backgrounds?: string[];
  frames?: string[];
  titles?: string[];
  themes?: string[];
  emotes?: string[];
  stickers?: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'student' | 'admin' | 'recruiter' | 'mentor';
  college: string;
  department: string;
  year: number;
  dreamCompany: string;
  skills: string[];
  bio: string;
  xp: number;
  totalXp?: number;
  coins: number;
  level: number;
  battleRating: number;
  dailyStreak: number;
  lastActiveDate: any; // Firebase Timestamp or ISO String
  placementReadinessScore: number;
  stats: UserStats;
  unlockedAchievements: string[];
  longestStreak?: number;
  lastLoginRewardClaimedDate?: string;
  loginStreakCount?: number;
  missionsState?: any;
  unlockedFrames?: string[];
  lastSpinDate?: string;
  mysteryBoxes?: number;
  createdAt: any;
  referredBy?: string;

  // Cosmetics System
  equippedAvatar?: string | null;
  equippedRing?: string | null;
  equippedFrame?: string | null;
  equippedBackground?: string | null;
  equippedTitle?: string | null;
  equippedTheme?: string | null;
  equippedEmote?: string | null;
  equippedEntrance?: string | null;
  equippedVictory?: string | null;
  unlockedAvatars?: string[];
  unlockedRings?: string[];
  unlockedBackgrounds?: string[];
  unlockedTitles?: string[];
  unlockedThemes?: string[];
  unlockedEmotes?: string[];
  unlockedEntrances?: string[];
  unlockedVictories?: string[];
  unlockedStickers?: string[];
  favoriteCosmetics?: string[];
  recentlyUsedCosmetics?: string[];
  favoriteItems?: FavoriteItems;

  // Customize Profile Details
  username?: string;
  usernameLower?: string;
  degree?: string;
  graduationYear?: string;
  semester?: string;
  careerGoal?: string;
  preferredRole?: string;
  country?: string;
  state?: string;
  city?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  leetcode?: string;
  hackerrank?: string;
  codeforces?: string;
  profileCompletedXPClaimed?: boolean;
  isLegendaryPlayer?: boolean;
}

export interface PlayerRewardResult {
  userId: string;
  username: string;
  outcome: 'WIN' | 'LOSS' | 'DRAW';
  score: number;
  opponentScore: number;
  xp: {
    previous: number;
    earned: number;
    current: number;
    levelBefore: number;
    levelAfter: number;
    leveledUp: boolean;
    levelsGained: number;
    progressPercentage: number;
    xpIntoCurrentLevel: number;
    xpRequiredForNextLevel: number;
  };
  coins: {
    previous: number;
    earned: number;
    current: number;
  };
  elo: {
    previous: number;
    change: number;
    current: number;
    expectedScore: number;
  };
  stats: {
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    accuracyPercentage: number;
    averageResponseTimeMs: number;
  };
}

export interface BattleResult {
  winnerId: string | null;
  isDraw: boolean;
  playerReward?: PlayerRewardResult;
  opponentReward?: PlayerRewardResult;
  playerDeltas?: {
    [userId: string]: {
      elo: number;
      xp: number;
      coins: number;
      score: number;
    };
  };
}
