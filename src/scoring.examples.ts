/**
 * Examples demonstrating the skill-based scoring algorithm using real data
 */

import {
  calculateSkillScore,
  compareSkillScores,
  calculateTotalSkillScore,
  getPerformanceRating,
  type RoundGuess,
} from "./scoring.js";

/**
 * Example 1: Ultra-fast no-move perfect guess
 * From results.json - Game 3, Round 2
 * This is the gold standard - minimal distance, no moves, very fast
 */
const perfectGuess: RoundGuess = {
  distanceInMeters: 339.05, // Just 339 meters!
  time: 27, // 27 seconds
  stepsCount: 0, // No moves at all
  roundScoreInPoints: 4999, // Original score
};

/**
 * Example 2: Good score but slow and inefficient
 * From results.json - Game 1, Round 2
 * Decent distance but took full time limit and many moves
 */
const slowGuess: RoundGuess = {
  distanceInMeters: 377202.7, // 377 km
  time: 180, // Timed out
  stepsCount: 38, // Many moves
  roundScoreInPoints: 3883, // Original score
};

/**
 * Example 3: Excellent distance with minimal exploration
 * From results.json - Game 1, Round 3
 * Very close guess with few moves and decent time
 */
const efficientGuess: RoundGuess = {
  distanceInMeters: 2788.77, // 2.8 km
  time: 110, // 1:50
  stepsCount: 4, // Only 4 moves
  roundScoreInPoints: 4991, // Original score
};

/**
 * Example 4: Fast guess with no moves
 * From results.json - Game 3, Round 1
 * Impressive speed and efficiency but slightly worse distance
 */
const fastNoMoveGuess: RoundGuess = {
  distanceInMeters: 5197.93, // 5.2 km
  time: 14, // Only 14 seconds!
  stepsCount: 0, // No moves
  roundScoreInPoints: 4983, // Original score
};

/**
 * Example 5: Terrible guess (wrong continent)
 * From results.json - Game 3, Round 3
 * This shows how the algorithm handles catastrophic failures
 */
const terribleGuess: RoundGuess = {
  distanceInMeters: 18634597.16, // 18,634 km - wrong continent
  time: 162, // Slow
  stepsCount: 3, // Few steps but still wrong
  roundScoreInPoints: 0, // Original score
};

/**
 * Run all examples and display results
 */
