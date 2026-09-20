import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
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
    body: null,
    bodyTruncated: false,
    refs: ['refs/heads/feature/review', 'refs/tags/v1.0.0'],
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
    body: null,
    bodyTruncated: false,
    refs: [],
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
    nextAfter: null,
    boundary: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as ReturnType<typeof useHistory>;

const scope = {
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '629a86281cd6456281a29c05fba76b4b',
};

beforeEach(() => {
  vi.mocked(useHistory).mockReturnValue(baseHistory());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('HistoryNavigation', () => {
  it('shows the branch, graph nodes, relative author time and selected commit', async () => {
    const onSelect = vi.fn();
    const screen = await render(
      <HistoryNavigation
        scope={scope}
        selected={tipCommit.oid}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText('feature/review').length).toBe(2);
    const selected = screen.getByRole('button', {
      name: /Merge review branch/,
    });
    expect((await selected.element()).getAttribute('aria-pressed')).toBe(
      'true',
    );
    await expect.element(selected).toMatchTextContent('Alex Morgan');
    await expect.element(selected).toMatchTextContent(/ago/);
    await expect.element(selected).toMatchTextContent('feature/review');
    await expect.element(selected).toMatchTextContent('v1.0.0');
    await expect
      .element(selected)
      .not.toMatchTextContent('refs/heads/feature/review');
    await expect
      .element(screen.getByTitle('refs/heads/feature/review'))
      .toBeVisible();
    expect(
      (await screen.getByTestId('history-graph').element()).querySelectorAll(
        'circle',
      ),
    ).toHaveLength(commits.length);
    await expect
      .element(screen.getByText('refs/heads/feature/review'))
      .not.toBeInTheDocument();

    await selected.click();
    expect(onSelect).toHaveBeenCalledWith(tipCommit.oid);
  });

  it('keeps loaded rows visible and exposes an explicit retry for an older page', async () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useHistory).mockReturnValue(
      baseHistory({
        hasNextPage: true,
        nextAfter: ['b'.repeat(40)],
        isFetchNextPageError: true,
        fetchNextPage,
      }),
    );
    const screen = await render(
      <HistoryNavigation scope={scope} selected="" onSelect={vi.fn()} />,
    );

    await expect.element(screen.getByText('Merge review branch')).toBeVisible();
    await expect
      .element(screen.getByText("Couldn't load older commits"))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Retry' }).click();
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('keeps shallow-history messaging at the end of the loaded list', async () => {
    vi.mocked(useHistory).mockReturnValue(baseHistory({ boundary: 'shallow' }));
    const screen = await render(
      <HistoryNavigation scope={scope} selected="" onSelect={vi.fn()} />,
    );
    await expect
      .element(
        screen.getByText('Shallow clone: older history is not available.'),
      )
      .toBeVisible();
  });
});
