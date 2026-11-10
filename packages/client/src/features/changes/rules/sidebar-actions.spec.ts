import { describe, expect, it } from 'vitest';
import { reviewSidebarActions } from './sidebar-actions.ts';

describe('review sidebar actions', () => {
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
  it('offers expansion only on groups and opening only on document sections', () => {
    expect(reviewSidebarActions({ kind: 'group' })).toEqual([
      { id: 'expand-all', label: 'Expand all' },
      { id: 'collapse-all', label: 'Collapse all' },
    ]);
    expect(reviewSidebarActions({ kind: 'section' })).toEqual([
      { id: 'open', label: 'Open' },
    ]);
  });
});
