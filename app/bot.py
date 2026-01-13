"""Entry point for the Geoguessr Discord bot."""

from __future__ import annotations

import datetime
import logging

import discord
from discord.ext import commands, tasks

from app.config import BotConfig, load_config
from app.queries import GeoguessrQueries


TZ = datetime.timezone.utc
MIDNIGHT = datetime.time(hour=0, minute=0, second=0, microsecond=0, tzinfo=TZ)


class GeoguessrDiscordBot(commands.Bot):
    """A Discord bot for Geoguessr integration."""

    def __init__(self, command_prefix: str, intents: discord.Intents, geo_query: GeoguessrQueries) -> None:
        super().__init__(command_prefix, intents=intents)
        self.message_channel: discord.TextChannel | None = None
        self.todays_thread: discord.Thread | None = None
        self.geo_query = geo_query

    async def on_ready(self) -> None:
        print(f"We have logged in as {self.user}")
        await self.update_session()
        self.get_daily_challenge_loop.start()
        self.check_daily_results_loop.start()

    async def on_message(self, message: discord.Message) -> None:
        print(message.content)
        if message.author == self.user:
            return

        await self.process_commands(message)

    def startup(self, token: str) -> None:
        handler = logging.FileHandler(filename="logs/discord.log", encoding="utf-8", mode="w")
        self.run(token, log_handler=handler, log_level=logging.DEBUG)

    async def create_thread(self) -> None:
        today = datetime.datetime.now(TZ).strftime("%m-%d-%Y")

        if not self.message_channel:
            print("Message channel not configured. Use .enable to set it.")
            return

        self.todays_thread = await self.message_channel.create_thread(
            name=today,
            type=discord.ChannelType.public_thread,
            auto_archive_duration=1440,
            reason=None,
        )
        await self.todays_thread.send(f"Spoiler thread for {today} Geoguessr Daily")

    async def update_session(self) -> None:
        print("Update Session")
        self.geo_query.update_session()

    async def get_daily_challenge(self) -> None:
        print("getting daily challenge")
        success = self.geo_query.get_daily_challenge_token()
        if success is False:
            self.retry_daily_challenge.start()
        else:
            await self.create_thread()

    @tasks.loop(time=MIDNIGHT)
    async def get_daily_challenge_loop(self) -> None:
        await self.get_daily_challenge()

    @tasks.loop(minutes=1)
    async def retry_daily_challenge(self) -> None:
        print("retrying daily challenge")
        success = self.geo_query.get_daily_challenge_token()
        if success is True:
            self.retry_daily_challenge.stop()

    @tasks.loop(seconds=5)
    async def check_daily_results_loop(self) -> None:
        print("checking daily results")
        new_results = self.geo_query.check_for_new_results()

        if new_results is None:
            return

        for result in new_results:
            discord_mention = ""
            if result[3] is not None:
                discord_user = await self.fetch_user(result[3])
                discord_mention = discord_user.mention
            else:
                discord_mention = result[0]
            if self.todays_thread is not None:
                await self.todays_thread.send(
                    f"New result: {discord_mention} scored - {result[1]} points!"
                )


def get_user_list_embed(geo_query: GeoguessrQueries, successfully_registered: bool = False) -> discord.Embed:
    """Create an embed containing the list of registered users."""
    embed = discord.Embed(title="List of User", color=0xA5434D)

    users_list = geo_query.db.get_all_users()

    geo_names = "\n".join([f"{user[2]}" for user in users_list])
    discord_names = "\n".join([f"{user[3] if user[3] else '*Unregistered*'}" for user in users_list])

    embed.add_field(name="Geoguessr Name", value=f"{geo_names}", inline=True)
    embed.add_field(name="Registered Discord Name", value=f"{discord_names}", inline=True)

    if successfully_registered is False:
        embed.set_footer(text="Usage: /register 'Geoguessr Name'", icon_url="attachment://icon.png")
    else:
        embed.set_footer(icon_url="attachment://icon.png")

    return embed


def register_commands(bot: GeoguessrDiscordBot, config: BotConfig) -> None:
    """Register slash and dot commands on the bot instance."""

    @bot.tree.command(name="register", guild=discord.Object(id=config.guild_id))
    async def register(ctx: discord.Interaction, provided_name: str) -> None:
        discord_user_id = ctx.user.id
        discord_user_display_name = ctx.user.display_name

        if bot.geo_query.db.get_user_by_discord_id(discord_user_id) is not None:
            await ctx.response.send_message(
                f"{discord_user_display_name} is already registered with Geoguessr Name"
            )
            return

        successfully_registered = False

        if provided_name is not None:
            successfully_registered = bot.geo_query.db.set_user_discord_id(
                provided_name, discord_user_id, discord_user_display_name
            )

        icon_png = discord.File("assets/GeoguessrDiscordIcon.png", filename="icon.png")
        embed = get_user_list_embed(bot.geo_query, successfully_registered)

        await ctx.channel.send(file=icon_png, embed=embed)
        await ctx.response.send_message(
            f"{discord_user_display_name} {'successfully' if successfully_registered else 'failed to'} "
            f"register Geoguessr Name: {provided_name}"
        )

    @bot.command()
    async def sync_commands(ctx: commands.Context) -> None:
        try:
            print("Syncing for guild", config.guild_id)
            guild_commands = await bot.tree.sync(guild=discord.Object(id=config.guild_id))
            print("Guild commands", guild_commands)
        except Exception as exc:
            print(exc)

    @bot.command()
    async def clear_commands(ctx: commands.Context) -> None:
        try:
            print("Clearing for guild", config.guild_id)
            bot.tree.clear_commands(guild=discord.Object(id=config.guild_id))
            guild_commands = await bot.tree.sync(guild=discord.Object(id=config.guild_id))
            print("Guild commands", guild_commands)
        except Exception as exc:
            print(exc)

    @bot.command()
    async def update_daily(ctx: commands.Context) -> None:
        print("Update Daily Challenge token")
        await bot.get_daily_challenge()

    @bot.command()
    async def update_friends(ctx: commands.Context) -> None:
        print("Update Friends List")
        bot.geo_query.update_friends()

    @bot.command()
    async def update_session(ctx: commands.Context) -> None:
        await bot.update_session()

    @bot.command()
    async def get_db_data(ctx: commands.Context, table_name: str) -> None:
        print("Getting DB Data")
        db_data = bot.geo_query.get_db_data(table_name)
        if db_data is not None:
            formatted_data = "\n".join([" | ".join(map(str, row)) for row in db_data])
            await ctx.send(formatted_data)
        else:
            await ctx.send("No data found in table")

    @bot.command()
    async def enable(ctx: commands.Context) -> None:
        channel_id = ctx.channel.id
        channel_name = ctx.channel.name
        bot.message_channel = bot.get_channel(channel_id)

        print(f"Enabling bot for channel: {channel_name} with id: {channel_id}")


def build_bot(config: BotConfig) -> GeoguessrDiscordBot:
    """Build and configure the bot instance."""
    intents = discord.Intents.default()
    intents.message_content = True
    geo_query = GeoguessrQueries()

    bot = GeoguessrDiscordBot(command_prefix=".", intents=intents, geo_query=geo_query)
    register_commands(bot, config)
    return bot


def main() -> None:
    """Entry point for starting the bot."""
    config = load_config()
    bot = build_bot(config)
    bot.startup(config.token)


if __name__ == "__main__":
    main()
