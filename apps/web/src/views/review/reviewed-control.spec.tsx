// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkAllReviewed, ReviewedControl } from './reviewed-control';

const mocks = vi.hoisted(() => ({
  markSubmit: vi.fn(),
  unmarkSubmit: vi.fn(),
}));

vi.mock('../../query/review', () => ({
  reviewErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'mutation failed',
  useMarkAllReviewed: () => useMockMutation(mocks.markSubmit),
  useMarkReviewed: () => useMockMutation(mocks.markSubmit),
  useUnmarkReviewed: () => useMockMutation(mocks.unmarkSubmit),
}));

function useMockMutation(submitMock: typeof mocks.markSubmit) {
  const [error, setError] = useState<unknown>(null);
  const [isPending, setPending] = useState(false);
  return {
    submit: async (input: unknown) => {
      setPending(true);
      try {
        return await submitMock(input);
      } catch (reason) {
        setError(reason);
        throw reason;
      } finally {
        setPending(false);
      }
    },
    isPending,
    isSuccess: false,
    error,
    reset: vi.fn(),
  };
}

const scope = {
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
};

const controlProps = {
  scope,
  path: 'README.md',
  fingerprint: 'a'.repeat(64),
  compact: false,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ReviewedControl', () => {
  it('contains a rejected mark mutation and shows its error', async () => {
    mocks.markSubmit.mockRejectedValueOnce(new Error('mark failed'));
    const user = userEvent.setup();

    render(<ReviewedControl {...controlProps} status="unreviewed" />);
    await user.click(
      screen.getByRole('button', { name: 'Mark README.md as reviewed' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('mark failed'),
    );
    expect(mocks.markSubmit).toHaveBeenCalledWith({
      path: 'README.md',
      fingerprint: 'a'.repeat(64),
    });
  });

  it('contains a rejected unmark mutation and shows its error', async () => {
    mocks.unmarkSubmit.mockRejectedValueOnce(new Error('unmark failed'));
    const user = userEvent.setup();

    render(<ReviewedControl {...controlProps} status="reviewed" />);
    await user.click(
      screen.getByRole('button', { name: 'Unmark README.md as unreviewed' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('unmark failed'),
    );
    expect(mocks.unmarkSubmit).toHaveBeenCalledWith('README.md');
  });
});

it('does not claim the whole review is complete when a file cannot be reviewed', () => {
  render(
    <MarkAllReviewed
      scope={scope}
      entries={[
        {
          path: 'a.ts',
          fingerprint: 'a'.repeat(64),
          reviewStatus: 'reviewed',
          comparisons: [],
          ...scope,
          environmentId: 'environment',
          statusToken: 'b'.repeat(64),
          consistency: 'best-effort',
        },
        {
          path: 'image.png',
          fingerprint: null,
          reviewStatus: 'unreviewed',
          comparisons: [],
          ...scope,
          environmentId: 'environment',
          statusToken: 'b'.repeat(64),
          consistency: 'best-effort',
        },
      ]}
    />,
  );
  expect(
    screen.getByRole('button', { name: '1 reviewed · 1 unavailable' }),
  ).toBeTruthy();
  expect(screen.queryByText('All reviewed')).toBeNull();
});
