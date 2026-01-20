import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { refreshNcfaToken, resolveNcfaToken } from "./auth.js";
import {
  fetchDailyChallengeResults,
  GeoGuessrAuthError,
  type DailyChallengeResults
} from "./geoguessr.js";
import { postDiscordMessage } from "./discord.js";
import { buildLeaderboardMessage } from "./format.js";

const CACHE_DIR = ".cache";
const CACHE_FILE = "last_token.txt";

function buildAuthCookie(token: string): string {
  return `_ncfa=${token}`;
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
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

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

  let token = await resolveNcfaToken();
  let cookie = buildAuthCookie(token);
  let daily: DailyChallengeResults;

  try {
    daily = await fetchDailyChallengeResults(cookie, {
      closeHourUtc,
      closeMinuteUtc
    });
  } catch (error) {
    if (!(error instanceof GeoGuessrAuthError)) {
      throw error;
    }

    console.warn(
      `GeoGuessr auth failed (${error.status}). Refreshing NCFA token and retrying.`
    );
    token = await refreshNcfaToken();
    cookie = buildAuthCookie(token);
    daily = await fetchDailyChallengeResults(cookie, {
      closeHourUtc,
      closeMinuteUtc
    });
  }

  const cacheKey = daily.challengeToken ?? daily.date;
  const lastToken = await readLastToken();
  if (lastToken && lastToken === cacheKey) {
    console.log("Daily challenge already posted. Exiting.");
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
