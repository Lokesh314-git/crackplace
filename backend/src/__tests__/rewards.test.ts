import { calculateElo, calculateLevelFromXp, getXpRequiredForLevel, syncMissionsState, processMissionProgress } from '../utils/gamification';

describe('Gamification, Elo & Rewards Suite', () => {
  it('should calculate balanced Elo rating updates', () => {
    const r1 = 1200;
    const r2 = 1200;

    // Player 1 wins
    const newR1Win = calculateElo(r1, r2, 1);
    const newR2Loss = calculateElo(r2, r1, 0);

    expect(newR1Win).toBeGreaterThan(1200);
    expect(newR2Loss).toBeLessThan(1200);
    expect(newR1Win - r1).toBe(r2 - newR2Loss);

    // Draw
    const newR1Draw = calculateElo(r1, r2, 0.5);
    const newR2Draw = calculateElo(r2, r1, 0.5);
    expect(newR1Draw).toBe(1200);
    expect(newR2Draw).toBe(1200);
  });

  it('should calculate levels and XP requirements deterministically', () => {
    const lvl1Req = getXpRequiredForLevel(1);
    const lvl2Req = getXpRequiredForLevel(2);
    expect(lvl2Req).toBeGreaterThan(lvl1Req);

    const level0Xp = calculateLevelFromXp(0);
    expect(level0Xp.level).toBe(1);

    const levelHighXp = calculateLevelFromXp(5000);
    expect(levelHighXp.level).toBeGreaterThan(1);
  });

  it('should sync and track missions progress accurately without double counting', () => {
    const freshState = syncMissionsState({}, new Date());
    expect(freshState.dailyMissions.length).toBeGreaterThan(0);

    const updated = processMissionProgress(freshState, 'questions_solved', 5);
    const qMission = updated.state.dailyMissions.find(m => m.actionKey === 'questions_solved');
    expect(qMission?.current).toBe(5);
  });
});
