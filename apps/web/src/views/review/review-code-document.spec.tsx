// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
    statusToken: 'a'.repeat(64),
    consistency: 'best-effort',
    reviewStatus: 'unreviewed',
  },
];

vi.mock('../../query/review', () => ({
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

afterEach(cleanup);

describe('continuous review document', () => {
  it('explains diff evidence that cannot be rendered as one file', () => {
    render(
      <ReviewCodeDocument
        scope={{
          projectId: '621a8628-1cd6-4562-81a2-9c05fba76b4c',
          worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
        }}
      />,
    );

    expect(screen.getByText('README.md')).toBeTruthy();
    expect(screen.getByText('No single-file textual patch')).toBeTruthy();
  });
});

it('shows the agent note on an untracked file, not only on Git patches', () => {
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
    render(
      <ReviewCodeDocument
        scope={{ projectId: 'project', worktreeId: 'worktree' }}
        files={[
          { path: 'README.md', scope: 'unstaged', note: 'Read this first.' },
        ]}
      />,
    );
    expect(screen.getByText('Read this first.')).toBeTruthy();
  } finally {
    evidence[0] = original;
  }
});
