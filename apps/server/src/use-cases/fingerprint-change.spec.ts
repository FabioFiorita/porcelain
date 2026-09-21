import type { GitChange } from '@porcelain/git/dtos/git-status';
import { describe, expect, it } from 'vitest';
import { fingerprintChange, type WorktreeSide } from './fingerprint-change.ts';

const staged: GitChange = {
  scope: 'staged',
  kind: 'modified',
  oldPath: 'file.ts',
  newPath: 'file.ts',
  oldMode: '100644',
  newMode: '100644',
  oldOid: 'a'.repeat(40),
  newOid: 'b'.repeat(40),
  supported: true,
};
const unstaged: GitChange = {
  ...staged,
  scope: 'unstaged',
  oldOid: 'b'.repeat(40),
  newOid: null,
};

const worktree =
  (sides: Record<string, WorktreeSide>) =>
  (path: string): WorktreeSide | undefined =>
    sides[path];

const none = worktree({});
const digested = worktree({ 'file.ts': { digest: 'c'.repeat(64) } });

describe('fingerprinting a change', () => {
  /**
   * The whole point of one fingerprint per path: stage an edit, make another,
   * and a fingerprint over the staged side alone would call the file
   * reviewed while the working copy says something else.
   */
  it('covers every comparison of a path, so half a change cannot be marked', () => {
    const both = fingerprintChange('file.ts', [staged, unstaged], digested);
    expect(both).not.toBe(fingerprintChange('file.ts', [staged], digested));
    expect(both).not.toBe(fingerprintChange('file.ts', [unstaged], digested));
    // The working side moved; the staged side did not.
    expect(both).not.toBe(
      fingerprintChange(
        'file.ts',
        [staged, unstaged],
        worktree({ 'file.ts': { digest: 'd'.repeat(64) } }),
      ),
    );
  });

  /** `100644` to `100755` leaves the bytes alone and is still a real change. */
  it('includes both modes', () => {
    expect(fingerprintChange('file.ts', [staged], none)).not.toBe(
      fingerprintChange('file.ts', [{ ...staged, newMode: '100755' }], none),
    );
  });

  it('distinguishes a rename from an edit in place', () => {
    const renamed: GitChange = {
      ...staged,
      kind: 'renamed',
      oldPath: 'old.ts',
    };
    expect(fingerprintChange('file.ts', [renamed], none)).not.toBe(
      fingerprintChange('file.ts', [staged], none),
    );
  });

  /**
   * A symlink is fingerprinted from its literal target. Following it would
   * read whatever it points at, which may be outside the checkout entirely.
   */
  it('fingerprints a symlink from its target, and notices a retarget', () => {
    const link: GitChange = { ...unstaged, newMode: '120000' };
    const v1 = fingerprintChange(
      'file.ts',
      [link],
      worktree({ 'file.ts': { symlink: 'tool-v1' } }),
    );
    const v2 = fingerprintChange(
      'file.ts',
      [link],
      worktree({ 'file.ts': { symlink: 'tool-v2' } }),
    );
    expect(v1).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(v1).not.toBe(v2);
  });

  /**
   * A submodule pointer move is reviewable from the recorded commit. What
   * changed inside the submodule is outside the parent's review, and the
   * status deliberately does not look.
   */
  it('fingerprints a submodule from its recorded commit', () => {
    const pointer: GitChange = {
      ...staged,
      oldMode: '160000',
      newMode: '160000',
      supported: false,
    };
    expect(fingerprintChange('sub', [pointer], none)).not.toBe(
      fingerprintChange('sub', [{ ...pointer, newOid: 'e'.repeat(40) }], none),
    );
  });

  /**
   * A binary file has an object id like anything else. Refusing to fingerprint
   * it would make every image edit permanently unmarkable.
   */
  it('fingerprints a binary change from its object ids', () => {
    expect(fingerprintChange('logo.png', [staged], none)).toEqual(
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it('fingerprints a deletion from the side that was there', () => {
    const deleted: GitChange = {
      ...unstaged,
      kind: 'deleted',
      newPath: null,
      newOid: null,
    };
    expect(fingerprintChange('file.ts', [deleted], none)).toEqual(
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    // Re-creating the file with different content is not what was reviewed.
    expect(fingerprintChange('file.ts', [deleted], none)).not.toBe(
      fingerprintChange('file.ts', [unstaged], digested),
    );
  });

  it('fingerprints conflict stages and refuses an ordinary side it could not establish', () => {
    const conflict: GitChange = {
      scope: 'unmerged',
      path: 'file.ts',
      conflict: 'UU',
      modes: ['100644', '100644', '100644', '100644'],
      oids: ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40)],
    };
    expect(fingerprintChange('file.ts', [conflict], none)).toEqual(
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    // Unreadable working file: nothing to hash, so nothing to mark.
    expect(fingerprintChange('file.ts', [unstaged], none)).toBeNull();
    expect(
      fingerprintChange(
        'new.ts',
        [{ scope: 'untracked', path: 'new.ts' }],
        none,
      ),
    ).toBeNull();
    // One unestablished side poisons the whole path, not just its comparison.
    expect(fingerprintChange('file.ts', [staged, unstaged], none)).toBeNull();
  });
});
