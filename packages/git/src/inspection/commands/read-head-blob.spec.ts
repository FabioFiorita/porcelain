import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readHeadBlob } from './read-head-blob.ts';
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

describe('readHeadBlob', () => {
  it('reads the committed bytes of a file, not the worktree edit', async () => {
    const blob = await readHeadBlob(
      { path: checkout },
      { path: 'README.md', maxBytes: 100 },
      gitLimits,
    );
    expect(blob).toEqual({ kind: 'bytes', bytes: Buffer.from('committed\n') });
  });

  it('reads a blob exactly at the limit', async () => {
    expect(
      await readHeadBlob(
        { path: checkout },
        { path: 'README.md', maxBytes: 'committed\n'.length },
        gitLimits,
      ),
    ).toEqual({ kind: 'bytes', bytes: Buffer.from('committed\n') });
  });

  it('answers too large for a blob one byte past the limit', async () => {
    expect(
      await readHeadBlob(
        { path: checkout },
        { path: 'README.md', maxBytes: 'committed\n'.length - 1 },
        gitLimits,
      ),
    ).toEqual({ kind: 'too-large' });
  });
});
