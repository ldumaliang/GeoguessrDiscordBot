import sqlite3
import logging

class GeoguessrDatabase:
    def __init__(self, db_name='geoguessr.db'):
        """
        Initializes a Database object.

        Parameters:
        - db_name (str): The name of the database file. Default is 'geoguessr.db'.
        """
        try:
            self.conn = sqlite3.connect(db_name)
            self.c = self.conn.cursor()
            self._setup()
        except Exception as e:
            logging.error(f"Error occurred in Database initialization: {e}")

    def _setup(self):
        """
        Sets up the database by creating the necessary tables if they don't exist.
        """
        with open('database/schema.sql', 'r') as file:
            schema = file.read()
            self.c.executescript(schema)

        # Commit the changes
        self.conn.commit()

    def close(self):
        """
        Closes the database connection.
        """
        self.conn.close()

    def update_challenge_token(self, token):
        """
        Updates the daily challenge token in the database.

        Parameters:
        - token (str): The daily challenge token to update.

        Returns:
        - bool: True if the token was successfully updated, False otherwise.
        """
        try:
            self.c.execute("SELECT * FROM Challenge WHERE ChallengeToken = ?", (token,))
            challenge_row = self.c.fetchone()
            if challenge_row is None:
                # Insert the daily challenge token into the Challenge table with the current timestamp
                self.c.execute("INSERT INTO Challenge (ChallengeToken, Time) VALUES (?, datetime('now'))", (token,))
                self.conn.commit()
                return True
            else:
                print("Challenge token already exists")
                return False
        except Exception as e:
            logging.error(f"Error occurred in updating challenge token: {e}")
            return False
    
    def get_todays_challenge(self):
        """
        Retrieves the ID and token for the current daily challenge.

        Returns:
            tuple: A tuple containing the ID and token for the current daily challenge.
        """
        try:
            self.c.execute("SELECT ChallengeID, ChallengeToken FROM Challenge ORDER BY Time DESC LIMIT 1")
            challenge_row = self.c.fetchone()
            return challenge_row
        except Exception as e:
            logging.error(f"Error occurred in getting today's challenge: {e}")
    
    def get_user_by_geo_id(self, geo_id):
        """
        Retrieves a user by their Geoguessr ID.

        Parameters:
        - geo_id (str): The Geoguessr ID of the user.

        Returns:
            tuple: A tuple containing the user's information.
        """
        try:
            self.c.execute("SELECT * FROM Users WHERE GeoId = ?", (geo_id,))
            user = self.c.fetchone()
            return user
        except Exception as e:
            logging.error(f"Error occurred in getting user by GeoId: {e}")
    
    def get_user_by_discord_id(self, discord_id):
        """
        Retrieves a user by their Discord ID.

        Parameters:
        - discord_id (int): The Discord ID of the user.

        Returns:
            tuple: A tuple containing the user's information.
        """
        try:
            self.c.execute("SELECT * FROM Users WHERE DiscordId = ?", (discord_id,))
            user = self.c.fetchone()
            return user
        except Exception as e:
            logging.error(f"Error occurred in getting user by DiscordId: {e}")
            return None
    
    def get_user_daily_result(self, user_id, challenge_id):
        """
        Retrieves a user's daily result for a specific challenge.

        Parameters:
        - user_id (int): The ID of the user.
        - challenge_id (int): The ID of the challenge.

        Returns:
            tuple: A tuple containing the user's daily result for the specific challenge.
        """
        try:
            self.c.execute("SELECT * FROM UserDailyResult WHERE UserID = ? AND ChallengeID = ?", (user_id, challenge_id))
            user_daily_result = self.c.fetchone()
            return user_daily_result
        except Exception as e:
            logging.error(f"Error occurred in getting user's daily result: {e}")
    
    def get_user_daily_result_by_geoid_and_challengeid(self, geo_id, challenge_id):
        """
        Retrieves a user's daily result for a specific challenge.

        Parameters:
        - geo_id (str): The Geoguessr ID of the user.
        - challenge_id (int): The ID of the challenge.

        Returns:
            tuple: A tuple containing the user's daily result for the specific challenge.
        """
        try:
            self.c.execute("SELECT * FROM UserDailyResult WHERE UserID = (SELECT UserID FROM Users WHERE GeoId = ?) AND ChallengeID = ?", (geo_id, challenge_id))
            user_daily_result = self.c.fetchone()
            return user_daily_result
        except Exception as e:
            logging.error(f"Error occurred in getting user's daily result: {e}")
    
    def add_user_daily_result(self, user_id, score, challenge_id):
        """
        Adds a user's daily result to the database.

        Parameters:
        - user_id (int): The ID of the user.
        - score (int): The user's score for the daily challenge.
        - challenge_id (int): The ID of the challenge.
        """
        try:
            score_data = (user_id, score, challenge_id)
            self.c.execute("INSERT INTO UserDailyResult (UserID, Score, ChallengeID) VALUES (?, ?, ?)", score_data)
            self.conn.commit()
        except Exception as e:
            logging.error(f"Error occurred in adding user's daily result: {e}")
    
    def get_all_users(self):
        """
        Retrieves all users from the database.

        Returns:
            list: A list of tuples, each containing the data for one user.
        """
        self.c.execute("SELECT * FROM Users")
        return self.c.fetchall()

    def get_all_daily_results(self):
        """
        Retrieves all daily results from the database.

        Returns:
            list: A list of tuples, each containing the data for one daily result.
        """
        self.c.execute("SELECT * FROM UserDailyResult")
        return self.c.fetchall()

    def get_all_challenges(self):
        """
        Retrieves all challenges from the database.

        Returns:
            list: A list of tuples, each containing the data for one challenge.
        """
        self.c.execute("SELECT * FROM Challenges")

    def set_user_discord_id(self, geo_name, discord_id, discord_name):
        """
        Sets the Discord ID for a user in the database.

        Parameters:
        - geo_id (str): The Geo ID of the user.
        - discord_id (int): The Discord ID of the user.

        Returns:
        - bool: True if the Discord ID was successfully set, False otherwise.
        """
        try:
            self.c.execute("UPDATE Users SET DiscordId = ?, DiscordName = ? WHERE GeoName = ? AND (DiscordId IS NULL OR DiscordId = '')", (discord_id, discord_name, geo_name))
            self.conn.commit()
            if self.c.rowcount != 0:
                return True
            else:
                return False
        except Exception as e:
            logging.error(f"Error occurred in setting user's Discord ID: {e}")
            return False
    
