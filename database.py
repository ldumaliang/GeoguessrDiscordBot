import sqlite3

class Database:
    def __init__(self, db_name='geoguessr.db'):
        self.conn = sqlite3.connect(db_name)
        self.c = self.conn.cursor()
        self.setup()

    def setup(self):
        # Create Users table
        self.c.execute('''
            CREATE TABLE IF NOT EXISTS Users (
                UserID INTEGER PRIMARY KEY,
                DiscordName TEXT
            )
        ''')

        # Create Challenge table
        self.c.execute('''
            CREATE TABLE IF NOT EXISTS Challenge (
                ChallengeID INTEGER PRIMARY KEY,
                Time TIMESTAMP,
                ChallengeToken INTEGER
            )
        ''')

        # Create UserDailyResult table
        self.c.execute('''
            CREATE TABLE IF NOT EXISTS UserDailyResult (
                UserDailyID INTEGER PRIMARY KEY,
                UserID INTEGER,
                Score INTEGER,
                ChallengeID INTEGER,
                FOREIGN KEY(UserID) REFERENCES Users(UserID),
                FOREIGN KEY(ChallengeID) REFERENCES Challenge(ChallengeID)
            )
        ''')

        # Commit the changes
        self.conn.commit()

    def close(self):
        self.conn.close()
