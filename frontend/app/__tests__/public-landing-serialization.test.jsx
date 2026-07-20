import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import HomePage from '@/app/page';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/lib/auth', () => ({
  redirectIfAuthenticated: vi.fn(async () => null),
}));

vi.mock('@/lib/api', () => ({
  getPublicPortal: vi.fn(async () => ({
    latestJobs: [],
    featuredJobs: [],
    categories: [],
    locations: [],
    workplaceTypes: [],
  })),
}));

function isElementLike(value) {
  return Boolean(value && typeof value === 'object' && 'props' in value);
}

function collectUnsafeProps(node, findings = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => collectUnsafeProps(child, findings));
    return findings;
  }

  if (!isElementLike(node)) {
    return findings;
  }

  const props = node.props || {};
  const elementName = typeof node.type === 'string' ? node.type : node.type?.name || 'Anonymous';

  ['leadingIcon', 'trailingIcon', 'icon'].forEach((propName) => {
    if (typeof props[propName] === 'function') {
      findings.push(`${elementName}.${propName}`);
    }
  });

  collectUnsafeProps(props.children, findings);
  return findings;
}

describe('public landing server/client boundary safety', () => {
  test('homepage renders the platform gateway entry points', async () => {
    render(await HomePage());

    expect(screen.getByRole('heading', { name: /one intelligent platform for careers and hiring/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue as candidate/i })).toHaveAttribute('href', '/candidate');
    expect(screen.getByRole('link', { name: /continue as employer/i })).toHaveAttribute('href', '/hire');
    expect(screen.getByRole('heading', { name: /careeriz ai powers both sides of the talent journey/i })).toBeInTheDocument();
  });

  test('homepage tree does not pass function-valued icon props into client components', async () => {
    const tree = await HomePage();
    const unsafeProps = collectUnsafeProps(tree);

    expect(unsafeProps).toEqual([]);
  });
});
