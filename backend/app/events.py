import asyncio
from contextlib import asynccontextmanager

_subscribers: set[asyncio.Queue] = set()


@asynccontextmanager
async def subscribe():
    """Yield a queue that receives event dicts. Auto-unsubscribes on exit."""
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.add(queue)
    try:
        yield queue
    finally:
        _subscribers.discard(queue)


def publish(event_type: str):
    """Broadcast an event to all connected SSE clients.

    Iterates a snapshot (list) of _subscribers because publish() may be called
    from a sync thread (Telegram bot tools) while subscribe/unsubscribe mutates
    the set on the event-loop thread.
    """
    for queue in list(_subscribers):
        queue.put_nowait({"type": event_type})
