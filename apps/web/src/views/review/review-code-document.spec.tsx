import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { Change, ReviewEvidenceItem } from '../../domain/review';
import { ReviewCodeDocument } from './review-code-document';

const change: Extract<Change, { kind: string }> = {
  scope: 'staged',
  kind: 'modified',
  oldPath: 'README.md',
  newPath: 'README.md',
  oldMode: '100644',
  newMode: '100644',
  supported: true,
};

const evidence: ReviewEvidenceItem[] = [
  {
    path: 'README.md',
    fingerprint: null,
    comparisons: [
      {
        change,
        content: {
          kind: 'diff',
          content: { kind: 'text', patch: '' },
        },
      },
    ],
    environmentId: '641a8628-1cd6-4562-81a2-9c05fba76b4a',
    worktreeId: '629a86281cd6456281a29c05fba76b4b',
    statusToken: 'a'.repeat(64),
    consistency: 'best-effort',
    reviewStatus: 'unreviewed',
  },
];

vi.mock('../../query/comments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/comments')>()),
  useComments: () => ({ threads: [] }),
}));
vi.mock('../../query/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/review')>()),
  useReviewEvidence: () => evidence,
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

describe('continuous review document', () => {
  it('explains diff evidence that cannot be rendered as one file', async () => {
    const screen = await render(
      <ReviewCodeDocument
        scope={{
          projectId: '621a8628-1cd6-4562-81a2-9c05fba76b4c',
          worktreeId: '629a86281cd6456281a29c05fba76b4b',
        }}
      />,
    );

    await expect.element(screen.getByText('README.md')).toBeVisible();
    await expect
      .element(screen.getByText('No single-file textual patch'))
      .toBeVisible();
  });
});

it('shows the agent note on an untracked file, not only on Git patches', async () => {
  const original = evidence[0];
  if (!original) throw new Error('Missing fixture');
  evidence[0] = {
    ...original,
    comparisons: [
      {
        change: { scope: 'untracked', path: 'README.md' },
        content: {
          kind: 'file',
          text: 'New documentation',
          encoding: 'utf-8',
          byteLength: 17,
        },
      },
    ],
  };
  try {
    const screen = await render(
      <ReviewCodeDocument
        scope={{ projectId: 'project', worktreeId: 'worktree' }}
        files={[
          { path: 'README.md', scope: 'unstaged', note: 'Read this first.' },
        ]}
      />,
    );
    await expect.element(screen.getByText('Read this first.')).toBeVisible();
  } finally {
    evidence[0] = original;
  }
});
