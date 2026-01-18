import discord
from discord import app_commands
from discord.ext import commands

from src.logger import setup_logger
from src.utils.audit import log_action

logger = setup_logger(__name__)

FEEDBACK_CHANNEL = 1462019751218778112


class Feedback(commands.Cog):
    """Cog for feedback commands (prefix + slash)."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.command(name="feedback")
    async def feedback_prefix(self, ctx: commands.Context, *, text: str):
        success = await self._handle_feedback(ctx.author, text)
        if success:
            await ctx.send("✅ Thanks — your feedback was sent to the devs.")
        else:
            await ctx.send("❌ Sorry — I couldn't deliver your feedback. The devs have been notified.")
        await log_action(self.bot, ctx.author.id, "feedback_prefix", {"text_preview": text[:200], "delivered": success})

    @app_commands.command(name="feedback", description="Send feedback to the developers")
    @app_commands.describe(text="Your feedback for the developers")
    async def feedback_slash(self, interaction: discord.Interaction, text: str):
        await interaction.response.defer(ephemeral=True)
        success = await self._handle_feedback(interaction.user, text)
        if success:
            await interaction.followup.send("✅ Thanks — your feedback was sent to the devs.", ephemeral=True)
        else:
            await interaction.followup.send("❌ Sorry — I couldn't deliver your feedback. The devs have been notified.", ephemeral=True)
        await log_action(self.bot, interaction.user.id, "feedback_slash", {"text_preview": text[:200], "delivered": success})

    async def _handle_feedback(self, author: discord.abc.User, content: str) -> bool:
        embed = discord.Embed(title="User Feedback", color=0x1DB954)
        embed.add_field(name="From", value=f"{author} (ID: {author.id})", inline=False)
        embed.description = (content or "(empty)")[:3900]

        try:
            ch = self.bot.get_channel(FEEDBACK_CHANNEL) or await self.bot.fetch_channel(FEEDBACK_CHANNEL)
            await ch.send(embed=embed)
            return True
        except Exception:
            logger.exception("Failed to send feedback to dev channel")

        delivered_any = False
        for owner_id in getattr(self.bot, "owner_ids", []) or []:
            try:
                owner = await self.bot.fetch_user(owner_id)
                if owner:
                    await owner.send(f"⚠ Feedback delivery failed for message from {author}:", embed=embed)
                    delivered_any = True
            except Exception:
                logger.exception("Failed to send feedback DM to owner %s", owner_id)

        try:
            await log_action(self.bot, author.id, "feedback_failed_delivery", {
                "text_preview": (content or "")[:200],
                "delivered_to_owner": delivered_any
            })
        except Exception:
            logger.exception("Failed to log feedback failure")
        return delivered_any


async def setup(bot: commands.Bot):
    await bot.add_cog(Feedback(bot))
