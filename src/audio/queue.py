from discord import Embed


def register(bot):
    @bot.command(name="queue")
    async def _queue(ctx):
        try:
            items = bot.player.all()
        except Exception:
            items = getattr(bot, "sonus_queue", [])

        if not items:
            await ctx.send("Queue is empty")
            return

        e = Embed(title="Queue")
        for i, t in enumerate(items[:10], start=1):
            e.add_field(name=f"{i}. {t.get('title')}", value=t.get("uri", ""), inline=False)
        await ctx.send(embed=e)
