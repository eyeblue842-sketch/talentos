import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

const globalsCss = readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');

function tokenDefinedInBothThemes(name) {
  const rootBlock = globalsCss.split(':root {')[1]?.split('\n}')[0] ?? '';
  const darkBlock = globalsCss.split('[data-theme="dark"] {')[1]?.split('\n}')[0] ?? '';
  return rootBlock.includes(name) && darkBlock.includes(name);
}

describe('application-shell design tokens (U1)', () => {
  test('preserves the Careeriz brand primitives', () => {
    expect(globalsCss).toContain('--color-primary: #52389d');
    expect(globalsCss).toContain('--color-accent: #4f9cf9');
  });

  test('every new shell surface/navigation/text/border token exists in :root', () => {
    const rootBlock = globalsCss.split(':root {')[1]?.split('\n}')[0] ?? '';
    [
      '--shell-bg',
      '--shell-surface-elevated',
      '--shell-surface-nav',
      '--shell-surface-header',
      '--shell-nav-item-hover-bg',
      '--shell-nav-item-active-bg',
      '--shell-nav-item-active-text',
      '--shell-nav-item-active-indicator',
      '--shell-border-subtle',
      '--shell-border-strong',
      '--shell-text-primary',
      '--shell-text-secondary',
      '--shell-text-muted',
      '--focus-ring',
      '--focus-ring-glow',
      '--overlay-scrim',
      '--shell-width-collapsed',
      '--shell-width-expanded',
      '--shell-width-context-rail',
      '--shell-density-compact-gap',
      '--shell-density-comfortable-gap',
    ].forEach((token) => {
      expect(rootBlock, `${token} should be declared in :root`).toContain(token);
    });
  });

  test('status badge and shell-surface-nav tokens are token-ready for dark mode', () => {
    [
      '--shell-surface-nav',
      '--shell-nav-item-hover-bg',
      '--color-badge-success-bg',
      '--color-badge-success-text',
      '--color-badge-warning-bg',
      '--color-badge-danger-bg',
      '--color-badge-info-bg',
      '--color-badge-neutral-bg',
      '--color-badge-purple-bg',
    ].forEach((token) => {
      expect(tokenDefinedInBothThemes(token), `${token} should be redefined in both :root and [data-theme="dark"]`).toBe(true);
    });
  });

  test('no dark-mode toggle markup or logic was introduced', () => {
    expect(globalsCss).not.toMatch(/toggle|prefers-color-scheme/i);
  });

  test(':focus-visible resolves through the new focus-ring token, not a hardcoded color', () => {
    expect(globalsCss).toMatch(/:focus-visible\s*{\s*outline:\s*var\(--focus-ring-width\)\s*solid\s*var\(--focus-ring\)/);
  });

  test('Badge tones render using the new semantic badge tokens', () => {
    render(
      <div>
        <Badge tone="success">Success</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="danger">Danger</Badge>
        <Badge tone="info">Info</Badge>
        <Badge tone="neutral">Neutral</Badge>
        <Badge tone="purple">Purple</Badge>
      </div>,
    );

    expect(screen.getByText('Success')).toHaveClass('bg-[var(--color-badge-success-bg)]', 'text-[var(--color-badge-success-text)]');
    expect(screen.getByText('Warning')).toHaveClass('bg-[var(--color-badge-warning-bg)]', 'text-[var(--color-badge-warning-text)]');
    expect(screen.getByText('Danger')).toHaveClass('bg-[var(--color-badge-danger-bg)]', 'text-[var(--color-badge-danger-text)]');
    expect(screen.getByText('Info')).toHaveClass('bg-[var(--color-badge-info-bg)]', 'text-[var(--color-badge-info-text)]');
    expect(screen.getByText('Neutral')).toHaveClass('bg-[var(--color-badge-neutral-bg)]', 'text-[var(--color-badge-neutral-text)]');
    expect(screen.getByText('Purple')).toHaveClass('bg-[var(--color-badge-purple-bg)]', 'text-[var(--color-badge-purple-text)]');
  });

  test('Dialog overlay uses the shared overlay-scrim token', () => {
    render(<Dialog open onClose={() => {}} title="Example"><p>Body</p></Dialog>);
    expect(screen.getByRole('dialog').parentElement).toHaveClass('bg-[var(--overlay-scrim)]');
  });

  test('Button focus-visible ring uses the shared focus-ring-glow token', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('focus-visible:ring-[color:var(--focus-ring-glow)]');
  });
});
