# Standard library imports
import datetime
import logging
import os

# Third-party imports
import discord
from dotenv import load_dotenv
from discord.ext import commands, tasks
from sqlalchemy.orm.exc import NoResultFound

# Local application imports
from GeoguessrQueries import GeoguessrQueries
from database import User, Challenge, UserDailyResult, engine, Session, Base, get_or_create, session_scope
from HealthCheck import start_health_check_server

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
        Base.metadata.create_all(engine)

        start_health_check_server()

        self.message_channel = None
        self.previous_results_message = None
        self.todays_thread = None

    async def on_ready(self):
        """
        Event handler for when the bot is ready.
        """
        print(f'We have logged in as {self.user}')
        await update_geoguessr_session(self)
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
        log_dir = 'logs'
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)

        handler = logging.FileHandler(filename='logs/discord.log', encoding='utf-8', mode='w')
        self.run(token, log_handler=handler, log_level=logging.DEBUG)

# Create an instance of the bot and run it
intents = discord.Intents.default()
bot = GeoguessrDiscordBot(command_prefix=".", intents=intents)

geo_query = GeoguessrQueries()

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
    current_user = ctx.user
    current_user_id = current_user.id

    try:
        with session_scope(bot) as session:

            # Check if the user is already registered to a geoguessr account
            if session.query(User).filter(User.discord_id == current_user_id).one_or_none() is not None:
                name = current_user.name
                await ctx.channel.send(f"{name} is already registered with Geoguessr Name")
                raise Exception("User already registered")

            user = session.query(User).filter(User.geo_name == provided_name).one()
            user.discord_id = current_user_id

    except NoResultFound:
        await ctx.channel.send(f"Geoguessr Name: {provided_name} not found")
    except Exception as e:
        print(f"Error occurred registering discord_id {current_user_id}: {e}")
        await ctx.channel.send(f"Failed to register Geoguessr Name: {provided_name}")


    icon_png = discord.File("assets/GeoguessrDiscordIcon.png", filename="icon.png")
    embed = get_user_list_embed()

    # Send the embed
    await ctx.response.send_message(file=icon_png, embed=embed)
    #await ctx.response.send_message(f"{current_user.name} ' successfully registered Geoguessr Name: {provided_name}")

def get_user_list_embed():
    """
    Creates an embed containing the list of registered users.

    Args:
        successfully_registered (bool): Whether a user was successfully registered.

    Returns:
        discord.Embed: The embed containing the user list.
    """
    # Create an embed
    embed = discord.Embed(title="List of User", color=0xa5434d)

    try:
        with session_scope(bot) as session:
            users_list = session.query(User).all()
            geo_names = "\n".join([f"{user.geo_name}" for user in users_list])
            discord_names = "\n".join([f"{'**Registered**' if user.discord_id else '*Unregistered*'}" for user in users_list])
    except Exception as e:
        print(f"Error occurred getting all users: {e}")
        return

    # Add each user to the embed
    embed.add_field(name="Geoguessr Name", value=f"{geo_names}", inline=True)
    embed.add_field(name="Registered Status", value=f"{discord_names}", inline=True)
    embed.set_footer(icon_url="attachment://icon.png")
    
    return embed

def get_todays_results_embed():
    results_embed = discord.Embed(title="Todays Results", color=0xa5434d)

    try:
        with session_scope(bot) as session:
            users_list = session.query(UserDailyResult).all()
            results = "\n".join([f"{result.user.geo_name}: {result.score}" for result in users_list])
    except Exception as e:
        print(f"Error occurred getting all users: {e}")
        return

    # Add each user to the embed
    results_embed.add_field(name="Results", value=f"{results}", inline=True)

    return results_embed

async def update_todays_results():
    # Get todays results embed
    results_embed = get_todays_results_embed()

    # Try to find the previous results message
    if bot.message_channel is not None:
        try:
            if bot.previous_results_message is not None:
                await bot.previous_results_message.edit(embed=results_embed)
            else:
                bot.previous_results_message = await bot.message_channel.send(embed=results_embed)

        except Exception as e:
            print(f"Error occurred updating results message: {e}")


async def create_thread():
    """
    Creates a new thread for the daily challenge.
    """
    # Get today's UTC date in a human-readable format
    today = datetime.datetime.now(tz).strftime("%m-%d-%Y")

    if bot.message_channel is not None:
        await update_todays_results()

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
    await get_daily_challenge(True)

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
    geo_query.update_friends()

@bot.command()
async def update_geoguessr_session(ctx):
    """
    Updates the session.

    Args:
        ctx (discord.ext.commands.Context): The command context.

    Returns:
        None
    """
    print("Update Session")
    geo_query.update_geoguessr_session()

@bot.command()
async def get_db_data(ctx, table_name):
    return

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

async def get_daily_challenge(manual_attempt=False):
    """
    Gets the daily challenge and creates a thread.

    Returns:
        None
    """
    # get the daily challenge
    print("getting daily challenge")
    try:
        geo_query.get_daily_challenge_token()
        await create_thread()
    except Exception as e:
        print(f"Error occurred getting daily challenge: {e}")
        if manual_attempt is False:
            retry_daily_challenge.start(bot)

@tasks.loop(minutes=1, count=5)
async def retry_daily_challenge(self):
    """
    Task loop for retrying to get the daily challenge. 
    Attempts up to 5 times every minute.

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


@tasks.loop(seconds=60)
async def check_daily_results_loop(self):
    """
    Task loop for checking the daily results.

    Args:
        self: The GeoguessrDiscordBot instance.

    Returns:
        None
    """
    # check the daily results
    print("Checking daily results")
    
    # Returns a list of UserDailyResults
    new_result_ids = geo_query.check_for_new_results()

    if new_result_ids is None:
        return
    
    try:
        with session_scope(bot) as session:
            new_results = session.query(UserDailyResult).filter(UserDailyResult.user_daily_id.in_(new_result_ids)).all()

            for result in new_results:
                # Get the user associated with the result
                user = result.user
                if user.discord_id is not None:
                    discord_user = await self.fetch_user(user.discord_id)
                    discord_mention = discord_user.mention
                else:
                    discord_mention = user.geo_name

                # send a message to a specific thread
                await update_todays_results()

                if bot.todays_thread is not None:
                    await bot.todays_thread.send(f"New result: {discord_mention} scored - {result.score} points!")

    except Exception as e:
        print(f"Error occurred checking daily results: {e}")


# Run the client
bot.startup(token)