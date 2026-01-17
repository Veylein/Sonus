import asyncio
from collections import deque

class Player:
    def __init__(self):
        self.queue = deque()
        self._playing = asyncio.Event()

    def enqueue(self, item):
        self.queue.append(item)

    def dequeue(self):
        return self.queue.popleft() if self.queue else None

    def is_playing(self):
        return self._playing.is_set()

    async def play_loop(self):
        while True:
            if not self.queue:
                await asyncio.sleep(1)
                continue
            track = self.dequeue()
            # placeholder: hand off to VC sink
            await asyncio.sleep(0)
