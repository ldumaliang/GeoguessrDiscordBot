import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname } from "node:path";
import type { DailyChallengeResults, DailyFriendResult } from "./geoguessr.js";

export type HistoryFormat = "json" | "csv";

export type HistoryConfig = {
  path?: string;
  format?: HistoryFormat;
};

type HistoryEntry = {
  date: string;
  challengeToken: string | null;
  recordedAt: string;
  results: Array<{
    userId: string;
    nick: string;
    totalScore: number;
    totalTime: number;
    totalDistance: number;
    countryCode?: string | null;
    isVerified?: boolean;
  }>;
};

const CSV_HEADER =
  "date,challengeToken,userId,nick,totalScore,totalTime,totalDistance,countryCode,isVerified";

export function parseHistoryFormat(value?: string): HistoryFormat | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "json" || normalized === "csv") {
    return normalized;
  }

  throw new Error("Invalid SCORE_HISTORY_FORMAT value. Expected json or csv.");
}

function sortResults(results: DailyFriendResult[]): DailyFriendResult[] {
  return [...results].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return a.totalTime - b.totalTime;
  });
}

function resolveFormat(path: string, format?: HistoryFormat): HistoryFormat {
  if (format) {
    return format;
  }

  const extension = extname(path).toLowerCase();
  if (extension === ".json") {
    return "json";
  }
  if (extension === ".csv") {
    return "csv";
  }

  throw new Error(
    "Unsupported SCORE_HISTORY_PATH extension. Use .json or .csv, or set SCORE_HISTORY_FORMAT explicitly."
  );
}

function escapeCsv(value: string): string {
  if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildHistoryEntry(daily: DailyChallengeResults): HistoryEntry {
  const sorted = sortResults(daily.results);
  return {
    date: daily.date,
    challengeToken: daily.challengeToken ?? null,
    recordedAt: new Date().toISOString(),
    results: sorted.map((friend) => ({
      userId: friend.userId,
      nick: friend.nick,
      totalScore: friend.totalScore,
      totalTime: friend.totalTime,
      totalDistance: friend.totalDistance,
      countryCode: friend.countryCode,
      isVerified: friend.isVerified
    }))
  };
}

async function writeJsonHistory(
  filePath: string,
  daily: DailyChallengeResults
): Promise<void> {
  let entries: HistoryEntry[] = [];
  try {
    const content = await readFile(filePath, "utf8");
    if (content.trim()) {
      const parsed = JSON.parse(content) as unknown;
      if (Array.isArray(parsed)) {
        entries = parsed as HistoryEntry[];
      } else if (
        typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as { entries?: unknown }).entries)
      ) {
        entries = (parsed as { entries: HistoryEntry[] }).entries;
      } else {
        throw new Error("Invalid score history JSON format.");
      }
    }
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") {
      throw error;
    }
  }

  const entry = buildHistoryEntry(daily);
  entries = entries.filter((item) => item.date !== entry.date);
  entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

function buildCsvLine(cells: Array<string | number | undefined | null>): string {
  return cells
    .map((value) => {
      if (value === null || value === undefined) {
        return "";
      }
      return escapeCsv(String(value));
    })
    .join(",");
}

async function writeCsvHistory(
  filePath: string,
  daily: DailyChallengeResults
): Promise<void> {
  let dataLines: string[] = [];
  let hasHeader = false;

  try {
    const content = await readFile(filePath, "utf8");
    const lines = content
      .split(/\r?\n/)
      .filter((line: string) => line.length > 0);
    if (lines.length > 0) {
      hasHeader = lines[0] === CSV_HEADER;
      dataLines = hasHeader ? lines.slice(1) : lines;
    }
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") {
      throw error;
    }
  }

  const filteredLines = dataLines.filter(
    (line) => !line.startsWith(`${daily.date},`)
  );

  const sorted = sortResults(daily.results);
  const newLines = sorted.map((friend) =>
    buildCsvLine([
      daily.date,
      daily.challengeToken ?? "",
      friend.userId,
      friend.nick,
      friend.totalScore,
      friend.totalTime,
      friend.totalDistance,
      friend.countryCode ?? "",
      friend.isVerified === undefined ? "" : String(friend.isVerified)
    ])
  );

  const lines = [CSV_HEADER, ...filteredLines, ...newLines];

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

export async function recordDailyScores(
  daily: DailyChallengeResults,
  config: HistoryConfig
): Promise<void> {
  if (!config.path) {
    return;
  }

  if (daily.results.length === 0) {
    return;
  }

  const format = resolveFormat(config.path, config.format);
  if (format === "json") {
    await writeJsonHistory(config.path, daily);
    return;
  }

  await writeCsvHistory(config.path, daily);
}
