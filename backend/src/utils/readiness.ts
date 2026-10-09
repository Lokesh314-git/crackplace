export const CORE_SUBJECTS = [
  'Quantitative Aptitude',
  'Logical Reasoning',
  'Verbal Ability', // Matches typical frontend usage, or we can use mapping
  'DSA',
  'DBMS',
  'Operating Systems',
  'Computer Networks',
  'HR' // Or Behavioral
];

export function calculatePlacementReadiness(userData: any): number {
  if (!userData) return 0;

  const stats = userData.stats || {};
  const subjectPerformance = stats.subjectPerformance || {};

  let totalSubjectScore = 0;
  let subjectsCounted = CORE_SUBJECTS.length;

  for (const subject of CORE_SUBJECTS) {
    // try to find matching subject key
    const perfKey = Object.keys(subjectPerformance).find(k => k.toLowerCase().includes(subject.toLowerCase().split(' ')[0]));
    const perf = perfKey ? subjectPerformance[perfKey] : null;
    
    if (!perf || perf.attempted === 0) {
      continue;
    }
    const accuracy = Math.round((perf.correct / perf.attempted) * 100);
    totalSubjectScore += accuracy;
  }

  const subjectBaseScore = (totalSubjectScore / subjectsCounted) * 0.7;

  const mockTests = stats.totalMockTests || 0;
  const mockTestScore = Math.min(15, mockTests * 1.5);

  const battleRating = userData.battleRating || 1000;
  let battleScore = 0;
  if (battleRating > 1000) {
    battleScore = Math.min(15, ((battleRating - 1000) / 500) * 15);
  } else {
    const battleWins = stats.totalBattlesWon || 0;
    battleScore = Math.min(15, battleWins * 1.5);
  }

  const rawScore = subjectBaseScore + mockTestScore + battleScore;

  let fallbackScore = 0;
  const hasSubjectData = Object.keys(subjectPerformance).some(
    k => subjectPerformance[k] && subjectPerformance[k].attempted > 0
  );
  if (!hasSubjectData) {
    const totalQuestionsSolved = stats.totalQuestionsSolved || 0;
    const level = userData.level || 1;
    fallbackScore = Math.min(100, (totalQuestionsSolved * 0.3) + (level * 2));
  }

  let finalScore = hasSubjectData ? rawScore : Math.max(rawScore, fallbackScore);

  return Math.min(100, Math.max(0, Math.round(finalScore)));
}
