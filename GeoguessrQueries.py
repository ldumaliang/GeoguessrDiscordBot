import datetime
from GeoguessrDatabase import GeoguessrDatabase
import sqlite3
import json
import sched
import time
import configparser
import requests
import schedule

db = GeoguessrDatabase()
conn = sqlite3.connect('geoguessr.db')
cursor = conn.cursor()

geoguessr_base_url = 'https://geoguessr.com/api'
BASE_V3_URL = "https://www.geoguessr.com/api/v3/"  # Base URL for all V3 endpoints
BASE_V4_URL = "https://www.geoguessr.com/api/v4/"  # Base URL for all V4 endpoints

class GeoguessrQueries:
    ncfa_token = None
    session = None
    db = GeoguessrDatabase()
    conn = None
    cursor = None

    def __init__(self):
        self.conn = sqlite3.connect('geoguessr.db')
        self.cursor = self.conn.cursor()

    def update_session(self):
        """
        Updates the session with the necessary authentication token.
        """
        #self.ncfa_token = self._sign_in()
        self.ncfa_token = "jd%2BaOjXEcY2vg7V2ERhTuKpaCPcRPKjqmbvotDVrPJM%3DhV7SXD9XAYlNiYnzGkLokeuWLYQg6%2FE3Vh8AkjtH73nvdi%2BUVaiWvaQ2demuwQ8x3BN1OMbQE8lgtgtoRBybWZMdjr0eHHDgT1%2BPNfkQNCs%3D"
        self.session = requests.Session()
        self.session.cookies.set("_ncfa", self.ncfa_token, domain="www.geoguessr.com")

    def get_daily_challenge_token(self):
        """
        Retrieves the token for the current daily challenge.

        Returns:
            str: The token for the current daily challenge.
        """
        # Get the current daily challenge token
        daily_challenge_endpoint = 'challenges/daily-challenges/today'
        daily_challenge_url = f'{BASE_V3_URL}{daily_challenge_endpoint}'
        response = requests.get(daily_challenge_url).json()
        token = response.get('token')

        success = db.update_challenge_token(token)

        # Print the token to the console
        print("Challenge Token:", token)
        return success
    
    def check_for_new_results(self) -> list:
            """
            Checks for new results in the daily challenge and adds them to the database.

            Returns:
                list: A list of new user daily results added to the database.
            """
            # Get the current daily challenge token
            daily_challenge_endpoint = 'challenges/daily-challenges/today/'
            friends_flags = '?friends=true'
            daily_challenge_url = f'{BASE_V3_URL}{daily_challenge_endpoint}'
            try:
                daily_challenge_response = self.session.get(daily_challenge_url)
                daily_challenge_data = daily_challenge_response.json()
            except Exception as e:
                print(f"Error occurred getting daily_challenge_data: {e}")
                return None

            challenge_row = db.get_todays_challenge()
            challenge_id = int(challenge_row[0])

            new_results = []

            for item in daily_challenge_data.get('friends', []):
                try:
                    user_id = item['id']
                    user = db.get_user_by_geo_id(user_id)
                    if not user:
                        print(f"No user found with id: {user_id}")
                        continue

                    user_id, _, user_geo_name, _, discord_id = user
                    user_daily_result = db.get_user_daily_result(user_id, challenge_id)

                    # If the user has not submitted a score, insert the score into the UserDailyResult table
                    if not user_daily_result:
                        total_score = item['totalScore']
                        new_user_daily_result = (user_id, total_score, challenge_id)
                        db.add_user_daily_result(*new_user_daily_result)
                        new_results.append((user_geo_name, total_score, challenge_id, discord_id))
                        print(f"Added: {item['nick']} {total_score}")
                except Exception as e:
                    print(f"Error occurred: {e}")
            
            return new_results

    def check_for_new_results_detailed(self):
        """
        Retrieves the daily challenge results from Geoguessr API in detail and adds them to the database.
        """
        print("Checking for new results...")

        results_endpoint = 'results/highscores/'
        results_flags = '?friends=true&limit=26&minRounds=5'

        # Get the current daily challenge token from the Challenge table
        challenge_row = db.get_todays_challenge()
        challenge_id = int(challenge_row[0])
        challenge_token = challenge_row[1]

        # Get the daily challenge results
        try:
            daily_challenge_results = self.session.get(f"{BASE_V3_URL}{results_endpoint}{challenge_token}{results_flags}")
            daily_challenge_data = daily_challenge_results.json()
        except Exception as e:
            print(f"Error occurred getting daily_challenge_results: {e}")
            return None

        for item in daily_challenge_data['items']:
            # Check if the current user has already submitted a score for the daily challenge
            try:
                user = db.get_user_by_geo_id(item['userId'])
                user_daily_result = db.get_user_daily_result(user[0], challenge_id)

                # If the user has not submitted a score, insert the score into the UserDailyResult table
                if user_daily_result is None or len(user_daily_result) == 0:
                    db.add_user_daily_result(user[0], item['totalScore'], challenge_id)
                    print("Added: ", item['playerName'], item['totalScore'])
            except Exception as e:
                print(f"Error occurred: {e}")

    def _sign_in(self) -> str:
        """
        Signs into Geoguessr using the provided credentials.

        Returns:
            str: The ncfa_token obtained from the sign-in response.

        Raises:
            Exception: If the sign-in request fails with a non-200 status code.
        """
        # Geoguessr endpoint static values
        sign_in_endpoint = 'accounts/signin'

        # Sign into Geoguessr
        sign_in_url = f'{BASE_V3_URL}{sign_in_endpoint}'

        # Parse credentials from file
        config = configparser.ConfigParser()
        config.read('credentials.ini')  # replace with your credentials file path
        username = config.get('Credentials', 'Username').strip("'")
        password = config.get('Credentials', 'Password').strip("'")

        sign_in_data = {
            'email': username,
            'password': password
        }

        headers = {'Content-Type': 'application/json'}
        try:
            sign_in_response = requests.post(sign_in_url, json=sign_in_data, headers=headers)

            # Get the ncfa_token from the response
            cookie_jar = sign_in_response.cookies
            ncfa_token = cookie_jar.get('_ncfa')
            expires = None
            for cookie in cookie_jar:
                if cookie.name == '_ncfa':
                    expires = cookie.expires

        except Exception as e:
            print(f"Error occurred signing in: {e}")
            return None

        # Throw exception if sign_in_response status is not 200
        if sign_in_response.status_code != 200:
            raise Exception(f'Failed to sign in: {sign_in_response.status_code}')
        
        print(ncfa_token)
        return ncfa_token

    def update_friends(self, session) -> None:
        """
        Updates the users in the database with their Geoguessr usernames.

        Args:
            session (object): The session object for making HTTP requests.

        Returns:
            None
        """
        friends_endpoints = 'social/friends/summary'
        users_results = session.get(f"{BASE_V3_URL}{friends_endpoints}").json()

        for user in users_results['friends']:
            # Check if the user is already in the database
            cursor.execute("SELECT * FROM Users WHERE GeoId = ?", (user['userId'],))
            user_row = cursor.fetchone()

            # Add user if it doesn't exist
            if user_row is None:
                user_data = (user['userId'], user['nick'], user['nick'])
                cursor.execute("INSERT INTO Users (GeoId, GeoName, DiscordName) VALUES (?, ?, ?)", user_data)
                conn.commit()

        # Add self to users table if not already present
        self_endpoint = 'profiles'
        self_result = session.get(f"{BASE_V3_URL}{self_endpoint}").json()
        self = self_result['user']
        if (cursor.execute("SELECT * FROM Users WHERE GeoId = ?", (self['id'],)).fetchone() is None):
            user_data = (self['id'], self['nick'], self['nick'])
            cursor.execute("INSERT INTO Users (GeoId, GeoName, DiscordName) VALUES (?, ?, ?)", user_data)
            conn.commit()

    def get_db_data(self, table_name):
        """
        Retrieves all data from a specified table in the database.

        Args:
            table_name (str): The name of the table to retrieve data from.

        Returns:
            list: A list of tuples containing the data from the specified table.
        """
        try:
            cursor.execute(f"SELECT * FROM {table_name}")
            return cursor.fetchall()
        except Exception as e:
            print(f"Error occurred in getting table data: {e}")
            return None
    
    #def set_user_discord_id(self, user_id, discord_id):
    #    """
    #    Sets the Discord ID for a user in the database.

    #    Args:
    #        user_id (int): The ID of the user.
    #        discord_id (int): The Discord ID of the user.
    #    """
    #    try:
    #        db.set_user_discord_id(user_id, discord_id)
    #    except Exception as e:
    #        print(f"Error occurred in setting user Discord ID: {e}")


#ncfa_token = sign_in()

#geoqueries = GeoguessrQueries()
#geoqueries.update_session()
#geoqueries.update_friends(geoqueries.session)
#geoqueries.get_daily_challenge_token()
##geoqueries.check_for_new_results_detailed()
#geoqueries.check_for_new_results()