import discord
from discord.ext import commands


def register(bot: commands.Bot):
    @bot.command(name="help")
    async def _help(ctx):
        e = discord.Embed(title="🎶 Sonus Help", color=0x1DB954)
        e.add_field(name="Playback", value="S!play <query> — enqueue\nS!pause — pause\nS!skip — skip\nS!queue — show queue", inline=False)
        e.add_field(name="Utility", value="S!lyrics — DM lyrics of current track\nS!feedback — send feedback to devs", inline=False)
        e.add_field(name="Owner (hidden)", value="S!status, S!presence, S!reload, S!shutdown, etc.", inline=False)
        e.set_footer(text="Use slash commands for user-facing flows; prefix commands are for power users.")
        await ctx.send(embed=e)
