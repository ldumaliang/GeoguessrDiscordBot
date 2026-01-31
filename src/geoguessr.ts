import { z } from "zod";

export const PROFILE_SCHEMA = z
  .object({
    user: z.object({
      id: z.string(),
      nick: z.string(),
      countryCode: z.string().nullable().optional(),
      isVerified: z.boolean().optional(),
      pin: z.unknown().optional()
    })
  })
  .passthrough();

export const FRIEND_SCHEMA = z
  .object({
    userId: z.string(),
    nick: z.string(),
    countryCode: z.string().nullable().optional(),
    isVerified: z.boolean().optional(),
    flair: z.unknown().optional()
  })
  .passthrough();

export const FRIENDS_RESPONSE_SCHEMA = z
  .object({
    friends: z.array(FRIEND_SCHEMA)
  })
  .passthrough();

export const DAILY_ENTRY_SCHEMA = z
  .object({
    date: z.string(),
    challengeToken: z.string(),
    totalScore: z.number(),
    totalTime: z.number(),
    totalDistance: z.number()
  })
  .passthrough();

const RESULT_ROUND_SCHEMA = z
  .object({
    lat: z.number(),
    lng: z.number()
  })
  .passthrough();

const RESULT_GUESS_SCHEMA = z
  .object({
    time: z.number(),
    stepsCount: z.number(),
    roundScoreInPoints: z.number().optional(),
    roundScore: z
      .object({
        amount: z.string()
      })
      .optional()
  })
  .passthrough();

const RESULT_PLAYER_SCHEMA = z
  .object({
    id: z.string(),
    nick: z.string(),
    guesses: z.array(RESULT_GUESS_SCHEMA)
  })
  .passthrough();

const RESULT_GAME_SCHEMA = z
  .object({
    rounds: z.array(RESULT_ROUND_SCHEMA),
    player: RESULT_PLAYER_SCHEMA
  })
  .passthrough();

export const RESULTS_RESPONSE_SCHEMA = z
  .object({
    items: z.array(
      z
        .object({
          game: RESULT_GAME_SCHEMA
        })
        .passthrough()
    )
  })
  .passthrough();

export const USER_STATS_SCHEMA = z
  .object({
    dailyChallengesRolling7Days: z.array(DAILY_ENTRY_SCHEMA).optional()
  })
  .passthrough();

export type FriendSummary = z.infer<typeof FRIEND_SCHEMA>;
export type ProfileResponse = z.infer<typeof PROFILE_SCHEMA>;
export type DailyChallengeEntry = z.infer<typeof DAILY_ENTRY_SCHEMA>;

export type DailyFriendRoundResult = {
  round: number;
  time: number;
  steps: number;
  score: number;
  guessLat?: number;
  guessLng?: number;
  guessedCountry?: string;
};

export type DailyChallengeRoundLocation = {
  round: number;
  lat: number;
  lng: number;
  locationName?: string;
};

export type DailyFriendResult = {
  userId: string;
  nick: string;
  totalScore: number;
  totalTime: number;
  totalDistance: number;
  roundResults?: DailyFriendRoundResult[];
  countryCode?: string | null;
  isVerified?: boolean;
  flair?: unknown;
};

export type DailyChallengeResults = {
  date: string;
  challengeToken: string | null;
  results: DailyFriendResult[];
  roundLocations?: DailyChallengeRoundLocation[];
};

