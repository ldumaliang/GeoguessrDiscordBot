import type {
  DailyChallengeResults,
  DailyFriendResult,
  DailyFriendRoundResult,
  DailyChallengeRoundLocation
} from "./geoguessr.js";

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDistance(value: number): string {
  const km = value > 1000 ? value / 1000 : value;
  return km.toFixed(1);
}

function buildLeaderboardSummary(entries: DailyFriendResult[]): string {
  const medals = ["🥇", "🥈", "🥉"];
  const lines = entries.map((friend, index) => {
    const score = Math.round(friend.totalScore).toString();
    const medal = medals[index] ? `${medals[index]} ` : "";
    return `${index + 1}. ${medal}${friend.nick} — ${score} pts`;
  });

  return lines.join("\n");
}

function formatRoundLocations(
  locations: DailyChallengeRoundLocation[] | undefined
): string | null {
  if (!locations || locations.length === 0) {
    return null;
  }

  const lines = locations.map((round) => {
    if (round.locationName) {
      return `- R${round.round}: ${round.locationName}`;
    }

    return `- R${round.round}: Unknown location`;
  });

  return lines.join("\n");
}

function formatRoundResultsTable(
  roundResults: DailyFriendRoundResult[]
): string[] {
  const headers = ["Round", "Steps", "Score", "Guess"];
  const rows = roundResults.map((round) => {
    return [
      round.round.toString(),
      round.steps.toString(),
      round.score.toString(),
      round.guessedCountry ?? "Unknown"
    ];
  });

  const widths = headers.map((header, index) => {
    const cellWidths = rows.map((row) => row[index].length);
    return Math.max(header.length, ...cellWidths);
  });

  const padRow = (cells: string[]) => {
    return cells
      .map((cell, index) => cell.padEnd(widths[index]))
      .join(" | ");
  };

  const headerLine = padRow(headers);
  const dividerLine = widths.map((width) => "-".repeat(width)).join(" | ");
  const dataLines = rows.map(padRow);

  return [headerLine, dividerLine, ...dataLines];
}

function formatPlayerBreakdowns(entries: DailyFriendResult[]): string | null {
  const sections: string[] = [];
  for (const friend of entries) {
    const totalScore = Math.round(friend.totalScore).toString();
    const totalTime = formatTime(friend.totalTime);
    const totalDistance = formatDistance(friend.totalDistance);
    const totalSteps = friend.roundResults?.reduce((sum, round) => {
      return sum + round.steps;
    }, 0) ?? 0;
    const totalsLine =
      `Total: ${totalScore}pts | ${totalSteps}steps | ${totalTime} | ${totalDistance}km`;

    if (!friend.roundResults || friend.roundResults.length === 0) {
      const block = ["No round data.", totalsLine].join("\n");
      sections.push(`**${friend.nick}**\n${wrapCodeBlock(block)}`);
      continue;
    }

    const tableLines = [
      ...formatRoundResultsTable(friend.roundResults),
      totalsLine
    ];
    sections.push(`**${friend.nick}**\n${wrapCodeBlock(tableLines.join("\n"))}`);
  }

  if (sections.length === 0) {
    return null;
  }

  return sections.join("\n\n");
}

function wrapCodeBlock(content: string): string {
  return `\`\`\`\n${content}\n\`\`\``;
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

  const top = sorted.slice(0, 25);
  const summary = buildLeaderboardSummary(top);
  const remaining = sorted.length - top.length;
  const suffix = remaining > 0 ? `\n+${remaining} more` : "";

  const sections = [`**${title}**\n${participantLine}`];
  sections.push(`**Leaderboard**\n${wrapCodeBlock(`${summary}${suffix}`)}`);

  const roundLocations = formatRoundLocations(daily.roundLocations);
  if (roundLocations) {
    sections.push(`**Round Locations**\n${wrapCodeBlock(roundLocations)}`);
  } else {
    sections.push(
      `**Round Locations**\n${wrapCodeBlock("Round locations: unavailable.")}`
    );
  }

  const playerBreakdowns = formatPlayerBreakdowns(sorted);
  if (playerBreakdowns) {
    sections.push(`**Player Round Breakdowns**\n\n${playerBreakdowns}`);
  } else {
    sections.push(
      `**Player Round Breakdowns**\n${wrapCodeBlock(
        "Player round breakdowns: unavailable."
      )}`
    );
  }

  return sections.join("\n\n");
}
