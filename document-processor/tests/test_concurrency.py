import asyncio

from app import state


def test_concurrent_processing_is_bounded_by_max_concurrent_requests(monkeypatch):
    async def scenario():
        # Rebuild state's semaphore/counter with a small, test-local limit
        # so this test doesn't depend on (or mutate) the process-wide default.
        monkeypatch.setattr(state, "analysis_semaphore", asyncio.Semaphore(2))
        monkeypatch.setattr(state, "_active_requests", 0)

        await state.enter_analysis()
        await state.enter_analysis()
        assert state.active_request_count() == 2

        # A third acquisition must block -- the limit is genuinely enforced,
        # not just advisory/counted.
        third_acquired = asyncio.Event()

        async def try_enter_third():
            await state.enter_analysis()
            third_acquired.set()

        task = asyncio.create_task(try_enter_third())
        await asyncio.sleep(0.05)
        assert not third_acquired.is_set(), "a third concurrent request must be blocked while the limit is at capacity"

        # Freeing one slot must unblock exactly the waiting request.
        await state.exit_analysis()
        await asyncio.wait_for(third_acquired.wait(), timeout=1)
        assert state.active_request_count() == 2

        await state.exit_analysis()
        await state.exit_analysis()
        assert state.active_request_count() == 0
        task.cancel()

    asyncio.run(scenario())
