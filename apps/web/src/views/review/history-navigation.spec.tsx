// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHistory } from '../../query/history';
import { HistoryNavigation } from './history-navigation';

vi.mock('../../query/history', () => ({ useHistory: vi.fn() }));
vi.mock('./review-boundary', () => ({
  ReviewBoundary: ({ children }: { children: ReactNode }) => children,
}));

const oid = (value: string) => value.repeat(40);
const commits = [
  {
    oid: oid('a'),
    parentOids: [oid('b'), oid('c')],
    author: {
      name: 'Alex Morgan',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    subject: 'Merge review branch',
    subjectTruncated: false,
  },
  {
    oid: oid('b'),
    parentOids: [oid('d')],
    author: {
      name: 'Fabio Fiorita',
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    subject: 'Add review navigation',
    subjectTruncated: false,
  },
];
const [tipCommit] = commits;
if (tipCommit == null) throw new Error('Missing history fixture commit');

const baseHistory = (overrides: Partial<ReturnType<typeof useHistory>> = {}) =>
  ({
    snapshot: {
      tipOid: tipCommit.oid,
      head: { kind: 'attached', ref: 'refs/heads/feature/review' },
    },
    commits,
    nextCursor: null,
    boundary: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as ReturnType<typeof useHistory>;

const scope = {
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
};

beforeEach(() => {
  vi.mocked(useHistory).mockReturnValue(baseHistory());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HistoryNavigation', () => {
  it('shows the branch, graph nodes, relative author time and selected commit', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <HistoryNavigation
        scope={scope}
        selected={tipCommit.oid}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText('feature/review')).toBeTruthy();
    const selected = screen.getByRole('button', {
      name: /Merge review branch/,
    });
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(selected.textContent).toContain('Alex Morgan');
    expect(selected.textContent).toMatch(/ago/);
    expect(
      container
        .querySelector('[data-testid="history-graph"]')
        ?.querySelectorAll('circle'),
    ).toHaveLength(commits.length);
    expect(screen.queryByText('refs/heads/feature/review')).toBeNull();

    await user.click(selected);
    expect(onSelect).toHaveBeenCalledWith(tipCommit.oid);
  });

  it('keeps loaded rows visible and exposes an explicit retry for an older page', async () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useHistory).mockReturnValue(
      baseHistory({
        hasNextPage: true,
        nextCursor: 'opaque-cursor',
        isFetchNextPageError: true,
        fetchNextPage,
      }),
    );
    const user = userEvent.setup();
    render(<HistoryNavigation scope={scope} selected="" onSelect={vi.fn()} />);

    expect(screen.getByText('Merge review branch')).toBeTruthy();
    expect(screen.getByText("Couldn't load older commits")).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('keeps shallow-history messaging at the end of the loaded list', () => {
    vi.mocked(useHistory).mockReturnValue(baseHistory({ boundary: 'shallow' }));
    render(<HistoryNavigation scope={scope} selected="" onSelect={vi.fn()} />);
    expect(
      screen.getByText('Shallow clone: older history is not available.'),
    ).toBeTruthy();
  });
});
