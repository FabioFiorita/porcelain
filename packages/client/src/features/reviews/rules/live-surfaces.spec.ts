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
  it('rechecks content freshness on file edits without refetching conversations', () => {
    expect(
      noticeSurfaces({ type: 'worktree', change: 'files', ...scope }),
    ).toEqual({
      scope,
      surfaces: new Set(['review', 'reviewed-layers', 'walkthrough']),
    });
  });
  it('refreshes the walkthrough and its conversations when its run changed', () => {
    expect(
      noticeSurfaces({ type: 'walkthrough', change: 'run', ...scope }),
    ).toEqual({
      scope,
      surfaces: new Set(['walkthrough', 'walkthrough-conversations']),
    });
  });

  it('refreshes only the conversations when a comment changed', () => {
    expect(
      noticeSurfaces({
        type: 'walkthrough',
        change: 'conversations',
        ...scope,
      }),
    ).toEqual({ scope, surfaces: new Set(['walkthrough-conversations']) });
  });

  it('rechecks whether the walkthrough is out of date when the branch moved', () => {
    expect(
      noticeSurfaces({
        type: 'worktree',
        projectId,
        worktreeId,
        change: 'git',
      })?.surfaces,
    ).toEqual(
      new Set([
        'review',
        'reviewed-layers',
        'walkthrough',
        'walkthrough-conversations',
      ]),
    );
  });
});

describe('receiptSurfaces', () => {
  it('refreshes the published review, its layer marks and the walkthrough after a commit', () => {
    expect(
      receiptSurfaces({ action: 'commit', projectId, worktreeId }),
    ).toEqual({
      scope,
      surfaces: new Set([
        'review',
        'reviewed-layers',
        'walkthrough',
        'walkthrough-conversations',
      ]),
    });
  });
});
