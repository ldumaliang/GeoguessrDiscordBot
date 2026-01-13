import type { DailyChallenge, FriendResult } from "./geoguessr.js";

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDistance(value: number): string {
  const km = value > 1000 ? value / 1000 : value;
  return km.toFixed(1);
}

function pad(value: string, length: number): string {
  return value.length >= length ? value : value.padEnd(length, " ");
}

function buildTable(entries: FriendResult[]): string {
  const rows = entries.map((friend, index) => {
    return {
      rank: String(index + 1),
      name: friend.nick,
      score: Math.round(friend.totalScore).toString(),
      time: formatTime(friend.totalTime),
      distance: formatDistance(friend.totalDistance),
      streak: friend.currentStreak ? friend.currentStreak.toString() : "0"
    };
  });

  const headers = {
    rank: "Rank",
    name: "Name",
    score: "Score",
    time: "Time",
    distance: "Dist(km)",
    streak: "Streak"
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
    streak: Math.max(headers.streak.length, ...rows.map((r) => r.streak.length))
  };

  const headerLine = [
    pad(headers.rank, widths.rank),
    pad(headers.name, widths.name),
    pad(headers.score, widths.score),
    pad(headers.time, widths.time),
    pad(headers.distance, widths.distance),
    pad(headers.streak, widths.streak)
  ].join(" | ");

  const separatorLine = [
    "-".repeat(widths.rank),
    "-".repeat(widths.name),
    "-".repeat(widths.score),
    "-".repeat(widths.time),
    "-".repeat(widths.distance),
    "-".repeat(widths.streak)
  ].join("-+-");

  const dataLines = rows.map((row) => {
    return [
      pad(row.rank, widths.rank),
      pad(row.name, widths.name),
      pad(row.score, widths.score),
      pad(row.time, widths.time),
      pad(row.distance, widths.distance),
      pad(row.streak, widths.streak)
    ].join(" | ");
  });

  return [headerLine, separatorLine, ...dataLines].join("\n");
}

export function buildLeaderboardMessage(
  daily: DailyChallenge,
  friends: FriendResult[]
): string {
  const title = `GeoGuessr Daily — Friends (${daily.date})`;
  const participantLine = `Participants: ${daily.participants}`;

  if (friends.length === 0) {
    return `${title}\n${participantLine}\nNo friends have completed today’s Daily yet.`;
  }

  const sorted = [...friends].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return a.totalTime - b.totalTime;
  });

  const top = sorted.slice(0, 25);
  const table = buildTable(top);
  const remaining = sorted.length - top.length;
  const suffix = remaining > 0 ? `\n+${remaining} more` : "";

  return `${title}\n${participantLine}\n\n\`\`\`\n${table}\n\`\`\`${suffix}`;
}
