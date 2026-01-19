import discord
from discord import app_commands
from discord.ext import commands

from src.logger import setup_logger
from src.utils.guild_settings import load as load_guild_settings

logger = setup_logger(__name__)


def register(bot: commands.Bot):
    # -----------------------
    # Prefix command
    # -----------------------
    if bot.get_command('help') is None:
        @bot.command(
            name="help",
            help="Show help for commands. Optionally provide a command name for detailed help."
        )
        async def _help(ctx: commands.Context, command_name: str | None = None):
            settings = load_guild_settings(ctx.guild.id) if ctx.guild else {"prefix": "S!", "color": "#1DB954"}
            prefix = settings.get("prefix", "S!")
            color = settings.get("color", "#1DB954")
            color_int = int(color.lstrip("#"), 16) if isinstance(color, str) and color.startswith("#") else 0x1DB954

            def _cmd_help_text(cmd: commands.Command) -> str:
                # Prefer explicit help, then callback docstring, then a fallback.
                if cmd.help:
                    return cmd.help
                doc = getattr(getattr(cmd, 'callback', None), '__doc__', None)
                if doc:
                    return doc.strip().splitlines()[0]
                return 'No description provided.'

            # Detailed view for a single command
            if command_name:
                cmd = bot.get_command(command_name)
                if not cmd:
                    await ctx.send(f"Unknown command: `{command_name}`")
                    return

                e = discord.Embed(title=f"Help: {cmd.name}", color=color_int)
                e.add_field(name="Signature", value=f"{prefix}{cmd.name} {cmd.signature}".strip(), inline=False)
                e.add_field(name="Description", value=_cmd_help_text(cmd), inline=False)
                if cmd.aliases:
                    e.add_field(name="Aliases", value=', '.join(cmd.aliases), inline=False)
                await ctx.send(embed=e)
                return

            # Aggregate all visible prefix commands, grouped by cog
            cmds = [c for c in bot.commands if not c.hidden]
            grouped: dict[str, list[commands.Command]] = {}
            for c in sorted(cmds, key=lambda x: (x.cog_name or '', x.name)):
                key = c.cog_name or 'General'
                grouped.setdefault(key, []).append(c)

            e = discord.Embed(title="🎶 Sonus Help", color=color_int)
            for cog, clist in grouped.items():
                lines = []
                for c in clist:
                    sig = f" {c.signature}" if c.signature else ''
                    name = f"{prefix}{c.name}{sig}"
                    desc = _cmd_help_text(c)
                    lines.append(f"**{name}** — {desc}")
                value = "\n".join(lines)
                # discord embed field value max len ~1024
                if len(value) > 1000:
                    value = value[:997] + '...'
                e.add_field(name=cog, value=value, inline=False)

            e.set_footer(text=f"Type {prefix}help <command> for details. Showing {len(cmds)} commands.")
            await ctx.send(embed=e)

    # -----------------------
    # Slash command
    # -----------------------
        if bot.tree.get_command('help') is None:
            @bot.tree.command(
                name="help",
                description="Show help for bot commands. Optionally provide a command name."
            )
            @app_commands.describe(command_name="Optional command name to show detailed help for")
            async def _help_slash(interaction: discord.Interaction, command_name: str | None = None):
                settings = load_guild_settings(interaction.guild.id) if interaction.guild else {"prefix": "S!", "color": "#1DB954"}
                prefix = settings.get("prefix", "S!")
                color = settings.get("color", "#1DB954")
                color_int = int(color.lstrip("#"), 16) if isinstance(color, str) and color.startswith("#") else 0x1DB954

                if command_name:
                    cmd = bot.get_command(command_name)
                    if not cmd:
                        await interaction.response.send_message(f"Unknown command: `{command_name}`", ephemeral=True)
                        return

                    e = discord.Embed(title=f"Help: {cmd.name}", color=color_int)
                    e.add_field(name="Signature", value=f"{prefix}{cmd.name} {cmd.signature}".strip(), inline=False)
                    e.add_field(name="Description", value=_cmd_help_text(cmd), inline=False)
                    if cmd.aliases:
                        e.add_field(name="Aliases", value=', '.join(cmd.aliases), inline=False)
                    await interaction.response.send_message(embed=e, ephemeral=True)
                    return

                cmds = [c for c in bot.commands if not c.hidden]
                grouped: dict[str, list[commands.Command]] = {}
                for c in sorted(cmds, key=lambda x: (x.cog_name or '', x.name)):
                    key = c.cog_name or 'General'
                    grouped.setdefault(key, []).append(c)

                e = discord.Embed(title="🎶 Sonus Help", color=color_int)
                for cog, clist in grouped.items():
                    lines = []
                    for c in clist:
                        sig = f" {c.signature}" if c.signature else ''
                        name = f"{prefix}{c.name}{sig}"
                        desc = _cmd_help_text(c)
                        lines.append(f"**{name}** — {desc}")
                    value = "\n".join(lines)
                    if len(value) > 1000:
                        value = value[:997] + '...'
                    e.add_field(name=cog, value=value, inline=False)

                await interaction.response.send_message(embed=e, ephemeral=True)
        else:
            logger.info("Slash help command already exists; skipping registration")