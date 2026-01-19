from collections import deque
from typing import Any

from discord import Embed


class TrackQueue:
    def __init__(self):
        self._items = deque()

    def enqueue(self, item: dict[str, Any]) -> None:
        self._items.append(item)

    add = enqueue

    def dequeue(self) -> dict[str, Any] | None:
        if not self._items:
            return None
        return self._items.popleft()

    pop = dequeue

    def all(self) -> list[dict[str, Any]]:
        return list(self._items)


def register(bot):
    @bot.command(name="queue")
    async def _queue(ctx):
        try:
            items = bot.player.all()
        except (AttributeError, TypeError):
            try:
                items = bot.track_queue.all()
            except (AttributeError, TypeError):
                items = getattr(bot, "sonus_queue", [])

        if not items:
            await ctx.send("Queue is empty")
            return

        e = Embed(title="Queue")
        for i, t in enumerate(items[:10], start=1):
            e.add_field(name=f"{i}. {t.get('title')}", value=t.get("uri", ""), inline=False)
        await ctx.send(embed=e)
