import { describe, expect, it } from 'vitest';
import { fixture } from '../../../spec/fixtures/fixture.ts';
import { parseGitStatus } from './parse-git-status.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

const HEAD = 'f4e8dd3408852fb71b1581394612bcf35e414dfc';
const A = 'b2f931a67315c95c5daab3aac6de62e534808476';
const B = 'b89df23defe5ae95cfb2ff7408d90afd689b8c43';
const N = '3e757656cf36eca53338e520d134963a44f793f8';

const records = (...lines: string[]) =>
  Buffer.from(`${lines.join('\0')}\0`, 'utf8');

const working = fixture('status/working.txt');

describe('parseGitStatus', () => {
  it('reads the branch, its upstream and how far it has diverged', () => {
    expect(parseGitStatus(working, gitLimits).branch).toEqual({
      name: 'main',
      upstream: 'origin/main',
      ahead: 1,
      behind: 2,
    });
  });

  it('reads modified, added, renamed and untracked paths per scope', () => {
    expect(parseGitStatus(working, gitLimits).changes).toEqual([
      {
        scope: 'unstaged',
        kind: 'modified',
        oldPath: 'a.txt',
        newPath: 'a.txt',
        oldMode: '100644',
        newMode: '100644',
        oldOid: A,
        newOid: null,
        supported: true,
      },
      {
        scope: 'staged',
        kind: 'added',
        oldPath: null,
        newPath: 'new file.txt',
        oldMode: '000000',
        newMode: '100644',
        oldOid: null,
        newOid: N,
        supported: true,
      },
      {
        scope: 'staged',
        kind: 'renamed',
        oldPath: 'b.txt',
        newPath: 'renamed.txt',
        oldMode: '100644',
        newMode: '100644',
        oldOid: B,
        newOid: B,
        supported: true,
      },
      { scope: 'untracked', path: 'dir/inner.txt' },
    ]);
  });

  it('reads a conflicted path with its three stages', () => {
    expect(
      parseGitStatus(fixture('status/conflicted.txt'), gitLimits).changes,
    ).toEqual([
      {
        scope: 'unmerged',
        path: 'my file.txt',
        conflict: 'UU',
        modes: ['100644', '100644', '100644', '100644'],
        oids: [
          'df967b96a579e45a18b8251732d16804b2e56a55',
          'ba2906d0666cf726c7eaadd2cd3db615dedfdf3a',
          'e45c9c2666d44e0327c1f9c239a74c508336053e',
        ],
      },
    ]);
  });

  it('reads a repository without commits and a detached HEAD', () => {
    const initial = parseGitStatus(fixture('status/initial.txt'), gitLimits);
    const detached = parseGitStatus(fixture('status/detached.txt'), gitLimits);
    expect([initial.headOid, detached.branch?.name]).toEqual([null, null]);
  });

  it('marks a submodule change as unsupported', () => {
    expect(
      parseGitStatus(fixture('status/submodule.txt'), gitLimits).changes,
    ).toMatchObject([{ supported: false }]);
  });

  it('gives the same output the same token and different output another', () => {
    const token = parseGitStatus(working, gitLimits).statusToken;
    expect(parseGitStatus(Buffer.from(working), gitLimits).statusToken).toBe(
      token,
    );
    expect(
      parseGitStatus(fixture('status/detached.txt'), gitLimits).statusToken,
    ).not.toBe(token);
  });

  it('rejects output cut off before its final terminator', () => {
    expect(() =>
      parseGitStatus(fixture('status/working-truncated.txt'), gitLimits),
    ).toThrow('Invalid Git status output');
  });

  it('rejects a record with a malformed mode', () => {
    expect(() =>
      parseGitStatus(
        fixture('status/working-malformed-hand-edited.txt'),
        gitLimits,
      ),
    ).toThrow('Invalid Git status output');
  });

  it('rejects output without a head object name', () => {
    expect(() =>
      parseGitStatus(records('# branch.head main'), gitLimits),
    ).toThrow('Invalid Git status output');
  });

  it.each([
    { name: 'an unknown record', record: `! ignored.txt` },
    {
      name: 'an unknown change code',
      record: `1 .X N... 100644 100644 100644 ${A} ${A} a.txt`,
    },
    {
      name: 'a change code of one letter',
      record: `1 M N... 100644 100644 100644 ${A} ${A} a.txt`,
    },
    {
      name: 'an unknown conflict code',
      record: `u ZZ N... 100644 100644 100644 100644 ${A} ${B} ${N} a.txt`,
    },
    {
      name: 'a conflict record missing an object name',
      record: `u UU N... 100644 100644 100644 100644 ${A} ${B} a.txt`,
    },
  ])('rejects $name', ({ record }) => {
    expect(() =>
      parseGitStatus(records(`# branch.oid ${HEAD}`, record), gitLimits),
    ).toThrow('Invalid Git status output');
  });

  it.each(['../outside', '/etc/passwd', 'a//b', 'a/./b'])(
    'refuses the path %j, which escapes the checkout',
    (path) => {
      expect(() =>
        parseGitStatus(records(`# branch.oid ${HEAD}`, `? ${path}`), gitLimits),
      ).toThrow('Git paths require valid UTF-8');
    },
  );

  it('refuses a path that is not valid UTF-8', () => {
    expect(() =>
      parseGitStatus(
        Buffer.concat([
          records(`# branch.oid ${HEAD}`),
          Buffer.from([0x3f, 0x20, 0xff, 0xfe, 0x00]),
        ]),
        gitLimits,
      ),
    ).toThrow('Git paths require valid UTF-8');
  });
});
