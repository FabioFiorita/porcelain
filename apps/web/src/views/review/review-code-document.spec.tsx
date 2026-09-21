import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { Change, ReviewChangeItem } from '../../domain/review';
import { ReviewCodeDocument } from './review-code-document';

const change: Extract<Change, { kind: string }> = {
  scope: 'staged',
  kind: 'modified',
  oldPath: 'README.md',
  newPath: 'README.md',
  oldMode: '100644',
  newMode: '100644',
  oldOid: null,
  newOid: null,
  supported: true,
};

const changes: ReviewChangeItem[] = [
  {
    path: 'README.md',
    fingerprint: null,
    comparisons: [change],
    environmentId: '641a8628-1cd6-4562-81a2-9c05fba76b4a',
    worktreeId: '629a86281cd6456281a29c05fba76b4b',
    statusToken: 'a'.repeat(64),
    reviewStatus: 'unreviewed',
  },
];

/** What the lazy reads answer, so a test can put a document in one state. */
const reads = {
  diffs: new Map<string, { kind: 'text'; patch: string }>([
    ['staged\nREADME.md\nREADME.md', { kind: 'text', patch: '' }],
  ]),
  untracked: new Map<string, string>(),
  pending: false,
  failed: false,
  retried: 0,
};

vi.mock('../../query/comments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/comments')>()),
  useComments: () => ({ threads: [] }),
}));
vi.mock('../../query/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/review')>()),
  useReviewChanges: () => changes,
  useChangeDiffs: () => ({
    diffs: reads.diffs,
    pending: reads.pending,
    failed: reads.failed,
    retry: () => {
      reads.retried += 1;
    },
  }),
  useUntrackedContents: () => ({
    contents: reads.untracked,
    pending: reads.pending,
    failed: false,
    retry: () => {
      reads.retried += 1;
    },
  }),
  useMarkReviewed: () => ({
    submit: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
  }),
  useUnmarkReviewed: () => ({
    submit: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
  }),
}));
vi.mock('./code-document', () => ({
  CodeDocument: ({
    header,
    entries,
  }: {
    header?: () => React.ReactNode;
    entries: { id: string; note?: string }[];
  }) => (
    <div>
      {header?.()}
      {entries.map((entry) => (
        <span key={entry.id}>{entry.note}</span>
      ))}
    </div>
  ),
}));

const scope = {
  projectId: '621a8628-1cd6-4562-81a2-9c05fba76b4c',
  worktreeId: '629a86281cd6456281a29c05fba76b4b',
};

describe('continuous review document', () => {
  it('explains a change that cannot be rendered as one file', async () => {
    const screen = await render(<ReviewCodeDocument scope={scope} />);

    await expect.element(screen.getByText('README.md')).toBeVisible();
    await expect
      .element(screen.getByText('No single-file textual patch'))
      .toBeVisible();
  });

  /**
   * The hunks arrive after the list of files does. A document that paints as
   * empty while they are on the way, or silently after they failed, tells the
   * reader nothing changed — which is the one thing it must never say wrongly.
   */
  it('says it is still reading, and offers a retry when the read failed', async () => {
    reads.pending = true;
    try {
      const loading = await render(<ReviewCodeDocument scope={scope} />);
      await expect.element(loading.getByText('Loading changes…')).toBeVisible();
    } finally {
      reads.pending = false;
    }

    reads.failed = true;
    try {
      const failed = await render(<ReviewCodeDocument scope={scope} />);
      await expect
        .element(
          failed.getByText('The changes in this document could not be read.'),
        )
        .toBeVisible();
      const before = reads.retried;
      await failed
        .getByRole('button', { name: 'Load the changes again' })
        .click();
      expect(reads.retried).toBeGreaterThan(before);
    } finally {
      reads.failed = false;
    }
  });

  it('shows the agent note on an untracked file, not only on Git patches', async () => {
    const original = changes[0];
    if (!original) throw new Error('Missing fixture');
    changes[0] = {
      ...original,
      comparisons: [{ scope: 'untracked', path: 'README.md' }],
    };
    reads.untracked.set('README.md', 'New documentation');
    try {
      const screen = await render(
        <ReviewCodeDocument
          scope={scope}
          files={[{ path: 'README.md', note: 'Read this first.' }]}
        />,
      );
      await expect.element(screen.getByText('Read this first.')).toBeVisible();
    } finally {
      changes[0] = original;
      reads.untracked.clear();
    }
  });
});
