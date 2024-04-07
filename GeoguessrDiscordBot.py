import datetime
from GeoguessrQueries import GeoguessrQueries
import discord
import logging
import os
from dotenv import load_dotenv
from discord.ext import commands, tasks

tz = datetime.timezone.utc
midnight = datetime.time(hour=0, minute=0, second=0, microsecond=0, tzinfo=tz)


class GeoguessrDiscordBot(commands.Bot):
    def __init__(self, command_prefix, intents):
        super().__init__(command_prefix, intents=intents)
        intents = intents
        intents.message_content = True

    async def on_ready(self):
        print(f'We have logged in as {self.user}')
        #my_background_task.start(self)
        get_daily_challenge.start(self)
        check_daily_results.start(self)

    async def on_message(self, message):
        print(message.content)
        if message.author == self.user:
            return

        if message.content.startswith('$hello'):
            await message.channel.send('Hello!')
        
        await self.process_commands(message)
    
    def startup(self, token):
        handler = logging.FileHandler(filename='discord.log', encoding='utf-8', mode='w')
        self.run(token, log_handler=handler, log_level=logging.DEBUG)


# Create an instance of the bot and run it
intents = discord.Intents.default()
bot = GeoguessrDiscordBot(command_prefix=".", intents=intents)
channel = bot.get_channel(1226008772514676749)

geo_query = GeoguessrQueries()
geo_query.update_session()
geo_query.update_friends(geo_query.session)

# Import token from file .env
load_dotenv()
token = os.getenv('DISCORD_TOKEN')
guild_id = os.getenv('GUILD_ID')

@bot.tree.command(name="test", guild=discord.Object(id=guild_id))
async def test(ctx):
    await ctx.response.send_message('Hello!')

@bot.command()
async def sync(ctx):
    print("Syncing for guild", guild_id)
    await bot.tree.sync(guild=discord.Object(id=guild_id))

@tasks.loop(seconds=5)
async def my_background_task(self):
    # send a message to a specific channel
    print("sending message to channel")
    await channel.send('Hello!')

@tasks.loop(time=midnight)
async def get_daily_challenge(self):
    # get the daily challenge
    print("getting daily challenge")
    geo_query.get_todays_challenge()

@tasks.loop(seconds=5)
async def check_daily_results(self):
    # check the daily results
    print("checking daily results")
    new_results = geo_query.check_for_new_results()
    for result in new_results:
        # send a message to a specific channel
        await channel.send(f"New result: {result}")


# Run the client
bot.startup(token)