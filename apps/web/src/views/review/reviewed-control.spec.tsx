import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
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
  vi.clearAllMocks();
});

describe('ReviewedControl', () => {
  it('contains a rejected mark mutation and shows its error', async () => {
    mocks.markSubmit.mockRejectedValueOnce(new Error('mark failed'));

    const screen = await render(
      <ReviewedControl {...controlProps} status="unreviewed" />,
    );
    await screen
      .getByRole('button', { name: 'Mark README.md as reviewed' })
      .click();

    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('mark failed');
    expect(mocks.markSubmit).toHaveBeenCalledWith({
      path: 'README.md',
      fingerprint: 'a'.repeat(64),
    });
  });

  it('contains a rejected unmark mutation and shows its error', async () => {
    mocks.unmarkSubmit.mockRejectedValueOnce(new Error('unmark failed'));

    const screen = await render(
      <ReviewedControl {...controlProps} status="reviewed" />,
    );
    await screen
      .getByRole('button', { name: 'Unmark README.md as unreviewed' })
      .click();

    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('unmark failed');
    expect(mocks.unmarkSubmit).toHaveBeenCalledWith('README.md');
  });
});

it('does not claim the whole review is complete when a file cannot be reviewed', async () => {
  const screen = await render(
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
  await expect
    .element(screen.getByRole('button', { name: 'Unmark all' }))
    .toBeVisible();
  await screen.getByRole('button', { name: 'Unmark all' }).click();
  await vi.waitFor(() =>
    expect(mocks.unmarkSubmit).toHaveBeenCalledWith('a.ts'),
  );
  expect(mocks.unmarkSubmit).not.toHaveBeenCalledWith('image.png');
  await expect
    .element(screen.getByText('All reviewed'))
    .not.toBeInTheDocument();
});

it('labels a stale file Review again', async () => {
  const screen = await render(
    <ReviewedControl {...controlProps} status="stale" />,
  );
  await expect
    .element(screen.getByRole('button', { name: 'Mark README.md as reviewed' }))
    .toHaveTextContent('Review again');
});
