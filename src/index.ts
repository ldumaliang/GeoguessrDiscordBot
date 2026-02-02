import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fetchDailyChallengeResults } from "./geoguessr.js";
import { postDiscordMessage } from "./discord.js";
import { buildLeaderboardMessage } from "./format.js";
import { parseIntEnv, getRequiredEnv, getRequiredUrl } from "./utils.js";
import { enrichDailyChallengeResultsWithLocations } from "./geocode.js";

const CACHE_DIR = ".cache";
const CACHE_FILE = "last_token.txt";

function getAuthCookie(): string {
  const ncfaToken = getRequiredEnv("NCFA_TOKEN");
  return `_ncfa=${ncfaToken}`;
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

async function readLastToken(): Promise<string | null> {
  try {
    const content = await readFile(join(CACHE_DIR, CACHE_FILE), "utf8");
    return content.trim() || null;
  } catch (error) {
    // File not found is expected on first run
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    // Log other filesystem errors but continue
    console.warn("Failed to read cache file:", error);
    return null;
  }
}

async function writeLastToken(token: string): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, CACHE_FILE), `${token}\n`, "utf8");
  } catch (error) {
    // Log but don't fail the entire run if cache write fails
    console.warn("Failed to write cache file:", error);
  }
}

async function run(): Promise<void> {
  const cookie = getAuthCookie();
  const webhookUrl = getRequiredUrl("DISCORD_WEBHOOK_URL");

  const closeHourUtc = parseIntEnv("DAILY_CHALLENGE_CLOSE_HOUR_UTC", 0, 0, 23);
  const closeMinuteUtc = parseIntEnv(
    "DAILY_CHALLENGE_CLOSE_MINUTE_UTC",
    0,
    0,
    59
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
    zoom: parseOptionalIntEnv("NOMINATIM_ZOOM", 0, 18)
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
