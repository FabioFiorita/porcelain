import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { CommentThread } from '../../domain/comments';
import { type DocumentRef, entryKey } from '../../domain/documents';
import type { Status } from '../../domain/review';
import { ReviewIndex } from './review-index';

const commentState = vi.hoisted(() => ({
  threads: [] as CommentThread[],
  seen: vi.fn(),
}));

const status: Status = {
  environmentId: '641a8628-1cd6-4562-81a2-9c05fba76b4a',
  worktreeId: '629a86281cd6456281a29c05fba76b4b',
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

vi.mock('../../query/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/review')>()),
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
  usePrefetchReview: () => {},
  useReviewEvidence: () => [],
  useMarkAllReviewed: () => ({
    submit: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
  }),
}));
vi.mock('../../query/comments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/comments')>()),
  useComments: () => ({ threads: commentState.threads, error: null }),
  usePrefetchComments: () => {},
  useMarkCommentsSeen: () => ({ mutate: commentState.seen }),
  useReplyComment: () => ({
    submit: vi.fn(),
    isPending: false,
    error: null,
  }),
  useResolveComment: () => ({
    submit: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

afterEach(() => {
  commentState.threads = [];
});

describe('review index', () => {
  it('keeps staged and unstaged evidence in one compact file row', async () => {
    const onOpen = vi.fn<(ref: DocumentRef) => void>();

    const screen = await render(
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
    expect((await row.element()).getAttribute('title')).toBe(
      'src/components/review-panel.tsx',
    );
    expect(
      (await row.element()).querySelector('[data-icon-token="react"]'),
    ).toBeTruthy();
    await expect
      .element(screen.getByText('staged + unstaged'))
      .not.toBeInTheDocument();

    await row.click();
    expect(onOpen).toHaveBeenCalledWith({
      kind: 'change',
      path: 'src/components/review-panel.tsx',
    });
  });

  it('keeps the selected change row on the review surface accent only', async () => {
    const screen = await render(
      <ReviewIndex
        scope={{
          projectId: '621a8628-1cd6-4562-81a2-9c05fba76b4c',
          worktreeId: status.worktreeId,
        }}
        activeEntry={entryKey({
          kind: 'change',
          path: 'src/components/review-panel.tsx',
        })}
        onOpen={vi.fn()}
      />,
    );

    const row = screen.getByRole('button', {
      name: 'review-panel.tsx · staged + unstaged',
    });
    expect((await row.element()).className).toContain('bg-accent');
    expect((await row.element()).className).not.toContain('workspace-choice');
  });

  it('keeps layer order and compact file counts visible', async () => {
    const screen = await render(
      <ReviewIndex
        scope={{
          projectId: '621a8628-1cd6-4562-81a2-9c05fba76b4c',
          worktreeId: status.worktreeId,
        }}
        activeEntry={undefined}
        onOpen={vi.fn()}
      />,
    );

    await expect
      .element(
        screen.getByRole('button', { name: /A clearer review experience/ }),
      )
      .toBeVisible();
    await expect.element(screen.getByText('2')).toBeVisible();
    await expect.element(screen.getByText(/The whole handoff/)).toBeVisible();
  });

  it('acknowledges the discussion only once every thread has been shown', async () => {
    commentState.threads = [
      {
        // Unread, and hidden behind the resolved filter.
        id: '00000000-0000-4000-8000-000000000005',
        worktreeId: status.worktreeId,
        anchor: { kind: 'file', filePath: 'src/components/empty-state.tsx' },
        resolved: true,
        messages: [
          {
            id: '00000000-0000-4000-8000-000000000006',
            body: 'Renamed it as you asked.',
            author: 'agent',
            createdAt: '2026-09-12T11:00:00Z',
          },
        ],
        revision: 7,
      },
      {
        id: '00000000-0000-4000-8000-000000000007',
        worktreeId: status.worktreeId,
        anchor: { kind: 'file', filePath: 'src/components/review-panel.tsx' },
        resolved: false,
        messages: [
          {
            id: '00000000-0000-4000-8000-000000000008',
            body: 'Still thinking about this one.',
            author: 'reviewer',
            createdAt: '2026-09-12T12:00:00Z',
          },
        ],
        revision: 10,
      },
    ];
    commentState.seen.mockClear();
    const screen = await render(
      <ReviewIndex
        scope={{
          projectId: '621a8628-1cd6-4562-81a2-9c05fba76b4c',
          worktreeId: status.worktreeId,
        }}
        activeEntry={undefined}
        onOpen={vi.fn()}
      />,
    );
    // Rendering the surface fetches the discussion; that is not reading it.
    expect(commentState.seen).not.toHaveBeenCalled();
    await screen.getByRole('tab', { name: /Comments/ }).click();
    await expect
      .element(screen.getByText('Still thinking about this one.'))
      .toBeVisible();
    // The open list is on screen, but the unread reply is in the resolved one.
    // One marker per worktree cannot say "this newer thread, not that older
    // one", so nothing is acknowledged yet.
    expect(commentState.seen).not.toHaveBeenCalled();
    await screen.getByRole('button', { name: 'resolved 1' }).click();
    await expect
      .element(screen.getByText('Renamed it as you asked.'))
      .toBeVisible();
    await expect.poll(() => commentState.seen.mock.calls).toEqual([[10]]);
  });

  it('filters comment threads and routes an anchor to its current document', async () => {
    commentState.threads = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        worktreeId: status.worktreeId,
        anchor: {
          kind: 'codeRange',
          filePath: 'src/components/review-panel.tsx',
          startLine: 4,
          endLine: 5,
          side: 'additions',
        },
        resolved: false,
        messages: [
          {
            id: '00000000-0000-4000-8000-000000000002',
            body: 'Please check this branch.',
            author: 'reviewer',
            createdAt: '2026-09-12T10:00:00Z',
          },
        ],
        revision: 1,
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        worktreeId: status.worktreeId,
        anchor: { kind: 'file', filePath: 'src/components/empty-state.tsx' },
        resolved: true,
        messages: [
          {
            id: '00000000-0000-4000-8000-000000000004',
            body: 'Looks good now.',
            author: 'agent',
            createdAt: '2026-09-12T11:00:00Z',
          },
        ],
        revision: 1,
      },
    ];
    const onOpen = vi.fn<(ref: DocumentRef) => void>();

    const screen = await render(
      <ReviewIndex
        scope={{
          projectId: '621a8628-1cd6-4562-81a2-9c05fba76b4c',
          worktreeId: status.worktreeId,
        }}
        activeEntry={undefined}
        onOpen={onOpen}
      />,
    );

    await screen.getByRole('tab', { name: /Comments/ }).click();
    await expect
      .element(screen.getByRole('button', { name: 'open 1' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'resolved 1' }))
      .toBeVisible();
    await expect
      .element(screen.getByText('Please check this branch.'))
      .toBeVisible();
    expect(document.querySelector('[data-slot="bubble"]')).toBeTruthy();

    await screen.getByTitle('Show in the code').click();
    expect(onOpen).toHaveBeenCalledWith(
      {
        kind: 'change',
        path: 'src/components/review-panel.tsx',
      },
      commentState.threads[0]?.anchor,
    );

    await screen.getByRole('button', { name: 'resolved 1' }).click();
    await expect.element(screen.getByText('Looks good now.')).toBeVisible();
  });
});
