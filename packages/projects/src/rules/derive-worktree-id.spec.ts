import { describe, expect, it } from 'vitest';
import { deriveWorktreeId } from './derive-worktree-id.ts';

const projectId = '3f2a9c1e-0000-4000-8000-000000000001';
const length = 32;

describe('deriveWorktreeId', () => {
  it('keeps the identifier that earlier versions stored', () => {
    expect(deriveWorktreeId(projectId, 'worktree-metadata-1', length)).toBe(
      '5462fe0b34ba93ff5684dcdcc0254389',
    );
  });

  it('gives the same checkout a different identifier in another project', () => {
    expect(
      deriveWorktreeId(
        '3f2a9c1e-0000-4000-8000-000000000002',
        'worktree-metadata-1',
        length,
      ),
    ).not.toBe(deriveWorktreeId(projectId, 'worktree-metadata-1', length));
  });

  it('does not confuse the project and metadata boundary', () => {
    expect(deriveWorktreeId('ab', 'c', length)).not.toBe(
      deriveWorktreeId('a', 'bc', length),
    );
  });

  it('answers the leading hexadecimal digits the length asks for', () => {
    const id = deriveWorktreeId(projectId, 'worktree-metadata-1', 8);
    expect(id).toBe('5462fe0b');
  });
});