type CloseConfig = {
  closeHourUtc: number;
  closeMinuteUtc: number;
};

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempt = 1
): Promise<Response> {
  const response = await fetch(url, options);

  if (response.ok) {
    return response;
  }

  if (response.status === 401 || response.status === 403) {
    return response;
  }

  if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 3) {
    const delay = 500 * 2 ** (attempt - 1);
    console.warn(
      `GeoGuessr request failed with ${response.status}. Retrying in ${delay}ms (attempt ${attempt + 1}/3).`
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
    "User-Agent": DEFAULT_USER_AGENT
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
  const response = await fetchWithRetry(
    "https://www.geoguessr.com/api/v3/profiles",
    {
      headers: buildAuthHeaders(cookie)
    }
  );

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
  console.log(`Retrieved profile for user: ${userProfile.nick} (${userProfile.id})`);
  
  return {
    userId: userProfile.id,
    nick: userProfile.nick,
    countryCode: userProfile.countryCode,
    isVerified: userProfile.isVerified
  };
}

async function fetchFriendsSummary(cookie: string): Promise<FriendSummary[]> {
  const response = await fetchWithRetry(
    "https://www.geoguessr.com/api/v3/social/friends/summary",
    {
      headers: buildAuthHeaders(cookie)
    }
  );

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
  const response = await fetchWithRetry(
    `https://www.geoguessr.com/api/v3/users/${userId}/stats`,
    {
      headers: buildAuthHeaders(cookie)
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GeoGuessr stats request failed (${response.status}): ${body.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const parsed = USER_STATS_SCHEMA.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `GeoGuessr stats schema mismatch: ${parsed.error.message}`
    );
  }

  return parsed.data.dailyChallengesRolling7Days ?? [];
}

function extractRoundScore(guess: z.infer<typeof RESULT_GUESS_SCHEMA>): number {
  if (typeof guess.roundScoreInPoints === "number") {
    return guess.roundScoreInPoints;
  }

  const amount = guess.roundScore?.amount;
  if (amount) {
    const parsed = Number.parseInt(amount, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return 0;
}

async function fetchDetailedResults(
  cookie: string,
  challengeToken: string
): Promise<{
  roundLocations: DailyChallengeRoundLocation[];
  playerRoundsById: Map<string, DailyFriendRoundResult[]>;
  playerRoundsByNick: Map<string, DailyFriendRoundResult[]>;
} | null> {
  const response = await fetchWithRetry(
    `https://www.geoguessr.com/api/v3/results/highscores/${challengeToken}?friends=true`,
    {
      headers: buildAuthHeaders(cookie)
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.warn(
      `GeoGuessr detailed results request failed (${response.status}): ${body.slice(0, 200)}`
    );
    return null;
  }

  const data = await response.json();
  const parsed = RESULTS_RESPONSE_SCHEMA.safeParse(data);
  if (!parsed.success) {
    console.warn(
      `GeoGuessr detailed results schema mismatch: ${parsed.error.message}`
    );
    return null;
  }

  const playerRoundsById = new Map<string, DailyFriendRoundResult[]>();
  const playerRoundsByNick = new Map<string, DailyFriendRoundResult[]>();
  let roundLocations: DailyChallengeRoundLocation[] = [];

  for (const item of parsed.data.items) {
    const game = item.game;
    if (roundLocations.length === 0 && game.rounds.length > 0) {
      roundLocations = game.rounds.map((round, index) => ({
        round: index + 1,
        lat: round.lat,
        lng: round.lng
      }));
    }

    const guesses = game.player.guesses.map((guess, index) => ({
      round: index + 1,
      time: guess.time,
      steps: guess.stepsCount,
      score: extractRoundScore(guess),
      guessLat: guess.lat,
      guessLng: guess.lng
    }));
    playerRoundsById.set(game.player.id, guesses);
    playerRoundsByNick.set(game.player.nick.toLowerCase(), guesses);
  }

  return {
    roundLocations,
    playerRoundsById,
    playerRoundsByNick
  };
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
    fetchFriendsSummary(cookie)
  ]);

  const usersById = new Map<string, FriendSummary>();
  for (const friend of friends) {
    usersById.set(friend.userId, friend);
  }
  usersById.set(profile.userId, profile);

  const results: DailyFriendResult[] = [];
  let challengeToken: string | null = null;

  for (const user of usersById.values()) {
    try {
      const entries = await fetchUserStats(cookie, user.userId);
      const entry = entries.find(
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
        flair: user.flair
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`GeoGuessr stats request failed for ${user.userId}: ${message}`);
    }
  }

  let roundLocations: DailyChallengeRoundLocation[] | undefined;
  if (challengeToken) {
    const detailed = await fetchDetailedResults(cookie, challengeToken);
    if (detailed) {
      roundLocations = detailed.roundLocations;
      for (const result of results) {
        const roundResults =
          detailed.playerRoundsById.get(result.userId) ??
          detailed.playerRoundsByNick.get(result.nick.toLowerCase());
        if (roundResults) {
          result.roundResults = roundResults;
        }
      }
    }
  }

  return {
    date: targetDate,
    challengeToken,
    results,
    roundLocations
  };
}
