"""Shared constants for endpoints and SQL queries."""

from __future__ import annotations

# API endpoints
BASE_V3_URL = "https://www.geoguessr.com/api/v3/"

DAILY_CHALLENGE_ENDPOINT = "challenges/daily-challenges/today"
DAILY_CHALLENGE_STATUS_ENDPOINT = "challenges/daily-challenges/today/"
RESULTS_HIGHSCORES_ENDPOINT = "results/highscores/"
RESULTS_FLAGS_FRIENDS_LIMIT = "?friends=true&limit=26&minRounds=5"
SIGN_IN_ENDPOINT = "accounts/signin"
FRIENDS_SUMMARY_ENDPOINT = "social/friends/summary"
PROFILE_ENDPOINT = "profiles"

# SQL queries
SQL_SELECT_CHALLENGE_BY_TOKEN = "SELECT * FROM Challenge WHERE ChallengeToken = ?"
SQL_INSERT_CHALLENGE = "INSERT INTO Challenge (ChallengeToken, Time) VALUES (?, datetime('now'))"
SQL_SELECT_TODAYS_CHALLENGE = "SELECT ChallengeID, ChallengeToken FROM Challenge ORDER BY Time DESC LIMIT 1"
SQL_SELECT_USER_BY_GEO_ID = "SELECT * FROM User WHERE GeoId = ?"
SQL_SELECT_USER_BY_DISCORD_ID = "SELECT * FROM User WHERE DiscordId = ?"
SQL_SELECT_USER_DAILY_RESULT = "SELECT * FROM UserDailyResult WHERE UserID = ? AND ChallengeID = ?"
SQL_SELECT_USER_DAILY_RESULT_BY_GEO_ID = (
    "SELECT * FROM UserDailyResult WHERE UserID = (SELECT UserID FROM User WHERE GeoId = ?) AND ChallengeID = ?"
)
SQL_INSERT_USER_DAILY_RESULT = "INSERT INTO UserDailyResult (UserID, Score, ChallengeID) VALUES (?, ?, ?)"
SQL_SELECT_ALL_USERS = "SELECT * FROM User"
SQL_SELECT_ALL_DAILY_RESULTS = "SELECT * FROM UserDailyResult"
SQL_SELECT_ALL_CHALLENGES = "SELECT * FROM Challenges"
SQL_UPDATE_USER_DISCORD = (
    "UPDATE User SET DiscordId = ?, DiscordName = ? WHERE GeoName = ? AND (DiscordId IS NULL OR DiscordId = '')"
)
SQL_INSERT_USER = "INSERT INTO User (GeoId, GeoName) VALUES (?, ?)"
SQL_INSERT_USER_WITH_DISCORD = "INSERT INTO User (GeoId, GeoName, DiscordName) VALUES (?, ?, ?)"
