import discord
import logging
import os
from dotenv import load_dotenv

class GeoguessrDiscordBot:
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True

        self.client = discord.Client(intents=intents)
        self.handler = logging.FileHandler(filename='discord.log', encoding='utf-8', mode='w')

        @self.client.event
        async def on_ready():
            print(f'We have logged in as {self.client.user}')

        @self.client.event
        async def on_message(message):
            print(message.content)
            if message.author == self.client.user:
                return

            if message.content.startswith('$hello'):
                await message.channel.send('Hello!')

    def run(self):
        # Import token from file .env
        load_dotenv()
        token = os.getenv('DISCORD_TOKEN')

        self.client.run(token, log_handler=self.handler)

# Create an instance of the bot and run it
bot = GeoguessrDiscordBot()
bot.run()