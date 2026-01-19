import discord
from discord.ext import commands
from discord import app_commands

FEEDBACK_CHANNEL_ID = 1462019751218778112

class Feedback(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    # ------------------------
    # Prefix command
    # ------------------------
    @commands.command(name="feedback")
    async def feedback_prefix(self, ctx: commands.Context, *, text: str):
        channel = self.bot.get_channel(FEEDBACK_CHANNEL_ID)
        if not channel or not isinstance(channel, discord.TextChannel):
            await ctx.send("Feedback channel not found.")
            return

        try:
            await channel.send(f"[{ctx.author}] ID:{ctx.author.id} says `{text}`")
            await ctx.author.send("Your feedback was sent")
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
