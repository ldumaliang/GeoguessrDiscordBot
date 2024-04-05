import sqlite3
import logging

class Database:
    def __init__(self, db_name='geoguessr.db'):
        """
        Initializes a Database object.

        Parameters:
        - db_name (str): The name of the database file. Default is 'geoguessr.db'.
        """
        self.conn = sqlite3.connect(db_name)
        self.c = self.conn.cursor()
        try:
            self.setup()
        except Exception as e:
            logging.error(f"Error occurred in Database initialization: {e}")

    def setup(self):
        """
        Sets up the database by creating the necessary tables if they don't exist.
        """
        # Create Users table
        self.c.execute('''
            CREATE TABLE IF NOT EXISTS Users (
                UserId INTEGER PRIMARY KEY,
                GeoId TEXT,
                GeoName TEXT,
                DiscordName TEXT
            )
        ''')

        # Create Challenge table
        self.c.execute('''
            CREATE TABLE IF NOT EXISTS Challenge (
                ChallengeID INTEGER PRIMARY KEY,
                ChallengeToken TEXT
                Time TIMESTAMP,
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
        """
        Closes the database connection.
        """
        self.conn.close()
