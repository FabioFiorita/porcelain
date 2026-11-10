import { expect, test } from 'vitest';
import { scheduledRegistry } from '../../../spec/kit/atom-registry';
import {
  phoneReviewComparison,
  reviewListOffset,
  reviewFileScope,
} from './store';

test('returning to Changes restores its comparison, file-list place and selected diff scope', () => {
  const { registry, flush } = scheduledRegistry();
  const workspace = 'computer/project/worktree';
  const comparison = { kind: 'branch', base: 'refs/heads/checkpoint' } as const;
  const owner = JSON.stringify([workspace, comparison]);
  const leaveComparison = registry.mount(phoneReviewComparison(workspace));
  const leaveList = registry.mount(reviewListOffset(owner));
  const leaveScope = registry.mount(reviewFileScope(owner));
  try {
    registry.set(phoneReviewComparison(workspace), comparison);
    registry.set(reviewListOffset(owner), 640);
    registry.set(reviewFileScope(owner), 'unstaged');
    leaveComparison();
    leaveList();
    leaveScope();
    flush();
    expect(registry.get(phoneReviewComparison(workspace))).toEqual(comparison);
    expect(registry.get(reviewListOffset(owner))).toBe(640);
    expect(registry.get(reviewFileScope(owner))).toBe('unstaged');
    expect(registry.get(phoneReviewComparison('another-workspace'))).toEqual({
      kind: 'worktree',
    });
    expect(
      registry.get(
        reviewListOffset(JSON.stringify([workspace, { kind: 'worktree' }])),
      ),
    ).toBe(0);
    expect(registry.get(reviewFileScope('another-document'))).toBeUndefined();
  } finally {
    registry.dispose();
  }
});
