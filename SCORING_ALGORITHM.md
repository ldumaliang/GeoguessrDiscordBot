# GeoGuessr Skill-Based Scoring Algorithm

## Overview

The standard GeoGuessr scoring system (0-5000 points per round) is based primarily on distance from the actual location. While this is a good baseline, it doesn't differentiate between:

- **A 4999-point guess in 10 seconds with 0 steps** (extremely impressive)
- **A 5000-point guess in 3 minutes with 200 steps** (less impressive, despite being "perfect")

This skill-based scoring algorithm addresses this by considering **four factors**:

1. **Distance** - How close was the guess? (primary factor)
2. **Time** - How quickly was the guess made?
3. **Efficiency** - How many steps/moves were taken?
4. **Country** - Was the correct country guessed? (bonus)

## The Formula

```
skillScore = (distanceScore × timeFactor × efficiencyFactor) + countryBonus
```

Then clamped to **0-5000** range.

## Components Explained

### 1. Distance Score (0-5000 base)

Uses an exponential decay function based on distance:

```
distanceScore = 5000 × e^(-distance / 4000)
```

This produces scores like:
- **0m** → 5000 points
- **1km** → ~3894 points
- **5km** → ~1434 points
- **10km** → ~410 points
- **100km** → ~0 points

The scale factor (4000) determines how quickly the score decays. This can be tuned for more forgiving or stricter scoring.

### 2. Time Factor (0.5x - 2.0x multiplier)

Rewards speed, penalizes slowness:

| Time Range | Multiplier | Description |
|------------|-----------|-------------|
| **0-10s** | 2.0x - 1.83x | Ultra-fast |
| **10-30s** | 1.83x - 1.50x | Very fast (optimal) |
| **30-90s** | 1.50x - 1.05x | Normal |
| **90-150s** | 1.05x - 0.65x | Slow |
| **150-180s** | 0.65x - 0.50x | Very slow |
| **180s (timeout)** | 0.50x | Maximum penalty |

**Formula:**
```typescript
if (time <= optimalTime) {
  // Linear from 2.0x at 0s to 1.5x at optimalTime (30s)
  timeFactor = 2.0 - (time / optimalTime) * 0.5;
} else {
  // Exponential decay from 1.5x to 0.5x
  normalizedTime = (time - optimalTime) / (maxTime - optimalTime);
  timeFactor = 0.5 + e^(-2 × normalizedTime);
}
```

### 3. Efficiency Factor (0.8x - 1.5x multiplier)

Rewards minimal exploration, penalizes excessive movement:

| Steps | Multiplier | Description |
|-------|-----------|-------------|
| **0** | 1.50x | No-move guess (maximum bonus) |
| **1-5** | 1.50x - 1.30x | Minimal exploration |
| **6-10** | 1.30x - 1.10x | Efficient (optimal) |
| **11-25** | 1.10x - 1.00x | Normal |
| **26-50** | 1.00x - 0.90x | High |
| **50+** | 0.90x - 0.80x | Excessive (penalty) |

**Formula:**
```typescript
if (steps === 0) return 1.50;
if (steps <= 5) return 1.5 - (steps / 5) * 0.2;
if (steps <= 10) return 1.3 - ((steps - 5) / 5) * 0.2;
if (steps <= 25) return 1.1 - ((steps - 10) / 15) * 0.1;
if (steps <= 50) return 1.0 - ((steps - 25) / 25) * 0.1;
return 0.9 - Math.min(0.1, (steps - 50) / 500);
```

### 4. Country Bonus (+200 points)

A flat bonus if the guessed location is in the correct country:

```
countryBonus = correctCountry ? 200 : 0
```

This bonus is added **after** the multipliers are applied, rewarding players who demonstrate geographic knowledge.

## Examples from Real Data

### Example 1: Perfect No-Move Guess
```
Distance: 339m (0.3km)
Time: 27s
Steps: 0
Original Score: 4999

Calculation:
- Distance Score: 4594
- Time Factor: ×1.55 (fast, within optimal range)
- Efficiency Factor: ×1.50 (no moves)
- Skill Score: 4594 × 1.55 × 1.50 = 10,681 → clamped to 5000

Result: 5000 🏆 Perfect
```

This demonstrates **exceptional skill** - finding the exact location quickly without any exploration.

### Example 2: Slow & Inefficient
```
Distance: 377km
Time: 180s (timed out)
Steps: 38
Original Score: 3883

Calculation:
- Distance Score: 0 (too far)
- Time Factor: ×0.50 (timed out)
- Efficiency Factor: ×0.95 (too many steps)
- Skill Score: 0 × 0.50 × 0.95 = 0

Result: 0 ❌ Very Poor
```

