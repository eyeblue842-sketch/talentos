import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { NetworkPageContent } from '@/components/network/network-page-content';

function createConnection(userId, fullName) {
  return {
    connectionId: `connection-${userId}`,
    connectedAt: '2026-08-13T08:00:00.000Z',
    profile: {
      userId,
      fullName,
      role: 'CANDIDATE',
      designation: 'Software Engineer',
      company: 'Careeriz Labs',
      location: 'Bengaluru',
      skills: ['React'],
      connectionStatus: 'ACCEPTED',
      canConnect: false,
      canMessage: {
        enabled: true,
        allowed: true,
        reason: null,
      },
      mutualConnections: {
        count: 0,
        userIds: [],
      },
      isSelf: false,
    },
  };
}

describe('NetworkPageContent', () => {
  test('renders stable per-user network card and block selectors for accepted connections', () => {
    render(
      <NetworkPageContent
        connections={{
          items: [
            createConnection('user-a', 'Candidate Alpha'),
            createConnection('user-b', 'Candidate Beta'),
          ],
          meta: { total: 2, page: 1, pageSize: 8, pageCount: 1 },
        }}
        receivedRequests={{ items: [], meta: { total: 0, page: 1, pageSize: 4, pageCount: 1 } }}
        sentRequests={{ items: [], meta: { total: 0, page: 1, pageSize: 4, pageCount: 1 } }}
        suggestions={{ items: [], meta: { total: 0, page: 1, pageSize: 4, pageCount: 1 } }}
        searchResults={{ items: [], meta: { total: 0, page: 1, pageSize: 6, pageCount: 1 } }}
        privacy={{
          settings: {
            allowConnectionRequestsFrom: 'EVERYONE',
            connectionVisibility: 'CONNECTIONS_ONLY',
            showInPeopleSearch: true,
            showRecruiterIdentity: true,
          },
        }}
        searchParams={{}}
        redirectTo="/candidate/network"
        messageBasePath="/candidate/messages"
      />,
    );

    const alphaCard = screen.getByTestId('network-user-user-a');
    const betaCard = screen.getByTestId('network-user-user-b');

    expect(within(alphaCard).getByTestId('network-block-user-a')).toHaveAccessibleName('Block Candidate Alpha');
    expect(within(betaCard).getByTestId('network-block-user-b')).toHaveAccessibleName('Block Candidate Beta');
    expect(within(alphaCard).getByTestId('network-message-user-a')).toHaveAttribute('href', '/candidate/messages?user=user-a');
    expect(within(betaCard).queryByTestId('network-block-user-a')).toBeNull();
  });
});
