from collections import deque

class TrackQueue:
    def __init__(self):
        self._q = deque()

    def add(self, track):
        self._q.append(track)

    def pop(self):
        return self._q.popleft() if self._q else None

    def peek(self):
        return self._q[0] if self._q else None

    def all(self):
        return list(self._q)
