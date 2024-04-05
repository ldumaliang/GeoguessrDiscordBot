from database import Database
import urllib.request
import sqlite3
import json
import sched
import time
import configparser
#from discord.ext import commands, tasks

#bot = commands.Bot(command_prefix='!')
db = Database()

conn = sqlite3.connect('geoguessr.db')
cursor = conn.cursor()

geoguessr_base_url = 'https://geoguessr.com/api'

#@bot.event
#async def on_ready():
#    check_endpoints.start()  # Start the background task

#@tasks.loop(seconds=5.0)  # Adjust the interval as needed

def get_daily_challenge_token():
    daily_challenge_endpoint = '/v3/challenges/daily-challenges/today'

    # Get the current daily challenge token
    daily_challenge_url = f'{geoguessr_base_url}{daily_challenge_endpoint}'
    contents = urllib.request.urlopen(daily_challenge_url).read()
    data = json.loads(contents)
    token = data['token']

    # Print the token to the console
    print(token)
    return token

def check_for_new_results(token):
    results_endpoint = '/v3/results/highscores/'
    results_flags = '?friends=true'
    daily_challenge_results_url = f'{geoguessr_base_url}{results_endpoint}{token}{results_flags}'

    # Get the daily challenge results
    daily_challenge_results_contents = urllib.request.urlopen(daily_challenge_results_url).read()
    daily_challenge_results_data = json.loads(daily_challenge_results_contents)
    for item in daily_challenge_results_data['items']:
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

    sign_in_data = json.dumps(sign_in_data).encode('utf-8')
    sign_in_request = urllib.request.Request(sign_in_url, data=sign_in_data, headers={'Content-Type': 'application/json'})
    sign_in_response = urllib.request.urlopen(sign_in_request)
    sign_in_contents = sign_in_response.read()
    sign_in_data = json.loads(sign_in_contents)

    # Throw exception if sign_in_response status is not 200
    if sign_in_response.status != 200:
        raise Exception(f'Failed to sign in: {sign_in_data["message"]}')


sign_in()
token = get_daily_challenge_token()  # Run the function once to get the current daily challenge token
check_for_new_results(token)

# bot.run('your-bot-token')