"""Process-wide concurrency tracking for the analyse endpoint. A single
asyncio.Semaphore (this process is single-worker; see main.py) bounds how
many analyse requests run at once, and a plain counter lets /health/ready
report the current load without needing to inspect the semaphore's private
internals.
"""
from __future__ import annotations

import asyncio

from app.config import settings

analysis_semaphore = asyncio.Semaphore(settings.max_concurrent_requests)
_active_requests = 0
_lock = asyncio.Lock()


async def enter_analysis() -> None:
    global _active_requests
    await analysis_semaphore.acquire()
    async with _lock:
        _active_requests += 1


async def exit_analysis() -> None:
    global _active_requests
    async with _lock:
        _active_requests = max(0, _active_requests - 1)
    analysis_semaphore.release()


def active_request_count() -> int:
    return _active_requests
