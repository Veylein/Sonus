import discord
from discord import app_commands
from discord.ext import commands

from src.logger import setup_logger
from src.utils.audit import log_action

logger = setup_logger(__name__)

FEEDBACK_CHANNEL = 1462019751218778112


def register(bot: commands.Bot):
    @bot.command(name="feedback")
    async def _feedback(ctx: commands.Context, *, text: str):
        """Prefix command: S!feedback <text>"""
        await _handle_feedback(bot, author=ctx.author, content=text)
        await ctx.send("Thanks — your feedback was sent to the devs.")
        await log_action(bot, ctx.author.id, "feedback_prefix", {"text_preview": text[:200]})

    @bot.tree.command(name="feedback")
    @app_commands.describe(text="Your feedback for the Sonus devs")
    async def _feedback_slash(interaction: discord.Interaction, text: str):
        """Slash command: /feedback <text>"""
        await interaction.response.send_message("Thanks — your feedback was sent to the devs.", ephemeral=True)
        await _handle_feedback(bot, author=interaction.user, content=text)
        await log_action(bot, interaction.user.id, "feedback_slash", {"text_preview": text[:200]})


async def _handle_feedback(bot: commands.Bot, author: discord.abc.User, content: str):
    # Build an embed for devs
    e = discord.Embed(title="User Feedback", color=0x1DB954)
    e.add_field(name="From", value=f"{author} (ID: {author.id})", inline=False)
    e.add_field(name="Content", value=(content[:1900] or "(empty)"), inline=False)
    try:
        # Try get cached channel first
        ch = bot.get_channel(FEEDBACK_CHANNEL)
        if ch is None:
            ch = await bot.fetch_channel(FEEDBACK_CHANNEL)
        await ch.send(embed=e)
    except Exception:
        logger.exception("Failed to deliver feedback to dev channel")
        # fallback: attempt to DM the bot owner(s) if available
        try:
            for owner_id in getattr(bot, "owner_ids", []) or []:
                owner = bot.get_user(owner_id)
                if owner:
                    await owner.send(f"Feedback delivery failed for message from {author}:", embed=e)
        except Exception:
            logger.exception("Failed to deliver feedback to owners as fallback")
