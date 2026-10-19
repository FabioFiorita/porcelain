import { Effect } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBlobAtOid } from './read-blob-at-oid.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

let base: string;
let checkout: string;

function git(...args: string[]) {
  execFileSync('git', ['-C', checkout, ...args]);
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'porcelain-head-blob-'));
  checkout = join(base, 'repo');
  execFileSync('git', ['init', '-q', checkout]);
  writeFileSync(join(checkout, 'README.md'), 'committed\n');
  git('add', 'README.md');
  git(
    '-c',
    'user.name=Porcelain',
    '-c',
    'user.email=p@example.com',
    'commit',
    '-q',
    '-m',
    'first',
  );
  writeFileSync(join(checkout, 'README.md'), 'edited in the worktree\n');
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('readBlobAtOid', () => {
  it('reads the committed bytes of a file, not the worktree edit', async () => {
    const blob = await run(
      readBlobAtOid(
        { path: checkout },
        { oid: 'HEAD', path: 'README.md', maxBytes: 100 },
        gitLimits,
      ),
    );
    expect(blob).toEqual({
      kind: 'bytes',
      blobOid: 'd0fe82252177cb2caf3563f8190643a292c2caa1',
      bytes: Buffer.from('committed\n'),
    });
  });

  it('reads a blob exactly at the limit', async () => {
    expect(
      await run(
        readBlobAtOid(
          { path: checkout },
          { oid: 'HEAD', path: 'README.md', maxBytes: 'committed\n'.length },
          gitLimits,
        ),
      ),
    ).toEqual({
      kind: 'bytes',
      blobOid: 'd0fe82252177cb2caf3563f8190643a292c2caa1',
      bytes: Buffer.from('committed\n'),
    });
  });

  it('answers missing for a path HEAD does not hold, even when it is on disk', async () => {
    writeFileSync(join(checkout, 'new.md'), 'only on disk\n');
    expect(
      await Promise.all(
        ['new.md', 'absent.md'].map((path) =>
          run(
            readBlobAtOid(
              { path: checkout },
              { oid: 'HEAD', path, maxBytes: 100 },
              gitLimits,
            ),
          ),
        ),
      ),
    ).toEqual([{ kind: 'missing' }, { kind: 'missing' }]);
  });

  it('answers missing when the branch has no commit yet', async () => {
    const empty = join(base, 'empty');
    execFileSync('git', ['init', '-q', empty]);
    writeFileSync(join(empty, 'README.md'), 'not committed\n');
    expect(
      await run(
        readBlobAtOid(
          { path: empty },
          { oid: 'HEAD', path: 'README.md', maxBytes: 100 },
          gitLimits,
        ),
      ),
    ).toEqual({ kind: 'missing' });
  });

  it('answers too large for a blob one byte past the limit', async () => {
    expect(
      await run(
        readBlobAtOid(
          { path: checkout },
          {
            oid: 'HEAD',
            path: 'README.md',
            maxBytes: 'committed\n'.length - 1,
          },
          gitLimits,
        ),
      ),
    ).toEqual({
      kind: 'too-large',
      blobOid: 'd0fe82252177cb2caf3563f8190643a292c2caa1',
    });
  });
});

function run<A, E>(effect: Effect.Effect<A, E, NodeServices.NodeServices>) {
  return Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)));
}
