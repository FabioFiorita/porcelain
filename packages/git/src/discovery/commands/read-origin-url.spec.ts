import { NodeServices } from '@effect/platform-node';
import { Effect } from 'effect';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readOriginUrl } from './read-origin-url.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

let repository: string;

beforeEach(() => {
  repository = mkdtempSync(join(tmpdir(), 'porcelain-origin-'));
  execFileSync('git', ['init', '-q', repository]);
});

afterEach(() => {
  rmSync(repository, { recursive: true, force: true });
});

function read(checkout: string) {
  return Effect.runPromise(
    readOriginUrl(checkout, gitLimits).pipe(Effect.provide(NodeServices.layer)),
  );
}

describe('readOriginUrl', () => {
  it('reads the URL of the origin remote', async () => {
    execFileSync('git', [
      '-C',
      repository,
      'remote',
      'add',
      'origin',
      'https://example.com/team/api.git',
    ]);
    expect(await read(repository)).toBe('https://example.com/team/api.git');
  });

  it('answers nothing for a repository without an origin', async () => {
    expect(await read(repository)).toBeUndefined();
  });

  it('fails with the Git refusal for a folder that is not a repository', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'porcelain-not-a-repository-'));
    try {
      const error = await Effect.runPromise(
        Effect.flip(readOriginUrl(folder, gitLimits)).pipe(
          Effect.provide(NodeServices.layer),
        ),
      );
      expect(error).toMatchObject({ _tag: 'GitCommandError', exitCode: 128 });
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
