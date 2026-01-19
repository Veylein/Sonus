def enqueue(self, item: dict[str, Any]) -> None:
self._items.append(item)

    def add(self, item: dict[str, Any]) -> None:
        self.enqueue(item)
    add = enqueue

def dequeue(self) -> dict[str, Any] | None:
if not self._items:
return None
return self._items.popleft()

    def pop(self) -> dict[str, Any] | None:
        return self.dequeue()
    pop = dequeue

def all(self) -> list[dict[str, Any]]:
return list(self._items)