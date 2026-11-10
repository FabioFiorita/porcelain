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

describe('noticeSurfaces for the walkthrough', () => {
  it('refreshes the walkthrough when its run changed', () => {
    expect(
      noticeSurfaces({
        type: 'walkthrough',
        change: 'run',
        projectId,
        worktreeId,
      }),
    ).toEqual({ scope, surfaces: new Set(['walkthrough']) });
  });

  it('rechecks whether the walkthrough is out of date when the branch moved', () => {
    expect(
      noticeSurfaces({
        type: 'worktree',
        projectId,
        worktreeId,
        change: 'git',
      })?.surfaces,
    ).toContain('walkthrough');
  });
});

describe('receiptSurfaces', () => {
  it('refreshes the published review, its layer marks and the walkthrough after a commit', () => {
    expect(
      receiptSurfaces({ action: 'commit', projectId, worktreeId }),
    ).toEqual({
      scope,
      surfaces: new Set(['review', 'reviewed-layers', 'walkthrough']),
    });
  });
});
