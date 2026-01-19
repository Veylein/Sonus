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
        success = await _handle_feedback(bot, author=ctx.author, content=text)
        if success:
            try:
                await ctx.send("✅ Thanks — your feedback was sent to the devs.")
            except Exception:
                # sending in-channel failed; still attempt to DM the user
                pass
            try:
                await ctx.author.send("✅ Thanks — your feedback was sent to the devs.")
            except Exception:
                # user may have DMs closed; ignore
                pass
        else:
            await ctx.send("❌ Sorry — I couldn't deliver your feedback. The devs have been notified.")
        await log_action(bot, ctx.author.id, "feedback_prefix", {"text_preview": text[:200], "delivered": success})

    @bot.tree.command(name="feedback")
    @app_commands.describe(text="Your feedback for the Sonus devs")
    async def _feedback_slash(interaction: discord.Interaction, text: str):
        """Slash command: /feedback <text>"""
        await interaction.response.defer(ephemeral=True)
        success = await _handle_feedback(bot, author=interaction.user, content=text)
        if success:
            try:
                await interaction.followup.send("✅ Thanks — your feedback was sent to the devs.", ephemeral=True)
            except Exception:
                pass
            try:
                await interaction.user.send("✅ Thanks — your feedback was sent to the devs.")
            except Exception:
                # DMs may be closed; ignore
                pass
        else:
            await interaction.followup.send("❌ Sorry — I couldn't deliver your feedback. The devs have been notified.", ephemeral=True)
        await log_action(bot, interaction.user.id, "feedback_slash", {"text_preview": text[:200], "delivered": success})


async def _handle_feedback(bot: commands.Bot, author: discord.abc.User, content: str) -> bool:
    # Build an embed for devs but also send a plain text fallback
    e = discord.Embed(title="User Feedback", color=0x1DB954)
    e.add_field(name="From", value=f"{author} (ID: {author.id})", inline=False)
    safe_content = (content or "(empty)")[:3900]
    e.description = safe_content
    text_payload = f"[{getattr(author, 'display_name', str(author))}] ID:{author.id} says:\n```\n{safe_content[:1900]}\n```"
    try:
        # Try get cached channel first
        ch = bot.get_channel(FEEDBACK_CHANNEL)
        if ch is None:
            ch = await bot.fetch_channel(FEEDBACK_CHANNEL)
        # Prefer sending rich embed, but fall back to plain text if channel doesn't support embeds
        try:
            await ch.send(content=text_payload, embed=e)
        except Exception:
            await ch.send(text_payload)
        return True
    except Exception:
        logger.exception("Failed to deliver feedback to dev channel")
        # fallback: attempt to DM the bot owner(s) if available (use fetch_user to ensure object)
        delivered_any = False
        try:
            for owner_id in getattr(bot, "owner_ids", []) or []:
                try:
                    owner = await bot.fetch_user(owner_id)
                    if owner:
                        await owner.send(f"Feedback delivery failed for message from {author}:", embed=e)
                        delivered_any = True
                except Exception:
                    logger.exception("Failed sending feedback DM to owner %s", owner_id)
        except Exception:
            logger.exception("Failed to deliver feedback to owners as fallback")
        # If still failed, record an audit entry so devs can find the raw content later
        try:
            await log_action(bot, author.id, "feedback_failed_delivery", {"text_preview": (content or "")[:200], "delivered_to_owner": delivered_any})
        except Exception:
            logger.exception("Failed to write feedback failure audit entry")
        return delivered_any
