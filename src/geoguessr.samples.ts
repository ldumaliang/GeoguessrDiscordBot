import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  FRIEND_SCHEMA,
  FRIENDS_RESPONSE_SCHEMA,
  PROFILE_SCHEMA,
  RESULTS_RESPONSE_SCHEMA,
  USER_STATS_SCHEMA,
  type DailyChallengeRoundLocation,
  type DailyChallengeEntry,
  type DailyChallengeResults,
  type DailyFriendResult,
  type DailyFriendRoundResult,
  type FriendSummary,
  getChallengeDayKey
} from "./geoguessr.js";

export type SampleDataOptions = {
  sampleDir?: string;
  closeHourUtc?: number;
  closeMinuteUtc?: number;
  targetDate?: string;
};

async function loadJsonFile(path: string): Promise<unknown> {
  const content = await readFile(path, "utf8");
  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON in ${path}: ${message}`);
  }
}

async function loadOptionalJsonFile(path: string): Promise<unknown | null> {
  try {
    return await loadJsonFile(path);
  } catch {
    return null;
  }
}

function resolveSampleProfile(raw: unknown): FriendSummary {
  if (raw && typeof raw === "object" && "user" in raw) {
    const parsed = PROFILE_SCHEMA.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Sample profile schema mismatch: ${parsed.error.message}`
      );
    }

    const userProfile = parsed.data.user;
    return {
      userId: userProfile.id,
      nick: userProfile.nick,
      countryCode: userProfile.countryCode,
      isVerified: userProfile.isVerified
    };
  }

  const parsed = FRIEND_SCHEMA.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Sample profile schema mismatch: ${parsed.error.message}`);
  }

  return parsed.data;
}

function getLatestChallengeDayKey(
  entries: DailyChallengeEntry[],
  closeHourUtc: number,
  closeMinuteUtc: number
): string | null {
  let latestKey: string | null = null;
  let latestTime = -Infinity;

  for (const entry of entries) {
    const timestamp = Date.parse(entry.date);
    if (Number.isNaN(timestamp)) {
      continue;
    }

    if (timestamp > latestTime) {
      latestTime = timestamp;
      latestKey = getChallengeDayKey(entry.date, closeHourUtc, closeMinuteUtc);
    }
  }

  return latestKey;
}

function resolveSampleTargetDate(
  entries: DailyChallengeEntry[],
  closeHourUtc: number,
  closeMinuteUtc: number,
  override?: string
): string {
  const trimmedOverride = override?.trim();
  if (trimmedOverride) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedOverride)) {
      throw new Error(
        "Invalid SIMULATED_TARGET_DATE value. Expected YYYY-MM-DD."
      );
    }
    return trimmedOverride;
  }

  const latestKey = getLatestChallengeDayKey(
    entries,
    closeHourUtc,
    closeMinuteUtc
  );
  if (!latestKey) {
    throw new Error("Sample data is missing daily challenge entries.");
  }

  return latestKey;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function jitterValue(
  value: number,
  minFactor: number,
  maxFactor: number,
  minValue: number,
  maxValue: number,
  round = false
): number {
  const factor = randomBetween(minFactor, maxFactor);
  const jittered = Math.max(minValue, Math.min(maxValue, value * factor));
  return round ? Math.round(jittered) : jittered;
}

export async function fetchDailyChallengeResultsFromSamples(
  options: SampleDataOptions = {}
): Promise<DailyChallengeResults> {
  const sampleDir = options.sampleDir ?? "endpoint-samples";
  const closeHourUtc = options.closeHourUtc ?? 0;
  const closeMinuteUtc = options.closeMinuteUtc ?? 0;

  const [friendsRaw, profileRaw, userRaw, resultsRaw] = await Promise.all([
    loadJsonFile(join(sampleDir, "friends.json")),
    loadJsonFile(join(sampleDir, "profile.json")),
    loadJsonFile(join(sampleDir, "user.json")),
    loadOptionalJsonFile(join(sampleDir, "results.json"))
  ]);

  const friendsParsed = FRIENDS_RESPONSE_SCHEMA.safeParse(friendsRaw);
  if (!friendsParsed.success) {
    throw new Error(
      `Sample friends schema mismatch: ${friendsParsed.error.message}`
    );
  }

  const profile = resolveSampleProfile(profileRaw);

  const userParsed = USER_STATS_SCHEMA.safeParse(userRaw);
  if (!userParsed.success) {
    throw new Error(
      `Sample user stats schema mismatch: ${userParsed.error.message}`
    );
  }

  const entries = userParsed.data.dailyChallengesRolling7Days ?? [];
  const targetDate = resolveSampleTargetDate(
    entries,
    closeHourUtc,
    closeMinuteUtc,
    options.targetDate
  );

  const targetEntry = entries.find(
    (value) =>
      getChallengeDayKey(value.date, closeHourUtc, closeMinuteUtc) === targetDate
  );

  const usersById = new Map<string, FriendSummary>();
  for (const friend of friendsParsed.data.friends) {
    usersById.set(friend.userId, friend);
  }
  usersById.set(profile.userId, profile);

  const results: DailyFriendResult[] = [];
  const maxScore = 25000;
  const maxTimeSeconds = 15 * 60;
  const maxDistanceMeters = Math.PI * 6371 * 1000 * 5;
  let roundLocations: DailyChallengeRoundLocation[] | undefined;
  const roundResultsById = new Map<string, DailyFriendRoundResult[]>();
  const roundResultsByNick = new Map<string, DailyFriendRoundResult[]>();

  if (resultsRaw) {
    const resultsParsed = RESULTS_RESPONSE_SCHEMA.safeParse(resultsRaw);
    if (!resultsParsed.success) {
      throw new Error(
        `Sample results schema mismatch: ${resultsParsed.error.message}`
      );
    }

    for (const item of resultsParsed.data.items) {
      if (!roundLocations && item.game.rounds.length > 0) {
        roundLocations = item.game.rounds.map((round, index) => ({
          round: index + 1,
          lat: round.lat,
          lng: round.lng
        }));
      }

      const roundResults = item.game.player.guesses.map((guess, index) => {
        let score = guess.roundScoreInPoints;
        if (typeof score !== "number") {
          const parsed = guess.roundScore?.amount
            ? Number.parseInt(guess.roundScore.amount, 10)
            : Number.NaN;
          score = Number.isNaN(parsed) ? 0 : parsed;
        }

        return {
          round: index + 1,
          time: guess.time,
          steps: guess.stepsCount,
          score,
          guessLat: guess.lat,
          guessLng: guess.lng
        };
      });

      roundResultsById.set(item.game.player.id, roundResults);
      roundResultsByNick.set(item.game.player.nick.toLowerCase(), roundResults);
    }
  }

  if (targetEntry) {
    for (const user of usersById.values()) {
      const roundResults =
        roundResultsById.get(user.userId) ??
        roundResultsByNick.get(user.nick.toLowerCase());
      results.push({
        userId: user.userId,
        nick: user.nick,
        totalScore: jitterValue(
          targetEntry.totalScore,
          0.75,
          1.05,
          0,
          maxScore,
          true
        ),
        totalTime: jitterValue(
          targetEntry.totalTime,
          0.8,
          1.3,
          0,
          maxTimeSeconds,
          true
        ),
        totalDistance: jitterValue(
          targetEntry.totalDistance,
          0.7,
          1.4,
          0,
          maxDistanceMeters
        ),
        roundResults,
        countryCode: user.countryCode ?? null,
        isVerified: user.isVerified,
        flair: user.flair
      });
    }
  }

  return {
    date: targetDate,
    challengeToken: targetEntry?.challengeToken ?? null,
    results,
    roundLocations
  };
}
