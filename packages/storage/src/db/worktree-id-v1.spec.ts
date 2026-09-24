import { describe, expect, it } from 'vitest';
import { worktreeIdV1 } from './worktree-id-v1.ts';

const projectId = '3f2a9c1e-0000-4000-8000-000000000001';

describe('worktreeIdV1', () => {
  it('derives the identifier the worktrees migration wrote', () => {
    expect(worktreeIdV1(projectId, 'worktree-metadata-1')).toBe(
      '5462fe0b34ba93ff5684dcdcc0254389',
    );
  });

  it('does not confuse the project and metadata boundary', () => {
    expect(worktreeIdV1('ab', 'c')).not.toBe(worktreeIdV1('a', 'bc'));
  });
});
