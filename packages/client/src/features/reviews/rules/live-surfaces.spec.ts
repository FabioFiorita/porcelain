import { describe, expect, it } from 'vitest';
import { noticeSurfaces, receiptSurfaces } from './live-surfaces.ts';

const projectId = '11111111-1111-4111-8111-111111111111';
const worktreeId = 'w'.repeat(32);
const scope = { projectId, worktreeId };

describe('noticeSurfaces', () => {
  it('refreshes only the comments when the discussion changed', () => {
    expect(
      noticeSurfaces({
        type: 'worktree',
        projectId,
        worktreeId,
        change: 'comments',
      }),
    ).toEqual({ scope, surfaces: new Set(['comments']) });
  });
});

describe('walkthrough notices', () => {
  it.each(['run', 'conversations'] as const)(
    'refreshes the walkthrough conversations after a %s notice',
    (change) => {
      expect(noticeSurfaces({ type: 'walkthrough', change, ...scope })).toEqual(
        { scope, surfaces: new Set(['walkthrough-conversations']) },
      );
    },
  );
});

describe('receiptSurfaces', () => {
  it('refreshes the published review and its layer marks after a commit', () => {
    expect(
      receiptSurfaces({ action: 'commit', projectId, worktreeId }),
    ).toEqual({ scope, surfaces: new Set(['review', 'reviewed-layers']) });
  });
});
