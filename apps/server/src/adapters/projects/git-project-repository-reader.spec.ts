import { NodeServices } from '@effect/platform-node';
import { Effect } from 'effect';
import { ProjectRepositoryReader } from '@porcelain/projects/ports';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';
import { gitProjectRepositoryReaderLayer } from './git-project-repository-reader.ts';

let root: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'porcelain-inspection-')));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function inspect(path: string) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const reader = yield* ProjectRepositoryReader;
      return yield* reader.find({ path });
    }).pipe(
      Effect.provide(gitProjectRepositoryReaderLayer(gitLimits)),
      Effect.provide(NodeServices.layer),
    ),
  );
}

describe('repository inspection failures', () => {
  it('reports the missing folder instead of treating inspection as a successful empty result', async () => {
    const path = join(root, 'missing');
    await expect(inspect(path)).rejects.toMatchObject({
      _tag: 'RepositoryInspectionFailedError',
      message: `The folder no longer exists: ${path}`,
    });
  });

  it('explains that a present folder cannot be inspected as a Git repository', async () => {
    await expect(inspect(root)).rejects.toMatchObject({
      _tag: 'RepositoryInspectionFailedError',
      message: `Git could not inspect this folder. Check that it is a readable Git repository: ${root}`,
    });
  });
});
