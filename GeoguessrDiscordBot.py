from database import Database
import sqlite3
import json
import sched
import time
import configparser
import requests

db = Database()

conn = sqlite3.connect('geoguessr.db')
cursor = conn.cursor()

geoguessr_base_url = 'https://geoguessr.com/api'
BASE_V3_URL = "https://www.geoguessr.com/api/v3/"  # Base URL for all V3 endpoints
BASE_V4_URL = "https://www.geoguessr.com/api/v4/"  # Base URL for all V4 endpoints

def get_daily_challenge_token():
    """
    Retrieves the token for the current daily challenge.

    Returns:
        str: The token for the current daily challenge.
    """
    daily_challenge_endpoint = 'challenges/daily-challenges/today'

    # Get the current daily challenge token
    daily_challenge_url = f'{BASE_V3_URL}{daily_challenge_endpoint}'
    response = requests.get(daily_challenge_url).json()
    token = response.get('token')

    # Print the token to the console
    print(token)
    return token

def check_for_new_results(challenge_token, session):
    """
    Retrieves the daily challenge results from Geoguessr API.

    Args:
        challenge_token (str): The token of the challenge.
        ncfa_token (str): The token for authentication.

    Returns:
        None
    """
    results_endpoint = 'results/highscores/'
    results_flags = '?friends=true&limit=26&minRounds=5'


    # Get the daily challenge results
    daily_challenge_results = session.get(f"{BASE_V3_URL}{results_endpoint}{challenge_token}{results_flags}").json()

    for item in daily_challenge_results['items']:
        print(item['playerName'], item['totalScore'])

def sign_in():
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
    sign_in_response = requests.post(sign_in_url, json=sign_in_data, headers=headers)

    # Get the ncfa_token from the response
    cookie_jar = sign_in_response.cookies
    ncfa_token = cookie_jar.get('_ncfa')

    # Throw exception if sign_in_response status is not 200
    if sign_in_response.status_code != 200:
        raise Exception(f'Failed to sign in: {sign_in_response.status_code}')
    
    print(ncfa_token)
    return ncfa_token

def update_friends(session):
    """
    Updates the users in the database with their Geoguessr usernames.

    Args:
        session (object): The session object for making HTTP requests.

    Returns:
        None
    """
    friends_endpoints = 'social/friends/summary'
    users_results = session.get(f"{BASE_V3_URL}{friends_endpoints}").json()

    #conn.execute("SELECT * FROM Users")
    #user_rows = cursor.fetchall()

    for user in users_results['friends']:
        # Check if the user is already in the database
        cursor.execute("SELECT * FROM Users WHERE GeoId = ?", (user['userId'],))
        user_row = cursor.fetchone()

        # Add user if it doesn't exist
        if user_row is None:
            user_data = (user['userId'], user['nick'], user['nick'])
            cursor.execute("INSERT INTO Users (GeoId, GeoName, DiscordName) VALUES (?, ?, ?)", user_data)
            conn.commit()

ncfa_token = sign_in()

# Create a session object and set the _ncfa cookie
session = requests.Session()
session.cookies.set("_ncfa", ncfa_token, domain="www.geoguessr.com")

update_friends(session)

challenge_token = get_daily_challenge_token()  # Run the function once to get the current daily challenge token
check_for_new_results(challenge_token, session)  # Run the function once to get the current daily challenge results