This shows **poor performance** - even with a decent original score, the timeout and excessive exploration result in no skill points.

### Example 3: Fast But Less Accurate
```
Distance: 5.2km
Time: 14s
Steps: 0
Original Score: 4983

Calculation:
- Distance Score: 1363
- Time Factor: ×1.77 (very fast)
- Efficiency Factor: ×1.50 (no moves)
- Skill Score: 1363 × 1.77 × 1.50 = 3,617

Result: 3617 👍 Very Good
```

This demonstrates **strong gameplay** - while not as accurate, the combination of speed and no-move strategy shows skill.

## Comparison: Original vs Skill Score

Consider these two guesses on the same location:

| Metric | Player A | Player B |
|--------|----------|----------|
| Distance | 0.3km | 0.5km |
| Time | 27s | 120s |
| Steps | 0 | 45 |
| **Original Score** | **4999** | **4995** |
| **Skill Score** | **5000** | **2156** |

Both players achieved ~5000 points, but Player A clearly demonstrated more skill with:
- Similar accuracy
- Much faster completion (27s vs 120s)
- Zero exploration vs extensive exploration

The skill score properly reflects this difference: **5000 vs 2156**.

## Performance Ratings

The skill score translates to these performance tiers:

| Score Range | Rating | Emoji |
|-------------|--------|-------|
| 4999-5000 | Perfect | 🏆 |
| 4900-4998 | Legendary | ⭐ |
| 4700-4899 | Exceptional | 💎 |
| 4400-4699 | Outstanding | 🔥 |
| 4000-4399 | Excellent | ✨ |
| 3500-3999 | Very Good | 👍 |
| 3000-3499 | Good | 👌 |
| 2500-2999 | Decent | 🆗 |
| 2000-2499 | Fair | 📍 |
| 1000-1999 | Poor | 🤔 |
| 0-999 | Very Poor | ❌ |

## Configuration Options

The algorithm can be tuned with these parameters:

```typescript
interface ScoringConfig {
  maxTime: number;           // Default: 180 (3 minutes)
  optimalTime: number;       // Default: 30 (30 seconds)
  optimalSteps: number;      // Default: 10
  countryBonusPoints: number; // Default: 200
  strictMode: boolean;       // Default: false
}
```

## Usage

### Basic Usage

```typescript
import { calculateSkillScore } from "./scoring.js";

const guess = {
  distanceInMeters: 1500,
  time: 45,
  stepsCount: 5,
  roundScoreInPoints: 4950,
};

const scored = calculateSkillScore(guess, false);
console.log(`Skill Score: ${scored.skillScore}`);
console.log(`Breakdown: ${scored.breakdown}`);
```

### Full Game Calculation

```typescript
import { calculateTotalSkillScore } from "./scoring.js";

const gameGuesses = [/* array of 5 guesses */];
const correctCountries = [true, false, true, true, false];

const result = calculateTotalSkillScore(gameGuesses, correctCountries);
console.log(`Total Skill Score: ${result.totalSkillScore} / 25000`);
console.log(`vs Original: ${result.totalOriginalScore} / 25000`);
console.log(`Improvement: ${result.improvement} points`);
```

### With Country Detection

```typescript
import { calculateSkillScore } from "./scoring.js";
import { checkCorrectCountry } from "./country-detection.js";

const actualLocation = { lat: 4.671, lng: -74.101 };
const guessLocation = { lat: 4.699, lng: -74.076 };

const countryCheck = await checkCorrectCountry(
  actualLocation,
  guessLocation
);

const scored = calculateSkillScore(guess, countryCheck.correct);
```

## Run Examples

To see the algorithm in action with real data:

```bash
npm run scoring-examples
```

This will demonstrate the algorithm using actual GeoGuessr game data from the `endpoint-samples/results.json` file.

## Philosophy

The skill-based scoring rewards:

✓ **Quick thinking** - Fast pattern recognition and geographic knowledge
✓ **Efficiency** - Ability to pinpoint locations without extensive exploration
✓ **Accuracy** - Still the primary factor, distance matters most
✓ **Strategy** - Optimal balance of speed, efficiency, and accuracy

It penalizes:

✗ **Timeouts** - Taking the full time limit shows indecision
✗ **Excessive exploration** - Too much movement suggests trial-and-error rather than skill
✗ **Poor distance** - Accuracy is still paramount

The goal is to highlight truly exceptional gameplay where players demonstrate deep geographic knowledge, pattern recognition, and decision-making skills.
