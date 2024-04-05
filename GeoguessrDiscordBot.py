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

def get_daily_challenge_token():
    daily_challenge_endpoint = '/v3/challenges/daily-challenges/today'

    # Get the current daily challenge token
    daily_challenge_url = f'{geoguessr_base_url}{daily_challenge_endpoint}'
    response = requests.get(daily_challenge_url).json()
    token = response.get('token')

    # Print the token to the console
    print(token)
    return token

def check_for_new_results(challenge_token, ncfa_token):
    results_endpoint = '/v3/results/highscores/'
    results_flags = '?friends=true'

    daily_challenge_results_url = f'{geoguessr_base_url}{results_endpoint}{challenge_token}{results_flags}'
    print(daily_challenge_results_url)

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        'Content-Type': 'application/json'
    }

    session = requests.Session()
    session.cookies.set("_ncfa", ncfa_token, domain="www.geoguessr.com")

    # Get the daily challenge results
    daily_challenge_results_contents = session.get(daily_challenge_results_url, headers=headers)

    for item in daily_challenge_results_contents['items']:
        print(item['playerName'], item['totalScore'])


def sign_in():
    # Geoguessr endpoint static values
    geoguessr_base_url = 'https://geoguessr.com/api'
    sign_in_endpoint = '/v3/accounts/signin'

    # Sign into Geoguessr
    sign_in_url = f'{geoguessr_base_url}{sign_in_endpoint}'

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


ncfa_token = sign_in()
challenge_token = get_daily_challenge_token()  # Run the function once to get the current daily challenge token
check_for_new_results(challenge_token, ncfa_token)  # Run the function once to get the current daily challenge results