export function runScoringExamples(): void {
  console.log("=".repeat(80));
  console.log("GEOGUESSR SKILL-BASED SCORING ALGORITHM - EXAMPLES");
  console.log("=".repeat(80));
  console.log();

  // Example 1: Perfect guess
  console.log("Example 1: Ultra-Fast Perfect Guess (The Gold Standard)");
  console.log("-".repeat(80));
  const scored1 = calculateSkillScore(perfectGuess);
  console.log(
    `Distance: ${(perfectGuess.distanceInMeters / 1000).toFixed(1)} km`,
  );
  console.log(`Time: ${perfectGuess.time}s`);
  console.log(`Steps: ${perfectGuess.stepsCount}`);
  console.log(`Original Score: ${perfectGuess.roundScoreInPoints}`);
  console.log(
    `Skill Score: ${scored1.skillScore} ${getPerformanceRating(scored1.skillScore)}`,
  );
  console.log(`Breakdown: ${scored1.breakdown}`);
  console.log();

  // Example 2: Slow inefficient guess
  console.log("Example 2: Slow & Inefficient Guess");
  console.log("-".repeat(80));
  const scored2 = calculateSkillScore(slowGuess);
  console.log(`Distance: ${(slowGuess.distanceInMeters / 1000).toFixed(1)} km`);
  console.log(`Time: ${slowGuess.time}s (TIMED OUT)`);
  console.log(`Steps: ${slowGuess.stepsCount}`);
  console.log(`Original Score: ${slowGuess.roundScoreInPoints}`);
  console.log(
    `Skill Score: ${scored2.skillScore} ${getPerformanceRating(scored2.skillScore)}`,
  );
  console.log(`Breakdown: ${scored2.breakdown}`);
  console.log();

  // Example 3: Efficient guess
  console.log("Example 3: Efficient Exploration");
  console.log("-".repeat(80));
  const scored3 = calculateSkillScore(efficientGuess);
  console.log(
    `Distance: ${(efficientGuess.distanceInMeters / 1000).toFixed(1)} km`,
  );
  console.log(`Time: ${efficientGuess.time}s`);
  console.log(`Steps: ${efficientGuess.stepsCount}`);
  console.log(`Original Score: ${efficientGuess.roundScoreInPoints}`);
  console.log(
    `Skill Score: ${scored3.skillScore} ${getPerformanceRating(scored3.skillScore)}`,
  );
  console.log(`Breakdown: ${scored3.breakdown}`);
  console.log();

  // Example 4: Fast no-move
  console.log("Example 4: Lightning-Fast No-Move Guess");
  console.log("-".repeat(80));
  const scored4 = calculateSkillScore(fastNoMoveGuess);
  console.log(
    `Distance: ${(fastNoMoveGuess.distanceInMeters / 1000).toFixed(1)} km`,
  );
  console.log(`Time: ${fastNoMoveGuess.time}s`);
  console.log(`Steps: ${fastNoMoveGuess.stepsCount}`);
  console.log(`Original Score: ${fastNoMoveGuess.roundScoreInPoints}`);
  console.log(
    `Skill Score: ${scored4.skillScore} ${getPerformanceRating(scored4.skillScore)}`,
  );
  console.log(`Breakdown: ${scored4.breakdown}`);
  console.log();

  // Example 5: Terrible guess
  console.log("Example 5: Catastrophic Failure");
  console.log("-".repeat(80));
  const scored5 = calculateSkillScore(terribleGuess);
  console.log(
    `Distance: ${(terribleGuess.distanceInMeters / 1000).toFixed(0)} km`,
  );
  console.log(`Time: ${terribleGuess.time}s`);
  console.log(`Steps: ${terribleGuess.stepsCount}`);
  console.log(`Original Score: ${terribleGuess.roundScoreInPoints}`);
  console.log(
    `Skill Score: ${scored5.skillScore} ${getPerformanceRating(scored5.skillScore)}`,
  );
  console.log(`Breakdown: ${scored5.breakdown}`);
  console.log();

  // Comparison: Perfect vs Fast No-Move
  console.log("=".repeat(80));
  console.log("COMPARISON: Similar Scores, Different Skill Levels");
  console.log("=".repeat(80));
  console.log();
  console.log(
    "Both guesses have similar distance scores (~4999 original), but very different execution:",
  );
  console.log();
  console.log(compareSkillScores(perfectGuess, fastNoMoveGuess));
  console.log();

  // Full game calculation
  console.log("=".repeat(80));
  console.log("FULL GAME EXAMPLE");
  console.log("=".repeat(80));
  console.log();

  const gameGuesses: RoundGuess[] = [
    perfectGuess,
    efficientGuess,
    fastNoMoveGuess,
    slowGuess,
    {
      distanceInMeters: 119482.79,
      time: 117,
      stepsCount: 10,
      roundScoreInPoints: 4615,
    },
  ];

  const gameResult = calculateTotalSkillScore(gameGuesses);

  console.log("Game Summary:");
  console.log(`Total Original Score: ${gameResult.totalOriginalScore} / 25000`);
  console.log(`Total Skill Score: ${gameResult.totalSkillScore} / 25000`);
  console.log(
    `Improvement: ${gameResult.improvement > 0 ? "+" : ""}${gameResult.improvement} points`,
  );
  console.log();

  console.log("Round-by-Round Breakdown:");
  gameResult.scoredRounds.forEach((round, i) => {
    console.log(
      `  Round ${i + 1}: ${round.roundScoreInPoints} → ${round.skillScore} (${round.skillScore > round.roundScoreInPoints ? "+" : ""}${round.skillScore - round.roundScoreInPoints})`,
    );
    console.log(`    ${round.breakdown}`);
  });
  console.log();

  console.log("=".repeat(80));
  console.log("KEY INSIGHTS");
  console.log("=".repeat(80));
  console.log();
  console.log("The skill-based scoring rewards:");
  console.log("  ✓ Speed: Fast guesses get up to 2x multiplier");
  console.log("  ✓ Efficiency: No-move guesses get 1.5x multiplier");
  console.log("  ✓ Accuracy: Distance still matters most");
  console.log("  ✓ Strategy: Balance of all three factors yields best results");
  console.log();
  console.log("Penalties for:");
  console.log("  ✗ Timeouts: 0.5x multiplier (heavy penalty)");
  console.log("  ✗ Excessive exploration: Down to 0.8x for 50+ steps");
  console.log("  ✗ Poor distance: Exponential decay function");
  console.log();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runScoringExamples();
}
