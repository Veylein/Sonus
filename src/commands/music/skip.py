from discord import Embed


def register(bot):
    @bot.command(name="skip")
    async def _skip(ctx):
        try:
            bot.player.skip()
            await ctx.send(embed=Embed(description="⏭️ Skipping track"))
        except Exception:
            await ctx.send("Could not skip (player not ready)")
