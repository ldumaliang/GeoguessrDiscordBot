CREATE TABLE IF NOT EXISTS Users (
    UserId INTEGER PRIMARY KEY,
    GeoId TEXT,
    GeoName TEXT,
    DiscordName TEXT
)

CREATE TABLE IF NOT EXISTS Challenge (
    ChallengeID INTEGER PRIMARY KEY,
    Time TIMESTAMP,
    ChallengeToken TEXT
)
CREATE TABLE IF NOT EXISTS UserDailyResult (
    UserDailyID INTEGER PRIMARY KEY,
    UserID INTEGER,
    Score INTEGER,
    ChallengeID INTEGER,
    FOREIGN KEY(UserID) REFERENCES Users(UserID),
    FOREIGN KEY(ChallengeID) REFERENCES Challenge(ChallengeID)
)