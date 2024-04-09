import discord
from discord.ext import commands

class BotCommands(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="test")
    async def test(self, ctx):
        await ctx.response.send_message('Hello!')

    @commands.command()
    async def sync(self, ctx):
        print("Syncing for guild", self.bot.guild_id)
        await self.bot.tree.sync(guild=discord.Object(id=self.bot.guild_id))
