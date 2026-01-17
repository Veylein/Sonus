from discord import Embed


def register(bot):
    @bot.command(name="pause")
    async def _pause(ctx):
        try:
            bot.player.pause()
            await ctx.send(embed=Embed(description="⏸️ Paused"))
        except Exception:
            await ctx.send("Could not pause (player not ready)")
