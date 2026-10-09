export interface ReadinessResult {
  score: number;
  displayText: string;
  isAssessed: boolean;
  statusLabel: string;
}

/**
 * Calculates and formats placement readiness quotient safely with zero NaN/undefined glitches.
 * This is now SERVER-AUTHORITATIVE, pulling directly from userProfile.placementReadinessScore.
 */
export function calculatePlacementReadiness(
  userProfile?: {
    placementReadinessScore?: number | null;
    stats?: { totalQuestionsSolved?: number; totalMockTests?: number; totalBattlesWon?: number };
    battleRating?: number;
    level?: number;
    xp?: number;
  } | null,
  quizHistory?: Array<{ results?: { score?: number } | null }> | null
): ReadinessResult {
  if (!userProfile) {
    return { score: 0, displayText: 'Not assessed', isAssessed: false, statusLabel: 'Not assessed' };
  }

  const storedScore = typeof userProfile.placementReadinessScore === 'number' && !isNaN(userProfile.placementReadinessScore)
    ? userProfile.placementReadinessScore
    : 0;

  const totalSolved = userProfile.stats?.totalQuestionsSolved || 0;
  const totalTests = userProfile.stats?.totalMockTests || 0;
  const totalBattles = userProfile.stats?.totalBattlesWon || 0;
  const hasHistory = Array.isArray(quizHistory) && quizHistory.length > 0;

  // Check if user has no assessments/activity yet
  if (totalSolved === 0 && totalTests === 0 && totalBattles === 0 && !hasHistory && storedScore === 0) {
    return {
      score: 0,
      displayText: 'Not assessed',
      isAssessed: false,
      statusLabel: 'Not assessed'
    };
  }

  // Server authoritative score
  let finalScore = Math.min(100, Math.max(0, Math.round(storedScore)));

  // Status Labels based on user requirements:
  // 0–24: Getting Started
  // 25–44: Building Foundation
  // 45–59: Developing
  // 60–74: Improving
  // 75–89: Strong
  // 90–100: Placement Ready

  let statusLabel = 'Getting Started';
  if (finalScore >= 90) statusLabel = 'Placement Ready';
  else if (finalScore >= 75) statusLabel = 'Strong';
  else if (finalScore >= 60) statusLabel = 'Improving';
  else if (finalScore >= 45) statusLabel = 'Developing';
  else if (finalScore >= 25) statusLabel = 'Building Foundation';

  return {
    score: finalScore,
    displayText: `${finalScore}%`,
    isAssessed: true,
    statusLabel
  };
}
