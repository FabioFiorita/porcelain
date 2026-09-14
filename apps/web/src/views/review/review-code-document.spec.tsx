// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Change, ReviewEvidence, Status } from '../../domain/review';
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

const evidence: ReviewEvidence[] = [
  {
    kind: 'diff',
    change,
    response: {
      environmentId: '641a8628-1cd6-4562-81a2-9c05fba76b4a',
      worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
      statusToken: 'a'.repeat(64),
      consistency: 'best-effort',
      change: {
        scope: change.scope,
        oldPath: change.oldPath,
        newPath: change.newPath,
      },
      oldMode: change.oldMode,
      newMode: change.newMode,
      content: { kind: 'text', patch: '' },
    },
  },
];

vi.mock('../../query/review', () => ({
  useReviewEvidence: () => evidence,
}));
vi.mock('./code-document', () => ({
  CodeDocument: ({ header }: { header?: () => React.ReactNode }) => (
    <div>{header?.()}</div>
  ),
}));

afterEach(cleanup);

describe('continuous review document', () => {
  it('explains diff evidence that cannot be rendered as one file', () => {
    const status = {
      statusToken: 'a'.repeat(64),
      changes: [change],
    } as Status;

    render(
      <ReviewCodeDocument
        scope={{
          projectId: '621a8628-1cd6-4562-81a2-9c05fba76b4c',
          worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
        }}
        status={status}
      />,
    );

    expect(screen.getByText('README.md')).toBeTruthy();
    expect(screen.getByText('No single-file textual patch')).toBeTruthy();
  });
});
