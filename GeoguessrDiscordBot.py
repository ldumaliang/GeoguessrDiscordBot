import discord
import requests
import sqlite3
import json
from discord.ext import commands, tasks
import Database from database

bot = commands.Bot(command_prefix='!')

db = Database()

conn = sqlite3.connect('geoguessr.db')
cursor = conn.cursor()

@bot.event
async def on_ready():
    check_endpoints.start()  # Start the background task

@tasks.loop(minutes=5.0)  # Adjust the interval as needed
async def check_endpoints():
    # List of endpoints to check
    endpoints = ['endpoint1', 'endpoint2', 'endpoint3']

    for endpoint in endpoints:
        url = f"https://www.geoguessr.com/api/v3/{endpoint}"
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            # Check if data has changed
            cursor.execute("SELECT data FROM endpoints WHERE url = ?", (url,))
            row = cursor.fetchone()
            if row is None:
                # This is a new endpoint, so just insert the data
                cursor.execute("INSERT INTO endpoints VALUES (?, ?)", (url, json.dumps(data)))
            else:
                # This is an existing endpoint, so check if the data has changed
                old_data = json.loads(row[0])
                if data != old_data:
                    # Data has changed, so update the database and send a message
                    cursor.execute("UPDATE endpoints SET data = ? WHERE url = ?", (json.dumps(data), url))
                    for guild in bot.guilds:
                        for channel in guild.text_channels:
                            await channel.send(f"Data has changed on {url}")
        else:
            print(f"Error: {response.status_code}")

        conn.commit()  # Save changes to the database

bot.run('your-bot-token')