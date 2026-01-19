import discord
from discord import app_commands
from discord.ext import commands

from src.utils.guild_settings import load as load_guild_settings


def register(bot: commands.Bot):
    @bot.command(name="help")
    async def _help(ctx: commands.Context, command_name: str | None = None):
        settings = load_guild_settings(ctx.guild.id) if ctx.guild else {"prefix": "S!", "color": "#1DB954"}
        prefix = settings.get("prefix", "S!")
        color = settings.get("color", "#1DB954")
        color_int = int(color.lstrip("#"), 16) if isinstance(color, str) and color.startswith("#") else 0x1DB954

        if command_name:
            # show detailed help for a command
            cmd = bot.get_command(command_name)
            if not cmd:
                await ctx.send(f"Unknown command: {command_name}")
                return
            e = discord.Embed(title=f"Help: {cmd.name}", color=color_int)
            e.add_field(name="Signature", value=f"{prefix}{cmd.name} {cmd.signature}", inline=False)
            e.add_field(name="Help", value=cmd.help or "No description provided.", inline=False)
            await ctx.send(embed=e)
            return

        e = discord.Embed(title="🎶 Sonus Help", color=color_int)
        e.add_field(name="Playback", value=f"{prefix}play <query> — enqueue\n{prefix}pause — pause\n{prefix}skip — skip\n{prefix}queue — show queue", inline=False)
        e.add_field(name="Utility", value=f"{prefix}lyrics — DM lyrics of current track\n{prefix}feedback — send feedback to devs\nType `{prefix}help <command>` for details", inline=False)
        e.set_footer(text="Use slash commands for user-facing flows; prefix commands are for power users.")
        await ctx.send(embed=e)


    @bot.tree.command(name='help')
    @app_commands.describe(command_name='Optional command name to show help for')
    async def _help_slash(interaction: discord.Interaction, command_name: str | None = None):
        await interaction.response.defer(ephemeral=True)
        ctx = await commands.Context.from_interaction(interaction)
        await _help(ctx, command_name)
