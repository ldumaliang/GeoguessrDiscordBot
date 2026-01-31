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

function pad(value: string, length: number): string {
  return value.length >= length ? value : value.padEnd(length, " ");
}

function buildLeaderboardSummary(entries: DailyFriendResult[]): string {
  const lines = entries.map((friend, index) => {
    const score = Math.round(friend.totalScore).toString();
    return `${index + 1}. ${friend.nick} — ${score} pts`;
  });

  return lines.join("\n");
}

function buildLeaderboardDetails(entries: DailyFriendResult[]): string {
  const lines = entries.map((friend) => {
    const score = Math.round(friend.totalScore).toString();
    const time = formatTime(friend.totalTime);
    const distance = formatDistance(friend.totalDistance);

    return `**${friend.nick}** — ${score} pts\n||Time ${time} • Dist ${distance} km||`;
  });

  return lines.join("\n\n");
}

function formatRoundLocations(
  locations: DailyChallengeRoundLocation[] | undefined
): string | null {
  if (!locations || locations.length === 0) {
    return null;
  }

  const lines = locations.map(
    (round) =>
      round.locationName
        ? `R${round.round}: ${round.locationName} (${round.lat.toFixed(6)}, ${round.lng.toFixed(6)})`
        : `R${round.round}: ${round.lat.toFixed(6)}, ${round.lng.toFixed(6)}`
  );

  return `\`\`\`\n${lines.join("\n")}\n\`\`\``;
}

function formatRoundResults(
  roundResults: DailyFriendRoundResult[],
  widths: {
    round: number;
    time: number;
    steps: number;
    score: number;
    guess: number;
  }
): string[] {
  return roundResults.map((round) => {
    const guess = round.guessedCountry
      ? `guess ${round.guessedCountry}`
      : "guess unknown";
    const roundLabel = pad(`R${round.round}`, widths.round);
    const timeLabel = pad(formatTime(round.time), widths.time);
    const stepsLabel = pad(`steps ${round.steps}`, widths.steps);
    const scoreLabel = pad(`score ${round.score}`, widths.score);
    const guessLabel = pad(guess, widths.guess);

    return `${roundLabel} ${timeLabel} | ${stepsLabel} | ${scoreLabel} | ${guessLabel}`;
  });
}

function formatPlayerBreakdowns(entries: DailyFriendResult[]): string | null {
  const lines: string[] = [];
  const allRoundResults = entries.flatMap(
    (entry) => entry.roundResults ?? []
  );
  const widths = {
    round: Math.max(
      "R10".length,
      ...allRoundResults.map((round) => `R${round.round}`.length),
      2
    ),
    time: Math.max(
      "00:00".length,
      ...allRoundResults.map((round) => formatTime(round.time).length),
      5
    ),
    steps: Math.max(
      "steps 0".length,
      ...allRoundResults.map((round) => `steps ${round.steps}`.length),
      7
    ),
    score: Math.max(
      "score 0".length,
      ...allRoundResults.map((round) => `score ${round.score}`.length),
      7
    ),
    guess: Math.max(
      "guess unknown".length,
      ...allRoundResults.map((round) =>
        (round.guessedCountry
          ? `guess ${round.guessedCountry}`
          : "guess unknown"
        ).length
      ),
      12
    )
  };

  for (const friend of entries) {
    if (!friend.roundResults || friend.roundResults.length === 0) {
      lines.push(`${friend.nick}: no round data`);
      continue;
    }

    lines.push(friend.nick);
    lines.push(
      ...formatRoundResults(friend.roundResults, widths).map(
        (line) => `  ${line}`
      )
    );
    lines.push("");
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  if (lines.length === 0) {
    return null;
  }

  return `\`\`\`\n${lines.join("\n")}\n\`\`\``;
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
  const details = buildLeaderboardDetails(top);
  const remaining = sorted.length - top.length;
  const suffix = remaining > 0 ? `\n+${remaining} more` : "";

  const sections = [
    `**${title}**\n${participantLine}\n\n**Leaderboard**\n${summary}${suffix}`,
    `**Leaderboard Details (tap to reveal)**\n${details}`
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
