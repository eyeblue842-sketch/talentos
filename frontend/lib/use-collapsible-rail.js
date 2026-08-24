"use client";

import { useEffect, useRef, useState } from 'react';

// The shared collapsible-rail behavioral primitive: a compact strip that
// expands into a full panel on hover OR click (never hover-only, so
// keyboard/touch users can reach it too), stays open when pinned, and
// closes on outside-click/Escape/pointer-leave when unpinned. An explicit
// collapse always suppresses hover-driven reopen briefly, since a click
// can leave the cursor sitting on the newly-revealed collapsed strip.
//
// Each consumer (the app-shell nav rail, the Resume Search V2 filter
// rail, ...) calls this with its OWN `persistKey` and `defaultExpanded`,
// getting fully independent state and localStorage persistence - nothing
// here is shared across instances except the mechanics.
export function useCollapsibleRail({ persistKey, defaultExpanded = false } = {}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [pinned, setPinned] = useState(defaultExpanded);
  const [hydrated, setHydrated] = useState(!persistKey);
  const containerRef = useRef(null);
  const suppressHoverUntilRef = useRef(0);

  function collapse() {
    suppressHoverUntilRef.current = Date.now() + 400;
    setPinned(false);
    setExpanded(false);
  }

  function expand() {
    setExpanded(true);
  }

  function expandAndPin() {
    setExpanded(true);
    setPinned(true);
  }

  function togglePin() {
    if (pinned) collapse();
    else expandAndPin();
  }

  useEffect(() => {
    if (!persistKey) return;
    // This IS the sync-from-an-external-system case
    // react-hooks/set-state-in-effect means to allow: it reads
    // localStorage (external to React) and applies it once, after mount.
    // A lazy useState(() => localStorage.getItem(...)) initializer is not
    // a safe alternative here - client components still render once
    // during SSR/RSC and again on the client BEFORE hydration completes,
    // so a lazy initializer would read real localStorage on that
    // pre-hydration client render while the server had none, producing
    // the exact hydration mismatch this effect exists to avoid.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const stored = window.localStorage.getItem(persistKey);
      if (stored === 'true') {
        setPinned(true);
        setExpanded(true);
      } else if (stored === 'false') {
        setPinned(false);
        setExpanded(false);
      }
    } catch {
      // localStorage unavailable (privacy mode, disabled storage, etc.) -
      // fall back to defaultExpanded.
    } finally {
      setHydrated(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Only ever read the stored preference once, right after mount.
  }, [persistKey]);

  useEffect(() => {
    if (!persistKey || !hydrated) return;
    try {
      window.localStorage.setItem(persistKey, String(pinned));
    } catch {
      // Ignore write failures - the preference simply won't persist.
    }
  }, [persistKey, hydrated, pinned]);

  useEffect(() => {
    if (!expanded || pinned) return undefined;
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) collapse();
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [expanded, pinned]);

  useEffect(() => {
    if (!expanded) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !pinned) collapse();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expanded, pinned]);

  function handleMouseEnter() {
    if (pinned || Date.now() < suppressHoverUntilRef.current) return;
    setExpanded(true);
  }

  function handleMouseLeave() {
    if (!pinned) setExpanded(false);
  }

  return {
    expanded,
    pinned,
    containerRef,
    collapse,
    expand,
    expandAndPin,
    togglePin,
    handleMouseEnter,
    handleMouseLeave,
  };
}
