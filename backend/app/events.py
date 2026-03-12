import asyncio
from contextlib import asynccontextmanager

_subscribers: set[asyncio.Queue] = set()
_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Capture the running event loop (call once at startup)."""
    global _loop
    _loop = loop


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

    Uses call_soon_threadsafe so this is safe to call from any thread
    (e.g. sync tool functions running in a worker thread).
    """
    event = {"type": event_type}
    for queue in list(_subscribers):
        if _loop is not None and _loop.is_running():
            _loop.call_soon_threadsafe(queue.put_nowait, event)
        else:
            queue.put_nowait(event)
