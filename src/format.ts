import type { DailyChallengeResults, DailyFriendResult } from "./geoguessr.js";

const TOP_N_LIMIT = 25;
const DISTANCE_THRESHOLD_METERS = 1000;

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDistance(value: number): string {
  const km = value > DISTANCE_THRESHOLD_METERS ? value / 1000 : value;
  return km.toFixed(1);
}

function pad(value: string, length: number): string {
  return value.length >= length ? value : value.padEnd(length, " ");
}

function buildTable(entries: DailyFriendResult[]): string {
  const rows = entries.map((friend, index) => {
    return {
      rank: String(index + 1),
      name: friend.nick,
      score: Math.round(friend.totalScore).toString(),
      time: formatTime(friend.totalTime),
      distance: formatDistance(friend.totalDistance),
    };
  });

  const headers = {
    rank: "Rank",
    name: "Name",
    score: "Score",
    time: "Time",
    distance: "Dist(km)",
  };

  const widths = {
    rank: Math.max(headers.rank.length, ...rows.map((r) => r.rank.length)),
    name: Math.max(headers.name.length, ...rows.map((r) => r.name.length)),
    score: Math.max(headers.score.length, ...rows.map((r) => r.score.length)),
    time: Math.max(headers.time.length, ...rows.map((r) => r.time.length)),
    distance: Math.max(
      headers.distance.length,
      ...rows.map((r) => r.distance.length)
    ),
  };

  const headerLine = [
    pad(headers.rank, widths.rank),
    pad(headers.name, widths.name),
    pad(headers.score, widths.score),
    pad(headers.time, widths.time),
    pad(headers.distance, widths.distance),
  ].join(" | ");

  const separatorLine = [
    "-".repeat(widths.rank),
    "-".repeat(widths.name),
    "-".repeat(widths.score),
    "-".repeat(widths.time),
    "-".repeat(widths.distance),
  ].join("-+-");

  const dataLines = rows.map((row) => {
    return [
      pad(row.rank, widths.rank),
      pad(row.name, widths.name),
      pad(row.score, widths.score),
      pad(row.time, widths.time),
      pad(row.distance, widths.distance),
    ].join(" | ");
  });

  return [headerLine, separatorLine, ...dataLines].join("\n");
}

export function buildLeaderboardMessage(daily: DailyChallengeResults): string {
  const title = `GeoGuessr Daily - Friends (${daily.date})`;
  const participantLine = `Friends played: ${daily.results.length}`;

  if (daily.results.length === 0) {
    return `${title}\n${participantLine}\nNo friends completed this Daily.`;
  }

  const sorted = [...daily.results].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return a.totalTime - b.totalTime;
  });

  const top = sorted.slice(0, TOP_N_LIMIT);
  const table = buildTable(top);
  const remaining = sorted.length - top.length;
  const suffix = remaining > 0 ? `\n+${remaining} more` : "";

  return `${title}\n${participantLine}\n\n\`\`\`\n${table}\n\`\`\`${suffix}`;
}
