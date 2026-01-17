from discord import Embed


def register(bot):
    @bot.command(name="play")
    async def _play(ctx, *, query: str):
        """Enqueue a track (query or URL)."""
        track = {"title": query, "uri": query, "source": "user", "duration": 6}
        try:
            bot.player.enqueue(track)
        except Exception:
            # fallback: keep a simple queue on bot
            q = getattr(bot, "sonus_queue", [])
            q.append(track)
            bot.sonus_queue = q

        e = Embed(title="Enqueued", description=f"{query}")
        await ctx.send(embed=e)
