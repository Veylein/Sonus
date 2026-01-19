from collections import deque
from typing import Any

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