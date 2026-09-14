// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentRef } from '../../domain/documents';
import type { Status } from '../../domain/review';
import { ReviewIndex } from './review-index';

const status: Status = {
  environmentId: '641a8628-1cd6-4562-81a2-9c05fba76b4a',
  worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
  statusToken: 'a'.repeat(64),
  consistency: 'best-effort',
  headOid: 'a'.repeat(40),
  changes: [
    {
      scope: 'staged',
      kind: 'modified',
      oldPath: 'src/components/review-panel.tsx',
      newPath: 'src/components/review-panel.tsx',
      oldMode: '100644',
      newMode: '100644',
      supported: true,
    },
    {
      scope: 'unstaged',
      kind: 'modified',
      oldPath: 'src/components/review-panel.tsx',
      newPath: 'src/components/review-panel.tsx',
      oldMode: '100644',
      newMode: '100644',
      supported: true,
    },
    {
      scope: 'unstaged',
      kind: 'added',
      oldPath: null,
      newPath: 'src/components/empty-state.tsx',
      oldMode: '100644',
      newMode: '100644',
      supported: true,
    },
  ],
};

vi.mock('../../query/review', () => ({
  useChanges: () => ({
    status,
    layers: {
      worktreeId: status.worktreeId,
      revision: 1,
      layers: [
        {
          id: 'bf4f1c6b-2b54-423b-a9b5-7c40112b3101',
          title: 'A clearer review experience',
          files: [
            {
              path: 'src/components/review-panel.tsx',
              scope: 'staged',
            },
            {
              path: 'src/components/empty-state.tsx',
              scope: 'unstaged',
            },
          ],
        },
      ],
    },
  }),
  useArtifacts: () => [],
  useReviewEvidence: () => [],
  useMarkAllReviewed: () => ({
    submit: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
  }),
}));

afterEach(cleanup);

describe('review index', () => {
  it('keeps staged and unstaged evidence in one compact file row', async () => {
    const onOpen = vi.fn<(ref: DocumentRef) => void>();
    const user = userEvent.setup();

    render(
      <ReviewIndex
        scope={{
          projectId: '621a8628-1cd6-4562-81a2-9c05fba76b4c',
          worktreeId: status.worktreeId,
        }}
        activeEntry={undefined}
        onOpen={onOpen}
      />,
    );

    const row = screen.getByRole('button', {
      name: 'review-panel.tsx · staged + unstaged',
    });
    expect(row.getAttribute('title')).toBe('src/components/review-panel.tsx');
    expect(row.querySelector('[data-icon-token="react"]')).toBeTruthy();
    expect(screen.queryByText('staged + unstaged')).toBeNull();

    await user.click(row);
    expect(onOpen).toHaveBeenCalledWith({
      kind: 'change',
      path: 'src/components/review-panel.tsx',
    });
  });

  it('keeps layer order and compact file counts visible', () => {
    render(
      <ReviewIndex
        scope={{
          projectId: '621a8628-1cd6-4562-81a2-9c05fba76b4c',
          worktreeId: status.worktreeId,
        }}
        activeEntry={undefined}
        onOpen={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /A clearer review experience/ }),
    ).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('The whole handoff')).toBeTruthy();
  });
});
