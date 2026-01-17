from discord import Embed


def register(bot):
    @bot.command(name="radio")
    async def _radio(ctx, action: str, *, name: str = ""):
        action = action.lower()
        if action == "list":
            await ctx.send("Radio list not implemented yet")
            return
        await ctx.send(embed=Embed(description=f"Radio {action} {name}"))
