import { describe, expect, it } from 'vitest';
import { noticeSurfaces, receiptSurfaces } from './live-surfaces.ts';

const projectId = '11111111-1111-4111-8111-111111111111';
const worktreeId = 'w'.repeat(32);
const scope = { projectId, worktreeId };

describe('noticeSurfaces', () => {
  it('refreshes the reviewed files and layers when another writer marks a file reviewed', () => {
    expect(
      noticeSurfaces({
        type: 'worktree',
        projectId,
        worktreeId,
        change: 'reviewed',
      }),
    ).toEqual({ scope, surfaces: new Set(['reviewed', 'reviewed-layers']) });
  });

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

  it('refreshes the published review and its layer marks when the review was republished', () => {
    expect(
      noticeSurfaces({
        type: 'worktree',
        projectId,
        worktreeId,
        change: 'review',
      }),
    ).toEqual({ scope, surfaces: new Set(['review', 'reviewed-layers']) });
  });

  it('refreshes the published review and its layer marks when files changed on disk', () => {
    expect(
      noticeSurfaces({
        type: 'worktree',
        projectId,
        worktreeId,
        change: 'files',
      }),
    ).toEqual({ scope, surfaces: new Set(['review', 'reviewed-layers']) });
  });

  it('refreshes the published review and its layer marks when Git state changed', () => {
    expect(
      noticeSurfaces({
        type: 'worktree',
        projectId,
        worktreeId,
        change: 'git',
      }),
    ).toEqual({ scope, surfaces: new Set(['review', 'reviewed-layers']) });
  });

  it('leaves review data alone for a project notice', () => {
    expect(
      noticeSurfaces({ type: 'project', projectId, change: 'preferences' }),
    ).toBe(null);
  });

  it('leaves review data alone for an inventory notice', () => {
    expect(noticeSurfaces({ type: 'inventory' })).toBe(null);
  });
});

describe('receiptSurfaces', () => {
  it('refreshes the published review and its layer marks after a commit', () => {
    expect(
      receiptSurfaces({ action: 'commit', projectId, worktreeId }),
    ).toEqual({ scope, surfaces: new Set(['review', 'reviewed-layers']) });
  });

  it('leaves review data alone after a fetch', () => {
    expect(receiptSurfaces({ action: 'fetch', projectId, worktreeId })).toBe(
      null,
    );
  });

  it('leaves review data alone after a push', () => {
    expect(receiptSurfaces({ action: 'push', projectId, worktreeId })).toBe(
      null,
    );
  });
});
