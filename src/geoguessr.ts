import { z } from "zod";
import {
  DEFAULT_USER_AGENT,
  sleep,
  MAX_RETRY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  RETRY_BACKOFF_MULTIPLIER,
  RETRYABLE_STATUS_CODES,
  REQUEST_TIMEOUT_MS,
} from "./utils.js";

export const PROFILE_SCHEMA = z
  .object({
    user: z.object({
      id: z.string(),
      nick: z.string(),
      countryCode: z.string().nullable().optional(),
      isVerified: z.boolean().optional(),
      pin: z.unknown().optional(),
    }),
  })
  .passthrough();

export const FRIEND_SCHEMA = z
  .object({
    userId: z.string(),
    nick: z.string(),
    countryCode: z.string().nullable().optional(),
    isVerified: z.boolean().optional(),
    flair: z.unknown().optional(),
  })
  .passthrough();

export const FRIENDS_RESPONSE_SCHEMA = z
  .object({
    friends: z.array(FRIEND_SCHEMA),
  })
  .passthrough();

export const DAILY_ENTRY_SCHEMA = z
  .object({
    date: z.string(),
    challengeToken: z.string(),
    totalScore: z.number(),
    totalTime: z.number(),
    totalDistance: z.number(),
  })
  .passthrough();

export const USER_STATS_SCHEMA = z
  .object({
    dailyChallengesRolling7Days: z.array(DAILY_ENTRY_SCHEMA).optional(),
  })
  .passthrough();

export type FriendSummary = z.infer<typeof FRIEND_SCHEMA>;
export type ProfileResponse = z.infer<typeof PROFILE_SCHEMA>;
export type DailyChallengeEntry = z.infer<typeof DAILY_ENTRY_SCHEMA>;

export type DailyFriendResult = {
  userId: string;
  nick: string;
  totalScore: number;
  totalTime: number;
  totalDistance: number;
  countryCode?: string | null;
  isVerified?: boolean;
  flair?: unknown;
};

export type DailyChallengeResults = {
  date: string;
  challengeToken: string | null;
  results: DailyFriendResult[];
};

type CloseConfig = {
  closeHourUtc: number;
  closeMinuteUtc: number;
};

