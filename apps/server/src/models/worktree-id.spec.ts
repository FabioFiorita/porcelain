import fc from 'fast-check';
import { expect, it } from 'vitest';
import { deriveWorktreeId } from './worktree-id.ts';

const part = fc.string({ minLength: 1, maxLength: 40 });

it('derives the same shape and the same id from the same project and identity', () => {
  fc.assert(
    fc.property(part, part, (projectId, metadataIdentity) => {
      const id = deriveWorktreeId(projectId, metadataIdentity);
      expect(id).toMatch(/^[0-9a-f]{32}$/);
      expect(deriveWorktreeId(projectId, metadataIdentity)).toBe(id);
    }),
  );
});

it('keeps two worktrees apart however their project and identity are split', () => {
  // The inputs are joined before hashing, so a missing separator would give
  // project "ab" + identity "c" the id of project "a" + identity "bc" — two
  // different worktrees sharing one set of comments.
  fc.assert(
    fc.property(part, part, part, (left, middle, right) => {
      expect(deriveWorktreeId(left, `${middle}${right}`)).not.toBe(
        deriveWorktreeId(`${left}${middle}`, right),
      );
    }),
  );
});

it('derives ids that no longer change once review data exists', () => {
  // A fixed answer, because changing what goes into the hash silently orphans
  // every comment, mark, layer and artifact already written for a worktree.
  // Changing this expectation is how such a change gets discussed.
  expect(deriveWorktreeId('project', '2049:12345:1700000000000000000')).toBe(
    'a96eb04fbd467f7791fc5efd287e0bd1',
  );
});
