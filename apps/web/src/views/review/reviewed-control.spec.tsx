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
  worktreeId: '629a86281cd6456281a29c05fba76b4b',
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
  /**
   * A file whose current state could not be established has no fingerprint,
   * so there is nothing a mark could be about. Saying so is the whole of what
   * this control can offer, and it must say it in the reader's terms rather
   * than by naming an internal one.
   */
  it('explains that a file with no fingerprint cannot be marked', async () => {
    const screen = await render(
      <ReviewedControl
        {...controlProps}
        fingerprint={null}
        status="unreviewed"
      />,
    );
    await expect.element(screen.getByText('Not reviewable')).toBeVisible();
    await expect
      .element(screen.getByTitle(/^README\.md cannot be marked as reviewed/))
      .toHaveAttribute(
        'title',
        'README.md cannot be marked as reviewed because its current state could not be established',
      );
    expect(screen.container.querySelector('button[aria-pressed]')).toBeNull();
  });

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
        },
        {
          path: 'image.png',
          fingerprint: null,
          reviewStatus: 'unreviewed',
          comparisons: [],
          ...scope,
          environmentId: 'environment',
          statusToken: 'b'.repeat(64),
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

it('announces a changed file to assistive technology when reviewing again', async () => {
  const screen = await render(
    <ReviewedControl {...controlProps} status="stale" />,
  );
  await expect
    .element(
      screen.getByRole('button', {
        name: 'Mark changed README.md as reviewed',
      }),
    )
    .toHaveTextContent('Review again');
});
