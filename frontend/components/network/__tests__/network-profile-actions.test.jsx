import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { NetworkProfileActions } from '@/components/network/network-profile-actions';

function renderActions(profile) {
  return render(
    <NetworkProfileActions
      profile={profile}
      redirectTo="/candidate/network"
      source="PROFILE"
      messageHref={`/candidate/messages?user=${profile.userId}`}
    />,
  );
}

describe('NetworkProfileActions', () => {
  test('shows connect for connectable profiles and hides block for self', () => {
    renderActions({
      userId: 'user-1',
      isSelf: true,
      canConnect: false,
      connectionStatus: 'NONE',
    });

    expect(screen.getByRole('link', { name: /view profile/i })).toHaveAttribute('href', '/network/people/user-1');
    expect(screen.queryByRole('button', { name: /connect/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /block/i })).toBeNull();
  });

  test('shows connect and block actions for an available profile', () => {
    renderActions({
      userId: 'user-2',
      fullName: 'Rahul Sharma',
      isSelf: false,
      canConnect: true,
      connectionStatus: 'NONE',
    });

    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    expect(screen.getByTestId('network-block-user-2')).toHaveAccessibleName('Block Rahul Sharma');
  });

  test('shows accept and decline for incoming pending requests', () => {
    renderActions({
      userId: 'user-3',
      isSelf: false,
      canConnect: false,
      connectionStatus: 'PENDING',
      pendingDirection: 'INCOMING',
      requestId: 'request-1',
    });

    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
  });

  test('shows remove for connected profiles and hides message when messaging is unavailable', () => {
    renderActions({
      userId: 'user-4',
      isSelf: false,
      canConnect: false,
      connectionStatus: 'ACCEPTED',
      connectionId: 'connection-1',
      canMessage: {
        enabled: false,
        allowed: true,
      },
    });

    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
    expect(screen.queryByText(/^message$/i)).toBeNull();
  });

  test('shows message link for connected profiles when messaging is enabled', () => {
    renderActions({
      userId: 'user-5',
      fullName: 'Priya Nair',
      isSelf: false,
      canConnect: false,
      connectionStatus: 'ACCEPTED',
      connectionId: 'connection-2',
      canMessage: {
        enabled: true,
        allowed: true,
      },
    });

    expect(screen.getByTestId('network-message-user-5')).toHaveAttribute('href', '/candidate/messages?user=user-5');
    expect(screen.getByTestId('network-message-user-5')).toHaveAccessibleName('Message Priya Nair');
  });

  test('multiple profiles expose unique block actions per user id', () => {
    render(
      <div>
        <NetworkProfileActions
          profile={{
            userId: 'user-a',
            fullName: 'Candidate Alpha',
            isSelf: false,
            canConnect: true,
            connectionStatus: 'NONE',
          }}
          redirectTo="/candidate/network"
          source="PROFILE"
          messageHref="/candidate/messages?user=user-a"
        />
        <NetworkProfileActions
          profile={{
            userId: 'user-b',
            fullName: 'Candidate Beta',
            isSelf: false,
            canConnect: true,
            connectionStatus: 'NONE',
          }}
          redirectTo="/candidate/network"
          source="PROFILE"
          messageHref="/candidate/messages?user=user-b"
        />
      </div>,
    );

    expect(screen.getByTestId('network-block-user-a')).toHaveAccessibleName('Block Candidate Alpha');
    expect(screen.getByTestId('network-block-user-b')).toHaveAccessibleName('Block Candidate Beta');
  });
});
