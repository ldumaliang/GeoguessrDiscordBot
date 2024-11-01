# Standard library imports
import configparser
from datetime import datetime
import datetime
import json
import sched
import sqlite3
import time
import os

# Related third party imports
import requests
import schedule

# Local application/library specific imports
from database import User, Challenge, UserDailyResult, engine, Session, Base, get_or_create, session_scope

from dotenv import load_dotenv

geoguessr_base_url = 'https://geoguessr.com/api'
BASE_V3_URL = "https://www.geoguessr.com/api/v3/"  # Base URL for all V3 endpoints
BASE_V4_URL = "https://www.geoguessr.com/api/v4/"  # Base URL for all V4 endpoints

class GeoguessrQueries:
    """
    A class that contains methods for querying Geoguessr API and updating the database with the results.
    """

    ncfa_token = None
    requests_session = None

    def __init__(self):
        load_dotenv()

    def update_geoguessr_session(self):
        """
        Updates the session with the necessary authentication token.
        """
        self.ncfa_token = os.getenv('NCFA_TOKEN')

        #self.ncfa_token = self._sign_in()
        self.requests_session = requests.Session()
        self.requests_session.cookies.set("_ncfa", self.ncfa_token, domain="www.geoguessr.com")

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
        challenge = Challenge(time=datetime.datetime.now(tz=datetime.timezone.utc), challenge_token=token)

        with session_scope(self) as session:
            session.add(challenge)
            session.commit()
    
    def check_for_new_results(self) -> list:
        """
        Checks for new results in the daily challenge and adds them to the database.

        Returns:
            list: A list of new friend daily results added to the database.
        """
        # Get the current daily challenge token
        daily_challenge_endpoint = 'challenges/daily-challenges/today/'
        friends_flags = '?friends=true'
        daily_challenge_url = f'{BASE_V3_URL}{daily_challenge_endpoint}'
        try:
            daily_challenge_response = self.requests_session.get(daily_challenge_url)
            daily_challenge_data = daily_challenge_response.json()
        except Exception as e:
            print(f"Error occurred getting daily_challenge_data: {e}")
            return None

        try:
            with session_scope(self) as session:
                todays_challenge = session.query(Challenge).order_by(Challenge.time.desc()).first()
                todays_challenge_date = datetime.datetime.strptime(todays_challenge.time, '%Y-%m-%d %H:%M:%S.%f%z').date() if todays_challenge else None

                if not todays_challenge:
                    print("No challenge found.")
                    return None
        
        
                # Check if the latest challenge is today's challenge 
                if datetime.datetime.now(tz=datetime.timezone.utc).date() != todays_challenge_date:
                    print("Today's challenge has not been retrieved yet.")
                    return None

                new_result_ids = []

                for friend_result in daily_challenge_data.get('friends', []):
                    # Get the user with the corresponding geo_id
                    user = session.query(User).filter(User.geo_id == friend_result['id']).first()

                    # Get the UserDailyResult for the current friend and challenge
                    user_daily_result = (
                        session.query(UserDailyResult)
                        .filter(
                            UserDailyResult.user == user,
                            UserDailyResult.challenge == todays_challenge
                        )
                        .first()
                    )

                    # If the friend has not submitted a score, insert the score into the UserDailyResult table
                    if not user_daily_result and user:

                        user_daily_result = UserDailyResult(
                            user=user,
                            score=friend_result['totalScore'],
                            challenge=todays_challenge
                        )
                        session.add(user_daily_result)
                        session.flush()
                        new_result_ids.append(user_daily_result.user_daily_id)
                
        except Exception as e:
            print(f"Error occurred getting todays_challenge from database: {e}")
            return None
            
        return new_result_ids or None

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

        # Get the Geoguessr username and password from the environment variables
        username = os.getenv('GEOGUESSR_USERNAME')
        password = os.getenv('GEOGUESSR_PASSWORD')

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

    def update_friends(self) -> None:
        """
        Updates the users in the database with their Geoguessr usernames.

        Args:
            session (object): The session object for making HTTP requests.

        Returns:
            None
        """
        friends_endpoints = 'social/friends/summary'
        try:
            users_results = self.requests_session.get(f"{BASE_V3_URL}{friends_endpoints}").json()
        except Exception as e:
            print(f"Error occurred getting users_results: {e}")
            return

        try:
            with session_scope(self) as session:
                for friend in users_results['friends']:
                    # Check if the friend is already in the database
                    get_or_create(session, User, geo_id=friend['userId'], geo_name=friend['nick'])

                # Add self to users table if not already present
                self_endpoint = 'profiles'
                self_result = self.requests_session.get(f"{BASE_V3_URL}{self_endpoint}").json()
                self = self_result['user']

                get_or_create(session, User, geo_id=self['id'], geo_name=self['nick'])
        except Exception as e:
            print(f"Error occurred updating friends: {e}")
            return