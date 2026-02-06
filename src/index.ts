import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fetchDailyChallengeResults } from "./geoguessr.js";
import { postDiscordMessage } from "./discord.js";
import { buildLeaderboardMessage } from "./format.js";
import { enrichDailyChallengeResultsWithLocations } from "./geocode.js";
import { recordDailyScores, parseHistoryFormat } from "./history.js";

const CACHE_DIR = ".cache";
const CACHE_FILE = "last_token.txt";
const DEFAULT_SCORE_HISTORY_PATH = "data/score-history.csv";
const DEFAULT_SCORE_HISTORY_FORMAT = "csv";

function getAuthCookie(): string {
  const ncfaToken = process.env.NCFA_TOKEN?.trim();
  if (ncfaToken) {
    return `_ncfa=${ncfaToken}`;
  }

  throw new Error(
    "Missing NCFA_TOKEN environment variable."
  );
}

function parseIntEnv(
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `Invalid ${name} value. Expected an integer between ${min} and ${max}.`
    );
  }

  return parsed;
}

function parseOptionalIntEnv(
  name: string,
  min: number,
  max: number
): number | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `Invalid ${name} value. Expected an integer between ${min} and ${max}.`
    );
  }

  return parsed;
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid ${name} value. Expected a boolean.`);
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

async function readLastToken(): Promise<string | null> {
  try {
    const content = await readFile(join(CACHE_DIR, CACHE_FILE), "utf8");
    return content.trim() || null;
  } catch {
    return null;
  }
}

async function writeLastToken(token: string): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(join(CACHE_DIR, CACHE_FILE), `${token}\n`, "utf8");
}

async function run(): Promise<void> {
  const cookie = getAuthCookie();
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    throw new Error("Missing DISCORD_WEBHOOK_URL environment variable.");
  }

  const closeHourUtc = parseIntEnv("DAILY_CHALLENGE_CLOSE_HOUR_UTC", 0, 0, 23);
  const closeMinuteUtc = parseIntEnv(
    "DAILY_CHALLENGE_CLOSE_MINUTE_UTC",
    0,
    0,
    59
  );

  const daily = await fetchDailyChallengeResults(cookie, {
    closeHourUtc,
    closeMinuteUtc
  });

  await enrichDailyChallengeResultsWithLocations(daily, {
    enabled: parseBoolEnv("GEOCODE_LOCATIONS", true),
    baseUrl: getOptionalEnv("NOMINATIM_BASE_URL"),
    userAgent: getOptionalEnv("NOMINATIM_USER_AGENT"),
    email: getOptionalEnv("NOMINATIM_EMAIL"),
    language: getOptionalEnv("NOMINATIM_LANGUAGE"),
    delayMs: parseOptionalIntEnv("NOMINATIM_DELAY_MS", 0, 10000),
    cachePath: getOptionalEnv("NOMINATIM_CACHE_PATH"),
    zoom: parseOptionalIntEnv("NOMINATIM_ZOOM", 0, 18)
  });

  await recordDailyScores(daily, {
    path: getOptionalEnv("SCORE_HISTORY_PATH") ?? DEFAULT_SCORE_HISTORY_PATH,
    format:
      parseHistoryFormat(getOptionalEnv("SCORE_HISTORY_FORMAT")) ??
      DEFAULT_SCORE_HISTORY_FORMAT
  });

  const cacheKey = daily.challengeToken ?? daily.date;
  const lastToken = await readLastToken();
  if (lastToken && lastToken === cacheKey) {
    console.log("Daily challenge already posted. Exiting.");
    return;
  }

  if (daily.results.length === 0) {
    console.log("No completed daily challenges yet. Skipping Discord post.");
    return;
  }

  const message = buildLeaderboardMessage(daily);
  await postDiscordMessage(webhookUrl, message);
  await writeLastToken(cacheKey);

  console.log("Posted daily leaderboard to Discord.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
