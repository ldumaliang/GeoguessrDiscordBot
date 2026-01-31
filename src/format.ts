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
  const lines = entries.map((friend, index) => {
    const score = Math.round(friend.totalScore).toString();
    return `${index + 1}. ${friend.nick} — ${score} pts`;
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
    const coords = `${round.lat.toFixed(4)}, ${round.lng.toFixed(4)}`;
    if (round.locationName) {
      return `- R${round.round}: ${round.locationName}\n  (${coords})`;
    }

    return `- R${round.round}: (${coords})`;
  });

  return lines.join("\n");
}

function formatRoundResults(
  roundResults: DailyFriendRoundResult[]
): string[] {
  return roundResults.map((round) => {
    const guess = round.guessedCountry
      ? `guess ${round.guessedCountry}`
      : "guess unknown";

    return `- R${round.round}: ${formatTime(round.time)} • steps ${round.steps} • score ${round.score} • ${guess}`;
  });
}

function formatPlayerBreakdowns(entries: DailyFriendResult[]): string | null {
  const lines: string[] = [];
  for (const friend of entries) {
    const totalScore = Math.round(friend.totalScore).toString();
    const totalTime = formatTime(friend.totalTime);
    const totalDistance = formatDistance(friend.totalDistance);

    if (!friend.roundResults || friend.roundResults.length === 0) {
      lines.push(`**${friend.nick}**`);
      lines.push("_No round data._");
      lines.push(`Total: ${totalScore} pts • ${totalTime} • ${totalDistance} km`);
      lines.push("");
      continue;
    }

    lines.push(`**${friend.nick}**`);
    lines.push(...formatRoundResults(friend.roundResults));
    lines.push(`Total: ${totalScore} pts • ${totalTime} • ${totalDistance} km`);
    lines.push("");
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  if (lines.length === 0) {
    return null;
  }

  return lines.join("\n");
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

  const sections = [
    `**${title}**\n${participantLine}\n\n**Leaderboard**\n${summary}${suffix}`
  ];

  const roundLocations = formatRoundLocations(daily.roundLocations);
  if (roundLocations) {
    sections.push(`**Round Locations**\n${roundLocations}`);
    if (daily.roundLocations?.some((round) => round.locationName)) {
      sections.push("_Location data © OpenStreetMap contributors._");
    }
  } else {
    sections.push("**Round Locations**\nRound locations: unavailable.");
  }

  const playerBreakdowns = formatPlayerBreakdowns(sorted);
  if (playerBreakdowns) {
    sections.push(`**Player Round Breakdowns**\n${playerBreakdowns}`);
  } else {
    sections.push(
      "**Player Round Breakdowns**\nPlayer round breakdowns: unavailable."
    );
  }

  return sections.join("\n\n");
}
