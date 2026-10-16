import { describe, expect, it } from 'vitest';
import { reviewSidebarActions } from './sidebar-actions.ts';

describe('review sidebar actions', () => {
  it('offers only available decision files and blocks a futile repeat', () => {
    const unavailable = {
      path: 'scripts/large-sample.txt',
      fingerprint: undefined,
      reviewStatus: 'unreviewed' as const,
    };
    const target = {
      kind: 'decision' as const,
      reviewed: false,
      stale: false,
      settled: true,
      pending: false,
    };
    expect(
      reviewSidebarActions({
        ...target,
        files: [
          { path: 'readable.ts', fingerprint: 'a', reviewStatus: 'unreviewed' },
          unavailable,
        ],
      }),
    ).toContainEqual({
      id: 'review',
      label: 'Mark available files reviewed',
      disabled: false,
    });
    expect(
      reviewSidebarActions({
        ...target,
        files: [
          { path: 'readable.ts', fingerprint: 'a', reviewStatus: 'reviewed' },
          unavailable,
        ],
      }),
    ).toContainEqual({
      id: 'review',
      label: 'Review unavailable',
      disabled: true,
    });
  });
  it('offers only supported file operations and gates reviewing on the file fingerprint', () => {
    expect(
      reviewSidebarActions({
        kind: 'file',
        status: 'stale',
        canReview: false,
        sideLabel: 'Open in the right pane',
        canDiscard: false,
      }),
    ).toEqual([
      { id: 'review', label: 'Mark as reviewed again', disabled: true },
      { id: 'comment', label: 'Comment' },
      { id: 'open', label: 'Open diff' },
      { id: 'open-to-side', label: 'Open in the right pane' },
      { id: 'open-file', label: 'Open file' },
      { id: 'timeline', label: 'Show timeline' },
      { id: 'copy-relative', label: 'Copy relative path' },
    ]);
    expect(
      reviewSidebarActions({
        kind: 'file',
        status: 'reviewed',
        canReview: true,
        sideLabel: 'Open in the left pane',
        canDiscard: true,
      }),
    ).toContainEqual({
      id: 'review',
      label: 'Unmark as reviewed',
      disabled: false,
    });
    expect(
      reviewSidebarActions({
        kind: 'file',
        status: undefined,
        canReview: true,
        sideLabel: 'Open in the left pane',
        canDiscard: true,
      }),
    ).toContainEqual({ id: 'discard', label: 'Discard', destructive: true });
  });
  it.each([
    {
      title: 'blocks a decision mark while its reads refresh',
      settled: false,
      pending: false,
      disabled: true,
    },
    {
      title: 'blocks a decision mark while a write is pending',
      settled: true,
      pending: true,
      disabled: true,
    },
    {
      title: 'allows a decision mark after its reads and writes settle',
      settled: true,
      pending: false,
      disabled: false,
    },
  ])('$title', ({ settled, pending, disabled }) => {
    expect(
      reviewSidebarActions({
        kind: 'decision',
        files: [],
        reviewed: false,
        stale: true,
        settled,
        pending,
      }),
    ).toEqual([
      { id: 'open', label: 'Open' },
      { id: 'review', label: 'Mark as reviewed again', disabled },
    ]);
  });
  it('blocks unmarking a decision while its reads refresh', () => {
    expect(
      reviewSidebarActions({
        kind: 'decision',
        files: [],
        reviewed: true,
        stale: false,
        settled: false,
        pending: false,
      }),
    ).toContainEqual({
      id: 'review',
      label: 'Unmark as reviewed',
      disabled: true,
    });
  });
  it('offers expansion only on groups and opening only on document sections', () => {
    expect(reviewSidebarActions({ kind: 'group' })).toEqual([
      { id: 'expand-all', label: 'Expand all' },
      { id: 'collapse-all', label: 'Collapse all' },
    ]);
    expect(reviewSidebarActions({ kind: 'section' })).toEqual([
      { id: 'open', label: 'Open' },
    ]);
  });
  it('offers reply and resolve on open threads, reopen on resolved ones, and reveal only with a target', () => {
    expect(
      reviewSidebarActions({
        kind: 'thread',
        resolved: false,
        pending: false,
        canReveal: true,
      }),
    ).toEqual([
      { id: 'reveal', label: 'Show in the code' },
      { id: 'reply', label: 'Reply', disabled: false },
      { id: 'resolution', label: 'Resolve', disabled: false },
    ]);
    expect(
      reviewSidebarActions({
        kind: 'thread',
        resolved: true,
        pending: true,
        canReveal: false,
      }),
    ).toEqual([{ id: 'resolution', label: 'Reopen', disabled: true }]);
  });
});
