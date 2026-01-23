import "dotenv/config";
import { fetchDailyChallengeResultsFromSamples } from "./geoguessr.samples.js";
import { postDiscordMessage } from "./discord.js";
import { buildLeaderboardMessage } from "./format.js";
import { enrichDailyChallengeResultsWithLocations } from "./geocode.js";

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

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

async function run(): Promise<void> {
  const closeHourUtc = parseIntEnv("DAILY_CHALLENGE_CLOSE_HOUR_UTC", 0, 0, 23);
  const closeMinuteUtc = parseIntEnv(
    "DAILY_CHALLENGE_CLOSE_MINUTE_UTC",
    0,
    0,
    59,
  );

  const daily = await fetchDailyChallengeResultsFromSamples({
    sampleDir: getOptionalEnv("SIMULATED_DATA_DIR"),
    targetDate: getOptionalEnv("SIMULATED_TARGET_DATE"),
    closeHourUtc,
    closeMinuteUtc,
  });

  await enrichDailyChallengeResultsWithLocations(daily, {
    enabled: parseBoolEnv("GEOCODE_LOCATIONS", true),
    baseUrl: getOptionalEnv("NOMINATIM_BASE_URL"),
    userAgent: getOptionalEnv("NOMINATIM_USER_AGENT"),
    email: getOptionalEnv("NOMINATIM_EMAIL"),
    language: getOptionalEnv("NOMINATIM_LANGUAGE"),
    delayMs: parseOptionalIntEnv("NOMINATIM_DELAY_MS", 0, 10000),
    cachePath: getOptionalEnv("NOMINATIM_CACHE_PATH"),
    zoom: parseOptionalIntEnv("NOMINATIM_ZOOM", 0, 18),
  });

  const message = buildLeaderboardMessage(daily);
  console.log("Simulated leaderboard message:");
  console.log(message);

  const webhookUrl = getOptionalEnv("DISCORD_WEBHOOK_URL");
  if (webhookUrl) {
    await postDiscordMessage(webhookUrl, message);
    console.log("Posted simulated leaderboard to Discord.");
  } else {
    console.log("DISCORD_WEBHOOK_URL not set; skipping Discord post.");
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
