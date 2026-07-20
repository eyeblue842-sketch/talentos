"use client";

import { Children, cloneElement, isValidElement, useId, useState } from 'react';
import { cn } from '@/lib/utils';

export function Tabs({ items, defaultValue, className }) {
  const generatedId = useId();
  const initialValue = defaultValue || items[0]?.value;
  const [activeTab, setActiveTab] = useState(initialValue);

  function handleKeyDown(event, index) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const lastIndex = items.length - 1;
    let nextIndex = index;

    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = lastIndex;

    setActiveTab(items[nextIndex].value);
    document.getElementById(`${generatedId}-tab-${items[nextIndex].value}`)?.focus();
  }

  return (
    <div className={cn('grid gap-4', className)}>
      <div role="tablist" aria-label="Tabs" className="inline-flex w-full flex-wrap gap-2 rounded-[var(--radius-pill)] bg-[var(--color-bg-muted)] p-1">
        {items.map((item, index) => {
          const isActive = activeTab === item.value;
          return (
            <button
              key={item.value}
              id={`${generatedId}-tab-${item.value}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${generatedId}-panel-${item.value}`}
              tabIndex={isActive ? 0 : -1}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onClick={() => setActiveTab(item.value)}
              className={cn(
                'rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold',
                isActive ? 'bg-white text-[var(--color-primary)] shadow-[var(--shadow-sm)]' : 'text-[var(--color-text-secondary)]',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.value}
          id={`${generatedId}-panel-${item.value}`}
          role="tabpanel"
          aria-labelledby={`${generatedId}-tab-${item.value}`}
          hidden={activeTab !== item.value}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}

export function TabPanels({ activeTab, children, className }) {
  return (
    <div className={className}>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        return cloneElement(child, { hidden: child.props.value !== activeTab });
      })}
    </div>
  );
}
