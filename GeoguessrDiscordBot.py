# Standard library imports
import datetime
import logging
import os

# Third-party imports
import discord
from dotenv import load_dotenv
from discord.ext import commands, tasks

# Local application imports
from GeoguessrQueries import GeoguessrQueries

tz = datetime.timezone.utc
midnight = datetime.time(hour=0, minute=0, second=0, microsecond=0, tzinfo=tz)

class GeoguessrDiscordBot(commands.Bot):
    """
    A Discord bot for Geoguessr integration.

    Attributes:
        command_prefix (str): The prefix used for bot commands.
        intents (discord.Intents): The intents for the bot.

    Methods:
        on_ready(): Event handler for when the bot is ready.
        on_message(message): Event handler for when a message is received.
        startup(token): Starts the bot with the specified token.
    """

    def __init__(self, command_prefix, intents):
        """
        Initializes a GeoguessrDiscordBot instance.

        Args:
            command_prefix (str): The prefix used for bot commands.
            intents (discord.Intents): The intents for the bot.
        """
        super().__init__(command_prefix, intents=intents)
        intents = intents
        intents.message_content = True
        self.message_channel = None
        self.todays_thread = None

    async def on_ready(self):
        """
        Event handler for when the bot is ready.
        """
        print(f'We have logged in as {self.user}')
        get_daily_challenge_loop.start(self)
        check_daily_results_loop.start(self)

    async def on_message(self, message):
        """
        Event handler for when a message is received.

        Args:
            message (discord.Message): The received message.
        """
        print(message.content)
        if message.author == self.user:
            return

        await self.process_commands(message)
    
    def startup(self, token):
        """
        Starts the bot with the specified token.

        Args:
            token (str): The Discord bot token.
        """
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
    """
    Registers a user with their Geoguessr name.

    Args:
        ctx (discord.ext.commands.Context): The command context.
        provided_name (str): The Geoguessr name to register.

    Returns:
        None
    """
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
    """
    Creates an embed containing the list of registered users.

    Args:
        successfully_registered (bool): Whether a user was successfully registered.

    Returns:
        discord.Embed: The embed containing the user list.
    """
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
    
    return embed

async def create_thread():
    """
    Creates a new thread for the daily challenge.
    """
    # Get today's UTC date in a human-readable format
    today = datetime.datetime.now(tz).strftime("%m-%d-%Y")

    bot.todays_thread = await bot.message_channel.create_thread(name=today, type=discord.ChannelType.public_thread, auto_archive_duration=1440, reason=None )
    await bot.todays_thread.send(f'Spoiler thread for {today} Geoguessr Daily')

@bot.command()
async def sync_commands(ctx):
    """
    Syncs the bot commands with the guild.

    Args:
        ctx (discord.ext.commands.Context): The command context.

    Returns:
        None
    """
    try:
        print("Syncing for guild", guild_id)
        guild = bot.get_guild(guild_id) 
        guild_commands = await bot.tree.sync(guild=discord.Object(id=guild_id))
        print("Guild commands", guild_commands)
    except Exception as e:
        print(e)

@bot.command()
async def clear_commands(ctx):
    """
    Clears the bot commands for the guild.

    Args:
        ctx (discord.ext.commands.Context): The command context.

    Returns:
        None
    """
    try:
        print("Clearing for guild", guild_id)
        bot.tree.clear_commands(guild=discord.Object(id=guild_id))
        guild_commands = await bot.tree.sync(guild=discord.Object(id=guild_id))
        print("Guild commands", guild_commands)
    except Exception as e:
        print(e)

@bot.command()
async def update_daily(ctx):
    """
    Updates the daily challenge token.

    Args:
        ctx (discord.ext.commands.Context): The command context.

    Returns:
        None
    """
    print("Update Daily Challenge token")
    await get_daily_challenge()

@bot.command()
async def update_friends(ctx):
    """
    Updates the friends list.

    Args:
        ctx (discord.ext.commands.Context): The command context.

    Returns:
        None
    """
    print("Update Friends List")
    geo_query.update_friends(geo_query.session)

@bot.command()
async def update_session(ctx):
    """
    Updates the session.

    Args:
        ctx (discord.ext.commands.Context): The command context.

    Returns:
        None
    """
    print("Update Session")
    geo_query.update_session()

@bot.command()
async def get_db_data(ctx, table_name):
    """
    Retrieves data from the database table.

    Args:
        ctx (discord.ext.commands.Context): The command context.
        table_name (str): The name of the database table.

    Returns:
        None
    """
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
    """
    Enables the bot for the current channel.

    Args:
        ctx (discord.ext.commands.Context): The command context.

    Returns:
        None
    """
    channel_id = ctx.channel.id
    channel_name = ctx.channel.name
    bot.message_channel = bot.get_channel(channel_id)

    print(f"Enabling bot for channel: {channel_name} with id: {channel_id}")

@tasks.loop(time=midnight)
async def get_daily_challenge_loop(self):
    """
    Task loop for getting the daily challenge.

    Args:
        self: The GeoguessrDiscordBot instance.

    Returns:
        None
    """
    await get_daily_challenge()

async def get_daily_challenge():
    """
    Gets the daily challenge and creates a thread.

    Returns:
        None
    """
    # get the daily challenge
    print("getting daily challenge")
    success = geo_query.get_daily_challenge_token()
    if success is False:
        retry_daily_challenge.start(bot)
    else:
        await create_thread()

@tasks.loop(minutes=1)
async def retry_daily_challenge(self):
    """
    Task loop for retrying to get the daily challenge.

    Args:
        self: The GeoguessrDiscordBot instance.

    Returns:
        None
    """
    # retry getting the daily challenge
    print("retrying daily challenge")
    success = geo_query.get_daily_challenge_token()
    if success is True:
        retry_daily_challenge.stop()


@tasks.loop(seconds=5)
async def check_daily_results_loop(self):
    """
    Task loop for checking the daily results.

    Args:
        self: The GeoguessrDiscordBot instance.

    Returns:
        None
    """
    # check the daily results
    print("checking daily results")
    new_results = geo_query.check_for_new_results()
    for result in new_results:
        discord_mention = ''
        if result[3] is not None:
            discord_user = await self.fetch_user(result[3])
            discord_mention = discord_user.mention
        else:
            discord_mention = result[0]
        # send a message to a specific thread
        if bot.todays_thread is not None:
            await bot.todays_thread.send(f"New result: {discord_mention} scored - {result[1]} points!")


# Run the client
bot.startup(token)