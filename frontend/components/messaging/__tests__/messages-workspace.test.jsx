import { fireEvent, render, screen } from '@testing-library/react';
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MessagesWorkspace } from '@/components/messaging/messages-workspace';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [], meta: { nextCursor: null } }),
  });
});

function buildProps(overrides = {}) {
  return {
    initialConversations: [
      {
        id: 'conversation-1',
        participant: {
          fullName: 'Anita Sharma',
          profilePhoto: null,
          profilePath: '/network/people/recruiter-user-1',
          designation: 'Senior Talent Acquisition Manager',
          company: 'Acme Labs',
        },
        unreadCount: 1,
        lastMessagePreview: 'Hi there',
        lastMessageAt: '2026-08-12T12:00:00.000Z',
        createdAt: '2026-08-12T12:00:00.000Z',
      },
    ],
    initialConversation: {
      id: 'conversation-1',
      participant: {
        fullName: 'Anita Sharma',
        profilePhoto: null,
        profilePath: '/network/people/recruiter-user-1',
        designation: 'Senior Talent Acquisition Manager',
        company: 'Acme Labs',
      },
      unreadCount: 1,
      canSend: true,
    },
    initialMessages: [
      {
        id: 'message-1',
        isOwn: false,
        content: 'Hello',
        attachment: null,
        createdAt: '2026-08-12T12:00:00.000Z',
      },
    ],
    initialMessagesMeta: { nextCursor: null },
    activeConversationId: 'conversation-1',
    basePath: '/candidate/messages',
    ...overrides,
  };
}

describe('MessagesWorkspace', () => {
  test('renders conversation list and active message thread', () => {
    render(<MessagesWorkspace {...buildProps()} />);

    expect(screen.getAllByText('Anita Sharma').length).toBeGreaterThan(0);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  test('disables composer when the conversation cannot send', () => {
    render(<MessagesWorkspace {...buildProps({
      initialConversation: {
        id: 'conversation-1',
        participant: buildProps().initialConversation.participant,
        canSend: false,
      },
    })} />);

    expect(screen.getByText(/messaging is currently unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
  });

  test('enables send when content is entered', () => {
    render(<MessagesWorkspace {...buildProps()} />);
    const composer = screen.getByLabelText(/message composer/i);
    fireEvent.change(composer, { target: { value: 'Professional hello' } });

    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  test('enables send when a permitted attachment is selected', () => {
    const { container } = render(<MessagesWorkspace {...buildProps()} />);

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File([buildProps().initialMessages[0].content], 'intro.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('intro.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  test('shows an error when attachment upload/send fails', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ success: false, message: 'Unsupported attachment type.' }),
      });

    const { container } = render(<MessagesWorkspace {...buildProps()} />);

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['bad'], 'malware.exe', { type: 'application/x-msdownload' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText(/unsupported attachment type/i)).toBeInTheDocument();
  });

  test('clears the unread badge after the active conversation is marked as read', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { conversationId: 'conversation-1', readAt: '2026-08-12T12:00:00.000Z' } }),
    });

    render(<MessagesWorkspace {...buildProps()} />);

    expect(screen.getByLabelText('1 unread messages')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/messages/conversations/conversation-1/read',
      expect.objectContaining({ method: 'POST' }),
    ));
    await waitFor(() => expect(screen.queryByLabelText('1 unread messages')).toBeNull());
  });
});
