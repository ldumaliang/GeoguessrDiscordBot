import "dotenv/config";
import { fetchDailyChallengeResultsFromSamples } from "./geoguessr.samples.js";
import { postDiscordMessage } from "./discord.js";
import { buildLeaderboardMessage } from "./format.js";

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
    59
  );

  const daily = await fetchDailyChallengeResultsFromSamples({
    sampleDir: getOptionalEnv("SIMULATED_DATA_DIR"),
    targetDate: getOptionalEnv("SIMULATED_TARGET_DATE"),
    closeHourUtc,
    closeMinuteUtc
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
