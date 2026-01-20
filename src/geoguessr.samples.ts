import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  FRIEND_SCHEMA,
  FRIENDS_RESPONSE_SCHEMA,
  PROFILE_SCHEMA,
  USER_STATS_SCHEMA,
  type DailyChallengeEntry,
  type DailyChallengeResults,
  type DailyFriendResult,
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

export async function fetchDailyChallengeResultsFromSamples(
  options: SampleDataOptions = {}
): Promise<DailyChallengeResults> {
  const sampleDir = options.sampleDir ?? "endpoint-samples";
  const closeHourUtc = options.closeHourUtc ?? 0;
  const closeMinuteUtc = options.closeMinuteUtc ?? 0;

  const [friendsRaw, profileRaw, userRaw] = await Promise.all([
    loadJsonFile(join(sampleDir, "friends.json")),
    loadJsonFile(join(sampleDir, "profile.json")),
    loadJsonFile(join(sampleDir, "user.json"))
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
  if (targetEntry) {
    for (const user of usersById.values()) {
      results.push({
        userId: user.userId,
        nick: user.nick,
        totalScore: targetEntry.totalScore,
        totalTime: targetEntry.totalTime,
        totalDistance: targetEntry.totalDistance,
        countryCode: user.countryCode ?? null,
        isVerified: user.isVerified,
        flair: user.flair
      });
    }
  }

  return {
    date: targetDate,
    challengeToken: targetEntry?.challengeToken ?? null,
    results
  };
}
