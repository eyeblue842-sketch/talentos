import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, test, vi } from 'vitest';
import { Bell, BriefcaseBusiness } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

describe('design system foundation', () => {
  test('button variants render', () => {
    render(
      <div>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="link">Link</Button>
      </div>,
    );

    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Outline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghost' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Danger' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link' })).toBeInTheDocument();
  });

  test('button loading disables interaction', () => {
    render(<Button loading>Saving</Button>);
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });

  test('inputs associate labels correctly and expose accessible error state', () => {
    render(<Input label="Email address" error="Email is required." defaultValue="" />);
    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Email is required.')).toHaveAttribute('id', expect.stringContaining('error'));
  });

  test('modal supports keyboard closing', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Confirm action" description="Dialog copy">
        <Button>Confirm</Button>
      </Dialog>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('tabs expose the correct active state', () => {
    render(
      <Tabs
        items={[
          { value: 'candidate', label: 'Candidate', content: <p>Candidate panel</p> },
          { value: 'recruiter', label: 'Recruiter', content: <p>Recruiter panel</p> },
        ]}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Candidate' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Recruiter' }));
    expect(screen.getByRole('tab', { name: 'Recruiter' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Recruiter panel')).toBeVisible();
  });

  test('empty state actions work', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={BriefcaseBusiness}
        title="Nothing here"
        description="No data yet."
        primaryAction={{ label: 'Primary action', onClick }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Primary action' }));
    expect(onClick).toHaveBeenCalled();
  });

  test('core components do not produce obvious accessibility violations', async () => {
    const { container } = render(
      <div>
        <Card>
          <Badge variant="info">Info</Badge>
          <Input label="Candidate email" placeholder="candidate@example.com" />
          <Button leadingIcon={Bell}>Notify</Button>
        </Card>
      </div>,
    );

    expect((await axe(container)).violations).toHaveLength(0);
  });
});
