export interface GameConfig {
  scoring: {
    correctBasePoints: number;
    wrongPoints: number;
    unansweredPoints: number;
    speedBonusEnabled: boolean;
    speedBonusMax: number;
    speedBonusThresholdMs: number;
    difficultyMultipliers: {
      easy: number;
      medium: number;
      hard: number;
    };
  };
  xp: {
    battleWinBonus: number;
    battleLossReward: number;
    battleDrawReward: number;
    battlePerCorrectAnswer: number;
    quizParticipation: number;
    quizPerCorrectAnswer: number;
    quizPerfectBonus: number;
    codingChallengePass: number;
    hrInterviewCompletion: number;
    battle: {
      win: number;
      loss: number;
      draw: number;
      perCorrectAnswer: number;
      perfectBonus: number;
    };
  };
  coins: {
    battleWin: number;
    battleLoss: number;
    battleDraw: number;
    quizParticipation: number;
    quizPerCorrectAnswer: number;
    quizPerfectBonus: number;
    dailyLoginBase: number;
    dailyLoginDay7: number;
    luckySpinCost: number;
    battle: {
      win: number;
      loss: number;
      draw: number;
    };
    quiz: {
      basePerQuiz: number;
      perfectScoreBonus: number;
    };
    rewards: {
      practice: {
        completionBonus: number;
        tiers: { minScore: number; minCoins: number; maxCoins: number }[];
      };
      battle: {
        winBonus: number;
        participationBonus: number;
        tiers: { minScore: number; minCoins: number; maxCoins: number }[];
      };
    };
  };
  elo: {
    startingRating: number;
    kFactor: number;
    minRatingFloor: number;
    minFloor: number;
    maxCeiling?: number;
  };
  levels: {
    level1Xp: number;
    levelGrowthIncrement: number;
  };
}

export const GAME_CONFIG: GameConfig = {
  scoring: {
    correctBasePoints: 20,
    wrongPoints: 0,
    unansweredPoints: 0,
    speedBonusEnabled: true,
    speedBonusMax: 5,
    speedBonusThresholdMs: 8000,
    difficultyMultipliers: {
      easy: 1.0,
      medium: 1.0,
      hard: 1.25
    }
  },
  xp: {
    battleWinBonus: 40,
    battleLossReward: 10,
    battleDrawReward: 20,
    battlePerCorrectAnswer: 5,
    quizParticipation: 60,
    quizPerCorrectAnswer: 10,
    quizPerfectBonus: 50,
    codingChallengePass: 100,
    hrInterviewCompletion: 80,
    battle: {
      win: 40,
      loss: 10,
      draw: 20,
      perCorrectAnswer: 5,
      perfectBonus: 10
    }
  },
  coins: {
    battleWin: 20,
    battleLoss: 5,
    battleDraw: 10,
    quizParticipation: 30,
    quizPerCorrectAnswer: 5,
    quizPerfectBonus: 25,
    dailyLoginBase: 5,
    dailyLoginDay7: 50,
    luckySpinCost: 50,
    battle: {
      win: 20,
      loss: 5,
      draw: 10
    },
    quiz: {
      basePerQuiz: 25,
      perfectScoreBonus: 15
    },
    rewards: {
      practice: {
        completionBonus: 10,
        tiers: [
          { minScore: 100, minCoins: 100, maxCoins: 200 },
          { minScore: 90, minCoins: 80, maxCoins: 150 },
          { minScore: 80, minCoins: 60, maxCoins: 120 },
          { minScore: 70, minCoins: 45, maxCoins: 90 },
          { minScore: 60, minCoins: 30, maxCoins: 60 },
          { minScore: 50, minCoins: 20, maxCoins: 40 },
          { minScore: 0, minCoins: 10, maxCoins: 25 },
        ]
      },
      battle: {
        winBonus: 75,
        participationBonus: 10,
        tiers: [
          { minScore: 100, minCoins: 100, maxCoins: 200 },
          { minScore: 90, minCoins: 80, maxCoins: 150 },
          { minScore: 80, minCoins: 60, maxCoins: 120 },
          { minScore: 70, minCoins: 45, maxCoins: 90 },
          { minScore: 60, minCoins: 30, maxCoins: 60 },
          { minScore: 50, minCoins: 20, maxCoins: 40 },
          { minScore: 0, minCoins: 10, maxCoins: 25 },
        ]
      }
    }
  },
  elo: {
    startingRating: 1000,
    kFactor: 32,
    minRatingFloor: 100,
    minFloor: 100
  },
  levels: {
    level1Xp: 100,
    levelGrowthIncrement: 50
  }
};

export default GAME_CONFIG;
