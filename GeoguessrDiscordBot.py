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


@bot.tree.command(name="register", guild=discord.Object(id=guild_id))
async def register(ctx, provided_name: str):
    discord_user_id = ctx.user.id
    discord_user_display_name = ctx.user.display_name

    if geo_query.db.get_user_by_discord_id(discord_user_id) is not None:
        # Send a response that the user is already registered
        await ctx.response.send_message(f"{discord_user_display_name} is already registered with Geoguessr Name")
        return

    successfully_registered = False

    if provided_name is not None:
        successfully_registered = geo_query.db.set_user_discord_id(provided_name, discord_user_id, discord_user_display_name)

    icon_png = discord.File("assets/GeoguessrDiscordIcon.png", filename="icon.png")
    embed = get_user_list_embed()

    # Send the embed
    await ctx.channel.send(file=icon_png, embed=embed)
    await ctx.response.send_message(f"{discord_user_display_name} {'successfully' if successfully_registered else 'failed to'} register Geoguessr Name: {provided_name}")

def get_user_list_embed(successfully_registered=False):
    # Create an embed
    embed = discord.Embed(title="List of Users", color=0x00ff00)

    users_list = geo_query.db.get_all_users()

    geo_names = "\n".join([f"{user[2]}" for user in users_list])
    discord_names = "\n".join([f"{user[3] if user[3] else '*Unregistered*'}" for user in users_list])

    # Add each user to the embed
    embed.add_field(name="Geoguessr Name", value=f"{geo_names}", inline=True)
    embed.add_field(name="Registered Discord Name", value=f"{discord_names}", inline=True)

    if successfully_registered is False:
        embed.set_footer(text="Usage: /register 'Geoguessr Name'", icon_url="attachment://icon.png")
    else:
        embed.set_footer(icon_url="attachment://icon.png")

@bot.command()
async def create_thread(ctx, name):
    thread = await ctx.channel.create_thread(name=name, message="New Thread!", auto_archive_duration=1440)
    await thread.send('This is the first message in the thread!')
    await ctx.send(f'Thread created: {thread.mention}')

@bot.command()
async def sync_commands(ctx):
    try:
        print("Syncing for guild", guild_id)
        guild = bot.get_guild(guild_id) 
        guild_commands = await bot.tree.sync(guild=discord.Object(id=guild_id))
        print("Guild commands", guild_commands)
    except Exception as e:
        print(e)

@bot.command()
async def clear_commands(ctx):
    try:
        print("Clearing for guild", guild_id)
        bot.tree.clear_commands(guild=discord.Object(id=guild_id))
        guild_commands = await bot.tree.sync(guild=discord.Object(id=guild_id))
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
        if self.message_channel is not None:
            await self.message_channel.send(f"New result: User - {result[0]} scored - {result[1]} points!")


# Run the client
bot.startup(token)