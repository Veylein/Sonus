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
            items = getattr(bot, "sonus_queue", [])
            try:
                items = bot.track_queue.all()
            except Exception:
                items = getattr(bot, "sonus_queue", [])

if not items:
await ctx.send("Queue is empty")