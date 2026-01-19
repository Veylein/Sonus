from discord import Embed


class TrackQueue:
    def __init__(self):
        self._items = []

    def add(self, item: dict):
        self._items.append(item)

    def pop(self):
        if not self._items:
            return None
        return self._items.pop(0)

    def all(self):
        return list(self._items)


def register(bot):
    @bot.command(name="queue")
    async def _queue(ctx):
        try:
            items = bot.player.all()
        except Exception:
            try:
                items = bot.track_queue.all()
            except Exception:
                items = getattr(bot, "sonus_queue", [])

        if not items:
            await ctx.send("Queue is empty")
            return

        e = Embed(title="Queue")
        for i, t in enumerate(items[:10], start=1):
            e.add_field(name=f"{i}. {t.get('title')}", value=t.get("uri", ""), inline=False)
        await ctx.send(embed=e)
