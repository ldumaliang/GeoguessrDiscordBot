/**
 * Advanced scoring algorithm for GeoGuessr that rewards skill, speed, and efficiency
 *
 * The standard GeoGuessr score (0-5000) is based primarily on distance, but doesn't
 * differentiate between a 4999 achieved in 10 seconds with 2 steps vs. 3 minutes with 200 steps.
 *
 * This algorithm considers:
 * - Distance from actual location (primary factor)
 * - Time taken (speed bonus/penalty)
 * - Number of steps/moves (efficiency bonus/penalty)
 * - Correct country guess (bonus points)
 */

export interface RoundGuess {
  distanceInMeters: number;
  time: number; // seconds
  stepsCount: number;
  roundScoreInPoints: number; // original GeoGuessr score
  timedOut?: boolean;
  timedOutWithGuess?: boolean;
}

export interface ScoringConfig {
  // Maximum time limit for a round (seconds)
  maxTime: number;
  // Optimal time target for maximum time bonus (seconds)
  optimalTime: number;
  // Maximum steps before efficiency penalty kicks in
  optimalSteps: number;
  // Bonus points for guessing correct country
  countryBonusPoints: number;
  // Whether to apply strict penalties for poor performance
  strictMode: boolean;
}

export interface ScoredRound extends RoundGuess {
  skillScore: number;
  distanceScore: number;
  timeFactor: number;
  efficiencyFactor: number;
  countryBonus: number;
  breakdown: string;
}

export const DEFAULT_CONFIG: ScoringConfig = {
  maxTime: 180,
  optimalTime: 30,
  optimalSteps: 10,
  countryBonusPoints: 200,
  strictMode: false,
};

/**
 * Calculate distance-based score using a logarithmic decay function
 * This mimics GeoGuessr's scoring but can be tuned independently
 *
 * Formula: 5000 * e^(-distance / scale)
 * where scale determines how quickly score decays with distance
 */
export function calculateDistanceScore(distanceInMeters: number): number {
  // Scale factor: larger = more forgiving, smaller = stricter
  // ~4000 means you get 5000 at 0m, ~3000 at 1km, ~1800 at 4km
  const scale = 4000;

  const score = 5000 * Math.exp(-distanceInMeters / scale);

  // Ensure minimum score for any guess
  return Math.max(0, Math.min(5000, score));
}

/**
 * Calculate time factor multiplier (0.5x - 2.0x)
 *
 * Rewards:
 * - Ultra-fast (0-10s): 2.0x multiplier
 * - Very fast (10-30s): 1.5x - 2.0x multiplier
 * - Normal (30-90s): 1.0x - 1.5x multiplier
 * - Slow (90-150s): 0.8x - 1.0x multiplier
 * - Very slow/timeout (150-180s): 0.5x - 0.8x multiplier
 */
export function calculateTimeFactor(
  time: number,
  config: ScoringConfig,
): number {
  const { maxTime, optimalTime } = config;

  // Timed out - significant penalty
  if (time >= maxTime) {
    return 0.5;
  }

  // Ultra-fast (under optimal time)
  if (time <= optimalTime) {
    // Linear interpolation from 2.0x at 0s to 1.5x at optimalTime
    return 2.0 - (time / optimalTime) * 0.5;
  }

  // Normal to slow (optimalTime to maxTime)
  // Exponential decay from 1.5x at optimalTime to 0.5x at maxTime
  const normalizedTime = (time - optimalTime) / (maxTime - optimalTime);
  const decay = Math.exp(-2 * normalizedTime); // e^(-2t) gives good curve
  return 0.5 + decay * 1.0; // Range: 0.5x to 1.5x
}

/**
 * Calculate efficiency factor based on number of steps (0.8x - 1.5x)
 *
 * Rewards:
 * - No move guess (0 steps): 1.5x multiplier - extremely impressive
 * - Minimal exploration (1-5 steps): 1.3x - 1.5x multiplier
 * - Efficient (6-10 steps): 1.1x - 1.3x multiplier
 * - Normal (11-25 steps): 1.0x - 1.1x multiplier
 * - High (26-50 steps): 0.9x - 1.0x multiplier
 * - Excessive (50+ steps): 0.8x - 0.9x multiplier
 */
export function calculateEfficiencyFactor(
  stepsCount: number,
  config: ScoringConfig,
): number {
  const { optimalSteps } = config;

  // No-move guess - maximum bonus
  if (stepsCount === 0) {
    return 1.5;
  }

  // Minimal steps - excellent
  if (stepsCount <= 5) {
    // Linear from 1.5x at 0 steps to 1.3x at 5 steps
    return 1.5 - (stepsCount / 5) * 0.2;
  }

  // Efficient - good
  if (stepsCount <= optimalSteps) {
    // Linear from 1.3x at 5 steps to 1.1x at optimalSteps
    return 1.3 - ((stepsCount - 5) / (optimalSteps - 5)) * 0.2;
  }

  // Normal - neutral
  if (stepsCount <= 25) {
    // Linear from 1.1x at optimalSteps to 1.0x at 25 steps
    return 1.1 - ((stepsCount - optimalSteps) / (25 - optimalSteps)) * 0.1;
  }

  // High - slight penalty
  if (stepsCount <= 50) {
    // Linear from 1.0x at 25 steps to 0.9x at 50 steps
    return 1.0 - ((stepsCount - 25) / 25) * 0.1;
  }

  // Excessive - penalty
  // Diminishing penalty for steps beyond 50 (capped at 0.8x)
  const excessSteps = stepsCount - 50;
  const penalty = Math.min(0.1, excessSteps / 500);
  return 0.9 - penalty;
}

