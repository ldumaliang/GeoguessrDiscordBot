import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fetchDailyChallengeResults } from "./geoguessr.js";
import { postDiscordMessage } from "./discord.js";
import { buildLeaderboardMessage } from "./format.js";
import { enrichDailyChallengeResultsWithLocations } from "./geocode.js";

const CACHE_DIR = ".cache";
const CACHE_FILE = "last_token.txt";

function getAuthCookie(): string {
  const ncfaToken = process.env.NCFA_TOKEN?.trim();
  if (ncfaToken) {
    return `_ncfa=${ncfaToken}`;
  }

  throw new Error("Missing NCFA_TOKEN environment variable.");
}

function parseIntEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `Invalid ${name} value. Expected an integer between ${min} and ${max}.`,
    );
  }

  return parsed;
}

function parseOptionalIntEnv(
  name: string,
  min: number,
  max: number,
): number | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `Invalid ${name} value. Expected an integer between ${min} and ${max}.`,
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
    59,
  );

  const daily = await fetchDailyChallengeResults(cookie, {
    closeHourUtc,
    closeMinuteUtc,
  });

  await enrichDailyChallengeResultsWithLocations(daily, {
    enabled: parseBoolEnv("GEOCODE_LOCATIONS", true),
    baseUrl: process.env.NOMINATIM_BASE_URL?.trim(),
    userAgent: process.env.NOMINATIM_USER_AGENT?.trim(),
    email: process.env.NOMINATIM_EMAIL?.trim(),
    language: process.env.NOMINATIM_LANGUAGE?.trim(),
    delayMs: parseOptionalIntEnv("NOMINATIM_DELAY_MS", 0, 10000),
    cachePath: process.env.NOMINATIM_CACHE_PATH?.trim(),
    zoom: parseOptionalIntEnv("NOMINATIM_ZOOM", 0, 18),
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
