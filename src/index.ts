import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fetchDailyChallenge } from "./geoguessr.js";
import { postDiscordMessage } from "./discord.js";
import { buildLeaderboardMessage } from "./format.js";

const CACHE_DIR = ".cache";
const CACHE_FILE = "last_token.txt";

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
  const cookie = process.env.GEOGUESSR_COOKIE;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!cookie) {
    throw new Error("Missing GEOGUESSR_COOKIE environment variable.");
  }

  if (!webhookUrl) {
    throw new Error("Missing DISCORD_WEBHOOK_URL environment variable.");
  }

  const daily = await fetchDailyChallenge(cookie);
  const friends = daily.friends ?? [];

  const lastToken = await readLastToken();
  if (lastToken && lastToken === daily.token) {
    console.log("Daily challenge already posted. Exiting.");
    return;
  }

  const message = buildLeaderboardMessage(daily, friends);
  await postDiscordMessage(webhookUrl, message);
  await writeLastToken(daily.token);

  console.log("Posted daily leaderboard to Discord.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
