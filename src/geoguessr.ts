import { z } from "zod";

const FRIEND_SCHEMA = z
  .object({
    id: z.string(),
    nick: z.string(),
    totalScore: z.number(),
    totalTime: z.number(),
    totalDistance: z.number(),
    countryCode: z.string().nullable().optional(),
    currentStreak: z.number().nullable().optional(),
    pinUrl: z.string().nullable().optional(),
    isVerified: z.boolean().optional(),
    flair: z.unknown().optional(),
    totalStepsCount: z.number().optional()
  })
  .passthrough();

const DAILY_SCHEMA = z
  .object({
    date: z.string(),
    token: z.string(),
    participants: z.number(),
    friends: z.array(FRIEND_SCHEMA).nullable()
  })
  .passthrough();

const RESPONSE_SCHEMA = z.array(DAILY_SCHEMA).min(1);

export type FriendResult = z.infer<typeof FRIEND_SCHEMA>;
export type DailyChallenge = z.infer<typeof DAILY_SCHEMA>;

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

export async function fetchDailyChallenge(
  cookie: string
): Promise<DailyChallenge> {
  const response = await fetchWithRetry(
    "https://www.geoguessr.com/api/v3/challenges/daily-challenges/previous",
    {
      headers: {
        Accept: "application/json",
        Cookie: cookie,
        "User-Agent": DEFAULT_USER_AGENT
      }
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GeoGuessr request failed (${response.status}): ${body.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const parsed = RESPONSE_SCHEMA.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `GeoGuessr response schema mismatch: ${parsed.error.message}`
    );
  }

  return parsed.data[0];
}