// GeoGuessr API endpoints
const API_BASE_URL = "https://www.geoguessr.com/api/v3";
const PROFILE_URL = `${API_BASE_URL}/profiles`;
const FRIENDS_URL = `${API_BASE_URL}/social/friends/summary`;
const getUserStatsUrl = (userId: string) =>
  `${API_BASE_URL}/users/${userId}/stats`;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempt = 1
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return await handleFetchResponse(response, url, options, attempt);
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === "AbortError") {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms: ${url}`);
    }
    throw error;
  }
}

async function handleFetchResponse(
  response: Response,
  url: string,
  options: RequestInit,
  attempt: number
): Promise<Response> {
  if (response.ok) {
    return response;
  }

  if (response.status === 401 || response.status === 403) {
    return response;
  }

  if (
    RETRYABLE_STATUS_CODES.includes(response.status) &&
    attempt < MAX_RETRY_ATTEMPTS
  ) {
    const delay =
      RETRY_BASE_DELAY_MS * RETRY_BACKOFF_MULTIPLIER ** (attempt - 1);
    console.warn(
      `GeoGuessr request failed with ${response.status}. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}).`
    );
    await sleep(delay);
    return fetchWithRetry(url, options, attempt + 1);
  }

  return response;
}

function buildAuthHeaders(cookie: string): HeadersInit {
  return {
    Accept: "application/json",
    Cookie: cookie,
    "User-Agent": DEFAULT_USER_AGENT,
  };
}

export function getChallengeDayKey(
  date: string,
  closeHourUtc: number,
  closeMinuteUtc: number
): string {
  const value = new Date(date);
  const offsetMs = (closeHourUtc * 60 + closeMinuteUtc) * 60 * 1000;
  const shifted = new Date(value.getTime() - offsetMs);
  return shifted.toISOString().slice(0, 10);
}

function getTargetChallengeDay(
  now: Date,
  closeHourUtc: number,
  closeMinuteUtc: number
): string {
  const offsetMs = (closeHourUtc * 60 + closeMinuteUtc) * 60 * 1000;
  const shifted = new Date(now.getTime() - offsetMs);
  const target = new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() - 1
    )
  );
  return target.toISOString().slice(0, 10);
}

async function fetchProfile(cookie: string): Promise<FriendSummary> {
  const response = await fetchWithRetry(PROFILE_URL, {
    headers: buildAuthHeaders(cookie),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GeoGuessr profile request failed (${response.status}): ${body.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const parsed = PROFILE_SCHEMA.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `GeoGuessr profile schema mismatch: ${parsed.error.message}`
    );
  }

  const userProfile = parsed.data.user;
  console.log(
    `Retrieved profile for user: ${userProfile.nick} (${userProfile.id})`
  );

  return {
    userId: userProfile.id,
    nick: userProfile.nick,
    countryCode: userProfile.countryCode,
    isVerified: userProfile.isVerified,
  };
}

async function fetchFriendsSummary(cookie: string): Promise<FriendSummary[]> {
  const response = await fetchWithRetry(FRIENDS_URL, {
    headers: buildAuthHeaders(cookie),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GeoGuessr friends request failed (${response.status}): ${body.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const parsed = FRIENDS_RESPONSE_SCHEMA.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `GeoGuessr friends schema mismatch: ${parsed.error.message}`
    );
  }

  return parsed.data.friends;
}

async function fetchUserStats(
  cookie: string,
  userId: string
): Promise<DailyChallengeEntry[]> {
  const response = await fetchWithRetry(getUserStatsUrl(userId), {
    headers: buildAuthHeaders(cookie),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GeoGuessr stats request failed (${response.status}): ${body.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const parsed = USER_STATS_SCHEMA.safeParse(data);
  if (!parsed.success) {
    throw new Error(`GeoGuessr stats schema mismatch: ${parsed.error.message}`);
  }

  return parsed.data.dailyChallengesRolling7Days ?? [];
}

export async function fetchDailyChallengeResults(
  cookie: string,
  closeConfig?: Partial<CloseConfig>
): Promise<DailyChallengeResults> {
  const closeHourUtc = closeConfig?.closeHourUtc ?? 0;
  const closeMinuteUtc = closeConfig?.closeMinuteUtc ?? 0;
  const targetDate = getTargetChallengeDay(
    new Date(),
    closeHourUtc,
    closeMinuteUtc
  );

  const [profile, friends] = await Promise.all([
    fetchProfile(cookie),
    fetchFriendsSummary(cookie),
  ]);

  const usersById = new Map<string, FriendSummary>();
  for (const friend of friends) {
    usersById.set(friend.userId, friend);
  }
  usersById.set(profile.userId, profile);

  // Fetch all user stats in parallel for better performance
  const userStatsPromises = Array.from(usersById.values()).map(
    async (user) => ({
      user,
      stats: await fetchUserStats(cookie, user.userId),
    })
  );

  const settledResults = await Promise.allSettled(userStatsPromises);

  const results: DailyFriendResult[] = [];
  let challengeToken: string | null = null;

  for (const settled of settledResults) {
    if (settled.status === "rejected") {
      console.warn(`GeoGuessr stats request failed: ${settled.reason}`);
      continue;
    }

    const { user, stats } = settled.value;
    const entry = stats.find(
      (value) =>
        getChallengeDayKey(value.date, closeHourUtc, closeMinuteUtc) ===
        targetDate
    );

    if (!entry) {
      continue;
    }

    if (!challengeToken) {
      challengeToken = entry.challengeToken;
    }

    results.push({
      userId: user.userId,
      nick: user.nick,
      totalScore: entry.totalScore,
      totalTime: entry.totalTime,
      totalDistance: entry.totalDistance,
      countryCode: user.countryCode ?? null,
      isVerified: user.isVerified,
      flair: user.flair,
    });
  }

  return {
    date: targetDate,
    challengeToken,
    results,
  };
}
