"use client";

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  side = 'right',
  restoreFocusRef = null,
  className,
}) {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const previousActiveRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      restoreFocusRef?.current?.focus?.();
      previousActiveRef.current?.focus?.();
      return undefined;
    }

    previousActiveRef.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll(focusableSelector);
    focusable?.[0]?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }

      if (event.key !== 'Tab' || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (restoreFocusRef?.current?.focus) {
        restoreFocusRef.current.focus();
      } else {
        previousActiveRef.current?.focus?.();
      }
    };
  }, [open, onClose, restoreFocusRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-[var(--overlay-scrim)] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === overlayRef.current) {
          onClose?.();
        }
      }}
    >
      <div className={cn('absolute bg-white shadow-[var(--shadow-floating)]', side === 'bottom'
        ? 'inset-x-0 bottom-0 rounded-t-[28px] border-t border-[var(--color-border)]'
        : 'inset-y-0 right-0 w-full max-w-md border-l border-[var(--color-border)]',
      className)}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          className="flex h-full max-h-[100dvh] flex-col"
        >
          <div className="flex items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              {title ? <h2 id={titleId} className="text-lg font-semibold text-[var(--color-text)]">{title}</h2> : null}
              {description ? <p id={descriptionId} className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p> : null}
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full shadow-none" aria-label="Close sheet" onClick={onClose}>
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
