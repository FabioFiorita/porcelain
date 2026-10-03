import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readInProgress } from './read-in-progress.ts';

const ONE = '6c1b860d27b09e27478a7e1cd13377dc66dc1dec';
const TWO = 'ccdc14ed14529c0ed2856043769bdf9297be052f';

let base: string;
let checkout: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'porcelain-in-progress-'));
  checkout = join(base, 'repo');
  execFileSync('git', ['init', '-q', checkout]);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('readInProgress', () => {
  it('reports nothing in progress in a quiet checkout', async () => {
    expect(await readInProgress(checkout)).toEqual({
      inProgress: null,
      mergeHeadOid: null,
    });
  });

  it('reports a merge and the commit being merged', async () => {
    writeFileSync(join(checkout, '.git', 'MERGE_HEAD'), `${ONE}\n`);
    expect(await readInProgress(checkout)).toEqual({
      inProgress: 'merge',
      mergeHeadOid: ONE,
    });
  });

  it('reports an octopus merge without naming one commit', async () => {
    writeFileSync(join(checkout, '.git', 'MERGE_HEAD'), `${ONE}\n${TWO}\n`);
    expect(await readInProgress(checkout)).toEqual({
      inProgress: 'merge',
      mergeHeadOid: null,
    });
  });

  it('reports a rebase even when a merge head is also left behind', async () => {
    writeFileSync(join(checkout, '.git', 'MERGE_HEAD'), `${ONE}\n`);
    mkdirSync(join(checkout, '.git', 'rebase-merge'));
    expect(await readInProgress(checkout)).toEqual({
      inProgress: 'rebase',
      mergeHeadOid: null,
    });
  });

  it('follows a linked worktree to its own administrative directory', async () => {
    execFileSync('git', [
      '-C',
      checkout,
      '-c',
      'user.name=T',
      '-c',
      'user.email=t@e',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'base',
    ]);
    const linked = join(base, 'linked');
    execFileSync('git', ['-C', checkout, 'worktree', 'add', '-q', linked]);
    writeFileSync(
      join(checkout, '.git', 'worktrees', 'linked', 'MERGE_HEAD'),
      `${TWO}\n`,
    );
    expect([
      await readInProgress(checkout),
      await readInProgress(linked),
    ]).toEqual([
      { inProgress: null, mergeHeadOid: null },
      { inProgress: 'merge', mergeHeadOid: TWO },
    ]);
  });

  it('reports nothing in progress when the .git pointer is malformed', async () => {
    const broken = join(base, 'broken');
    mkdirSync(broken);
    writeFileSync(join(broken, '.git'), 'not a pointer\n');
    expect(await readInProgress(broken)).toEqual({
      inProgress: null,
      mergeHeadOid: null,
    });
  });
});
