import { describe, expect, it } from 'vitest';
import { parseGitStatus } from './parse-git-status.ts';

const HEAD = 'a009a75e6294ff85720885cbc63f5ef03b85b3dd';
const A = '78981922613b2afb6025042ff6bd878ac1994e85';
const B = '61780798228d17af2d34fce4cfbdf35556832472';
const N = '8ba3a16384aacc37d01564b28401755ce8053f51';
const ZERO = '0'.repeat(40);

const records = (...lines: string[]) =>
  Buffer.from(`${lines.join('\0')}\0`, 'utf8');

const working = records(
  `# branch.oid ${HEAD}`,
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +1 -2',
  `1 .M N... 100644 100644 100644 ${A} ${A} a.txt`,
  `1 A. N... 000000 100644 100644 ${ZERO} ${N} new file.txt`,
  `2 R. N... 100644 100644 100644 ${B} ${B} R100 renamed.txt`,
  'b.txt',
  '? dir/inner.txt',
);

describe('parseGitStatus', () => {
  it('reads the branch, its upstream and how far it has diverged', () => {
    expect(parseGitStatus(working).branch).toEqual({
      name: 'main',
      upstream: 'origin/main',
      ahead: 1,
      behind: 2,
    });
  });

  it('reads modified, added, renamed and untracked paths per scope', () => {
    expect(parseGitStatus(working).changes).toEqual([
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
    const status = parseGitStatus(
      records(
        `# branch.oid ${HEAD}`,
        '# branch.head main',
        `u UU N... 100644 100644 100644 100644 ${A} ${B} ${N} my file.txt`,
      ),
    );
    expect(status.changes).toEqual([
      {
        scope: 'unmerged',
        path: 'my file.txt',
        conflict: 'UU',
        modes: ['100644', '100644', '100644', '100644'],
        oids: [A, B, N],
      },
    ]);
  });

  it('reads a repository without commits and a detached HEAD', () => {
    const initial = parseGitStatus(
      records('# branch.oid (initial)', '# branch.head main'),
    );
    const detached = parseGitStatus(
      records(`# branch.oid ${HEAD}`, '# branch.head (detached)'),
    );
    expect([initial.headOid, detached.branch?.name]).toEqual([null, null]);
  });

  it('marks a submodule change as unsupported', () => {
    const status = parseGitStatus(
      records(
        `# branch.oid ${HEAD}`,
        `1 .M SC.. 160000 160000 160000 ${A} ${A} vendor/lib`,
      ),
    );
    expect(status.changes).toMatchObject([{ supported: false }]);
  });

  it('gives the same output the same token and different output another', () => {
    const token = parseGitStatus(working).statusToken;
    expect(parseGitStatus(Buffer.from(working)).statusToken).toBe(token);
    expect(
      parseGitStatus(records(`# branch.oid ${HEAD}`, '# branch.head main'))
        .statusToken,
    ).not.toBe(token);
  });

  it('rejects output cut off before its final terminator', () => {
    expect(() =>
      parseGitStatus(working.subarray(0, working.length - 1)),
    ).toThrow('Invalid Git status output');
  });

  it('rejects output without a head object name', () => {
    expect(() => parseGitStatus(records('# branch.head main'))).toThrow(
      'Invalid Git status output',
    );
  });

  it('rejects unknown records, codes and malformed modes', () => {
    for (const record of [
      `! ignored.txt`,
      `1 .X N... 100644 100644 100644 ${A} ${A} a.txt`,
      `1 M N... 100644 100644 100644 ${A} ${A} a.txt`,
      `1 .M N... 100644 10064 100644 ${A} ${A} a.txt`,
      `u ZZ N... 100644 100644 100644 100644 ${A} ${B} ${N} a.txt`,
      `u UU N... 100644 100644 100644 100644 ${A} ${B} a.txt`,
    ])
      expect(() =>
        parseGitStatus(records(`# branch.oid ${HEAD}`, record)),
      ).toThrow('Invalid Git status output');
  });

  it('refuses paths that escape the checkout or are not valid UTF-8', () => {
    for (const path of ['../outside', '/etc/passwd', 'a//b', 'a/./b'])
      expect(() =>
        parseGitStatus(records(`# branch.oid ${HEAD}`, `? ${path}`)),
      ).toThrow('Git paths require valid UTF-8');
    expect(() =>
      parseGitStatus(
        Buffer.concat([
          records(`# branch.oid ${HEAD}`),
          Buffer.from([0x3f, 0x20, 0xff, 0xfe, 0x00]),
        ]),
      ),
    ).toThrow('Git paths require valid UTF-8');
  });
});
