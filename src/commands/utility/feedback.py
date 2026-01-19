import discord
from discord.ext import commands
from discord import app_commands

FEEDBACK_CHANNEL_ID = 1462019751218778112


def register(bot: commands.Bot):
    @bot.command(name="feedback")
    async def _feedback(ctx: commands.Context, *, text: str):
        """Prefix command: S!feedback <text>"""
        success = await _handle_feedback(bot, author=ctx.author, content=text)
        if success:
            await ctx.send("✅ Thanks — your feedback was sent to the devs.")
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
            await interaction.followup.send("✅ Thanks — your feedback was sent to the devs.", ephemeral=True)
        else:
            await interaction.followup.send("❌ Sorry — I couldn't deliver your feedback. The devs have been notified.", ephemeral=True)
        await log_action(bot, interaction.user.id, "feedback_slash", {"text_preview": text[:200], "delivered": success})


async def _handle_feedback(bot: commands.Bot, author: discord.abc.User, content: str) -> bool:
    # Build an embed for devs. Use description (larger limit) and clamp to safe size.
    e = discord.Embed(title="User Feedback", color=0x1DB954)
    e.add_field(name="From", value=f"{author} (ID: {author.id})", inline=False)
    safe_content = (content or "(empty)")[:3900]
    e.description = safe_content
    try:
        # Try get cached channel first
        ch = bot.get_channel(FEEDBACK_CHANNEL)
        if ch is None:
            ch = await bot.fetch_channel(FEEDBACK_CHANNEL)
        await ch.send(embed=e)
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
            await ctx.author.send("Feedback could not be sent, the devs have been notified")
            await channel.send(f"[{ctx.author}] could not send feedback")

    # ------------------------
    # Slash command
    # ------------------------
    @app_commands.command(name="feedback", description="Send feedback to the devs")
    @app_commands.describe(text="Your feedback")
    async def feedback_slash(self, interaction: discord.Interaction, text: str):
        channel = self.bot.get_channel(FEEDBACK_CHANNEL_ID)
        if not channel or not isinstance(channel, discord.TextChannel):
            await interaction.response.send_message("Feedback channel not found.", ephemeral=True)
            return

        try:
            await channel.send(f"[{interaction.user}] ID:{interaction.user.id} says `{text}`")
            await interaction.user.send("Your feedback was sent")
            await interaction.response.send_message("Feedback sent successfully!", ephemeral=True)
        except Exception:
            await interaction.user.send("Feedback could not be sent, the devs have been notified")
            await channel.send(f"[{interaction.user}] could not send feedback")
            await interaction.response.send_message("There was an error sending your feedback.", ephemeral=True)

# Required by your loader
async def setup(bot):
    await bot.add_cog(Feedback(bot))
