"use client";

import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export function DropdownMenu({ trigger, items, align = 'right', className }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleClick(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    itemRefs.current[0]?.focus();

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function moveFocus(currentIndex, direction) {
    const total = itemRefs.current.length;
    if (!total) {
      return;
    }

    const nextIndex = (currentIndex + direction + total) % total;
    itemRefs.current[nextIndex]?.focus();
  }

  function handleItemKeyDown(event, index) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(index, 1);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(index, -1);
    }

    if (event.key === 'Home') {
      event.preventDefault();
      itemRefs.current[0]?.focus();
    }

    if (event.key === 'End') {
      event.preventDefault();
      itemRefs.current[itemRefs.current.length - 1]?.focus();
    }
  }

  const triggerProps = {
    'aria-expanded': open,
    'aria-haspopup': 'menu',
    'aria-controls': open ? menuId : undefined,
    onClick: () => setOpen((current) => !current),
    onKeyDown: (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
    },
  };

  const enhancedTrigger = isValidElement(trigger)
    ? cloneElement(trigger, triggerProps)
    : <button type="button" {...triggerProps}>{trigger}</button>;

  return (
    <div ref={containerRef} className="relative inline-flex">
      {enhancedTrigger}
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute top-[calc(100%+0.5rem)] z-40 min-w-48 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-1.5 shadow-[var(--shadow-lg)]',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {items.map((item, index) => (
            item.href ? (
              <a
                key={item.label}
                href={item.href}
                role="menuitem"
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                tabIndex={0}
                onClick={() => setOpen(false)}
                onKeyDown={(event) => handleItemKeyDown(event, index)}
                className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text)]"
              >
                {item.icon ? <item.icon size={16} aria-hidden="true" /> : null}
                {item.label}
              </a>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
                onKeyDown={(event) => handleItemKeyDown(event, index)}
                className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text)]"
              >
                {item.icon ? <item.icon size={16} aria-hidden="true" /> : null}
                {item.label}
              </button>
            )
          ))}
        </div>
      ) : null}
    </div>
  );
}
