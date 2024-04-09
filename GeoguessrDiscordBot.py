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
        self.message_channel = None

    async def on_ready(self):
        print(f'We have logged in as {self.user}')
        #my_background_task.start(self)
        get_daily_challenge.start(self)
        check_daily_results.start(self)

    async def on_message(self, message):
        print(message.content)
        if message.author == self.user:
            return

        await self.process_commands(message)
    
    def startup(self, token):
        handler = logging.FileHandler(filename='discord.log', encoding='utf-8', mode='w')
        self.run(token, log_handler=handler, log_level=logging.DEBUG)


# Create an instance of the bot and run it
intents = discord.Intents.default()
bot = GeoguessrDiscordBot(command_prefix=".", intents=intents)

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
    try:
        print("Syncing for guild", guild_id)
        bot.tree.clear_commands(guild=None)
        global_commands = await bot.tree.sync(guild=None)
        print("Global commands", global_commands)
        guild = bot.get_guild(guild_id) 
        bot.tree.clear_commands(guild=guild)
        guild_commands = await bot.tree.sync(guild=guild)
        print("Guild commands", guild_commands)
    except Exception as e:
        print(e)

@bot.command()
async def update_daily(ctx):
    print("Update Daily Challenge token")
    geo_query.get_daily_challenge_token()

@bot.command()
async def update_friends(ctx):
    print("Update Friends List")
    geo_query.update_friends(geo_query.session)

@bot.command()
async def update_session(ctx):
    print("Update Session")
    geo_query.update_session()

@bot.command()
async def get_db_data(ctx, table_name):
    print("Getting DB Data")
    db_data = geo_query.get_db_data(table_name)
    if db_data is not None:
        formatted_data = ''
        formatted_data += '\n'.join([' | '.join(map(str, row)) for row in db_data])
        # Send a response containing formatted table data
        await ctx.send(formatted_data)
    else:
        await ctx.send("No data found in table")

@bot.command()
async def enable(ctx):
    channel_id = ctx.channel.id
    channel_name = ctx.channel.name
    bot.message_channel = bot.get_channel(channel_id)

    print(f"Enabling bot for channel: {channel_name} with id: {channel_id}")


@tasks.loop(seconds=5)
async def my_background_task(self):
    # send a message to a specific channel
    print("sending message to channel")
    if self.message_channel is not None:
        await self.message_channel.send('Hello!')

@tasks.loop(time=midnight)
async def get_daily_challenge(self):
    # get the daily challenge
    print("getting daily challenge")
    geo_query.get_daily_challenge_token()

@tasks.loop(seconds=5)
async def check_daily_results(self):
    # check the daily results
    print("checking daily results")
    new_results = geo_query.check_for_new_results()
    for result in new_results:
        # send a message to a specific channel
        await self.message_channel.send(f"New result: User - {result[0]} scored - {result[1]} points!")


# Run the client
bot.startup(token)