/**
 * Calculate the skill-based score for a round
 *
 * The skill score takes into account distance, time, and efficiency to produce
 * a fairer score that rewards impressive gameplay.
 */
export function calculateSkillScore(
  guess: RoundGuess,
  correctCountry: boolean = false,
  config: ScoringConfig = DEFAULT_CONFIG,
): ScoredRound {
  const distanceScore = calculateDistanceScore(guess.distanceInMeters);
  const timeFactor = calculateTimeFactor(guess.time, config);
  const efficiencyFactor = calculateEfficiencyFactor(guess.stepsCount, config);
  const countryBonus = correctCountry ? config.countryBonusPoints : 0;

  // Calculate final score
  let skillScore = distanceScore * timeFactor * efficiencyFactor + countryBonus;

  // Clamp to valid range
  skillScore = Math.max(0, Math.min(5000, Math.round(skillScore)));

  // Create breakdown explanation
  const breakdown = [
    `Distance: ${distanceScore.toFixed(0)}`,
    `Time: ×${timeFactor.toFixed(2)}`,
    `Efficiency: ×${efficiencyFactor.toFixed(2)}`,
    countryBonus > 0 ? `Country: +${countryBonus}` : null,
    `= ${skillScore}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    ...guess,
    skillScore,
    distanceScore,
    timeFactor,
    efficiencyFactor,
    countryBonus,
    breakdown,
  };
}

/**
 * Calculate total skill score for all rounds in a game
 */
export function calculateTotalSkillScore(
  guesses: RoundGuess[],
  correctCountries: boolean[] = [],
  config: ScoringConfig = DEFAULT_CONFIG,
): {
  totalSkillScore: number;
  totalOriginalScore: number;
  scoredRounds: ScoredRound[];
  improvement: number;
} {
  const scoredRounds = guesses.map((guess, i) =>
    calculateSkillScore(guess, correctCountries[i] || false, config),
  );

  const totalSkillScore = scoredRounds.reduce(
    (sum, round) => sum + round.skillScore,
    0,
  );

  const totalOriginalScore = guesses.reduce(
    (sum, guess) => sum + guess.roundScoreInPoints,
    0,
  );

  const improvement = totalSkillScore - totalOriginalScore;

  return {
    totalSkillScore,
    totalOriginalScore,
    scoredRounds,
    improvement,
  };
}

/**
 * Get a performance rating based on the skill score
 */
export function getPerformanceRating(skillScore: number): string {
  if (skillScore >= 4999) return "🏆 Perfect";
  if (skillScore >= 4900) return "⭐ Legendary";
  if (skillScore >= 4700) return "💎 Exceptional";
  if (skillScore >= 4400) return "🔥 Outstanding";
  if (skillScore >= 4000) return "✨ Excellent";
  if (skillScore >= 3500) return "👍 Very Good";
  if (skillScore >= 3000) return "👌 Good";
  if (skillScore >= 2500) return "🆗 Decent";
  if (skillScore >= 2000) return "📍 Fair";
  if (skillScore >= 1000) return "🤔 Poor";
  return "❌ Very Poor";
}

/**
 * Compare two guesses and explain which demonstrates more skill
 */
export function compareSkillScores(
  guess1: RoundGuess,
  guess2: RoundGuess,
  config: ScoringConfig = DEFAULT_CONFIG,
): string {
  const scored1 = calculateSkillScore(guess1, false, config);
  const scored2 = calculateSkillScore(guess2, false, config);

  const lines: string[] = [];
  lines.push("Guess 1:");
  lines.push(
    `  Original: ${guess1.roundScoreInPoints} | Skill: ${scored1.skillScore}`,
  );
  lines.push(`  ${scored1.breakdown}`);
  lines.push("");
  lines.push("Guess 2:");
  lines.push(
    `  Original: ${guess2.roundScoreInPoints} | Skill: ${scored2.skillScore}`,
  );
  lines.push(`  ${scored2.breakdown}`);
  lines.push("");

  if (scored1.skillScore > scored2.skillScore) {
    lines.push(
      `✓ Guess 1 demonstrates more skill (+${scored1.skillScore - scored2.skillScore} points)`,
    );
  } else if (scored2.skillScore > scored1.skillScore) {
    lines.push(
      `✓ Guess 2 demonstrates more skill (+${scored2.skillScore - scored1.skillScore} points)`,
    );
  } else {
    lines.push("= Both guesses demonstrate equal skill");
  }

  return lines.join("\n");
}
