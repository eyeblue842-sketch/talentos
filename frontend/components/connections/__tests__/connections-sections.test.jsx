import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ConnectionsSections } from '@/components/connections/connections-sections';

vi.mock('@/components/network/network-page-content', () => ({
  NetworkPageContent: () => <div data-testid="network-content">Network content</div>,
}));

vi.mock('@/components/messaging/messages-workspace', () => ({
  MessagesWorkspace: () => <div data-testid="messages-content">Messages content</div>,
}));

const data = {
  members: [],
  invitations: [],
  connections: { items: [], meta: { total: 0 } },
  receivedRequests: { items: [], meta: { total: 0 } },
  sentRequests: { items: [], meta: { total: 0 } },
  suggestions: { items: [], meta: { total: 0 } },
  searchResults: { items: [], meta: { total: 0 } },
  privacy: { settings: {} },
  conversations: { items: [] },
  messages: { items: [], meta: { nextCursor: null } },
};

describe('ConnectionsSections', () => {
  test('renders the required section order and stable URLs', () => {
    render(<ConnectionsSections section="company-people" organisation={{ name: 'Northstar' }} data={data} redirectTo="/recruiter/home?tab=connections&section=company-people" />);
    expect(screen.getByRole('link', { name: 'Company People' })).toHaveAttribute('href', '/recruiter/home?tab=connections&section=company-people');
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Company People', 'Discover', 'My Connections', 'Invitations', 'Messages', 'Manage members']);
  });

  test('keeps Messages as a separate section using the existing workspace', () => {
    render(<ConnectionsSections section="messages" organisation={{ name: 'Northstar' }} data={data} redirectTo="/recruiter/home?tab=connections&section=messages" />);
    expect(screen.getByTestId('messages-content')).toBeInTheDocument();
  });
});
