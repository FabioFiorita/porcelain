import { NodeServices } from '@effect/platform-node';
import { Cause, Duration, Effect, Exit, Fiber, Layer } from 'effect';
import type { ListableProject } from '@porcelain/projects/models';
import { WorktreeListingReader } from '@porcelain/projects/ports';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import {
  closeSync,
  mkdtempSync,
  openSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type FailureReport, Logger } from '../../ports/logger.ts';
import { gitWorktreeListingReaderLayer } from './git-worktree-listing-reader.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'porcelain-listing-')));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function repository() {
  const checkout = join(root, 'api');
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
  return {
    id: 'project-1',
    commonDirectory: join(checkout, '.git'),
    repositoryIdentity: 'repository-1',
  };
}

function repositoryWhoseHeadPipeHoldsGit() {
  const project = repository();
  const head = join(project.commonDirectory, 'HEAD');
  rmSync(head);
  execFileSync('mkfifo', [head]);
  return { project, head };
}

function pipeHasReader(pipe: string): boolean {
  try {
    closeSync(openSync(pipe, constants.O_WRONLY | constants.O_NONBLOCK));
    return true;
  } catch {
    return false;
  }
}

function listing(
  project: ListableProject,
  options: { outputBytes?: number; timeout?: Duration.Duration } = {},
) {
  const reports: FailureReport[] = [];
  const reader = gitWorktreeListingReaderLayer({
    git: {
      ...gitLimits,
      outputBytes: options.outputBytes ?? gitLimits.outputBytes,
    },
    launches: 1,
    timeout: options.timeout ?? Duration.seconds(5),
    worktreeId: (projectId, metadataIdentity) =>
      `${projectId}:${metadataIdentity}`,
  }).pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(Logger, { failure: (report) => reports.push(report) }),
        NodeServices.layer,
      ),
    ),
  );
  const list = Effect.gen(function* () {
    return yield* (yield* WorktreeListingReader).list(project);
  }).pipe(Effect.provide(reader));
  return { list, reports };
}

describe('gitWorktreeListingReaderLayer', () => {
  it('lists the worktrees of a project with ids derived from their metadata', async () => {
    const project = repository();
    const { list, reports } = listing(project);
    const result = await Effect.runPromise(list);
    expect(result).toMatchObject({
      kind: 'listed',
      projectId: 'project-1',
      unidentified: 0,
      worktrees: [
        {
          projectId: 'project-1',
          path: join(root, 'api'),
          branch: 'refs/heads/main',
          main: true,
          available: true,
          commonDirectory: project.commonDirectory,
        },
      ],
    });
    const [worktree] = result.kind === 'listed' ? result.worktrees : [];
    expect(worktree?.id).toBe(`project-1:${worktree?.metadataIdentity}`);
    expect(reports).toEqual([]);
  });

  it('reports a repository that is gone as unavailable without logging it', async () => {
    const { list, reports } = listing({
      id: 'project-1',
      commonDirectory: join(root, 'gone', '.git'),
      repositoryIdentity: 'repository-1',
    });
    expect(await Effect.runPromise(list)).toEqual({
      kind: 'unavailable',
      projectId: 'project-1',
    });
    expect(reports).toEqual([]);
  });

  it('reports a listing that fails unexpectedly as unavailable and logs why', async () => {
    const { list, reports } = listing(repository(), { outputBytes: 4 });
    expect(await Effect.runPromise(list)).toEqual({
      kind: 'unavailable',
      projectId: 'project-1',
    });
    expect(reports).toMatchObject([
      {
        kind: 'worktree-listing',
        projectId: 'project-1',
        error: { _tag: 'GitOutputLimitError' },
      },
    ]);
  });

  it('stops Git when the listing outlives its deadline, then reports it unavailable and logs the timeout', async () => {
    const { project, head } = repositoryWhoseHeadPipeHoldsGit();
    const { list, reports } = listing(project, {
      timeout: Duration.millis(300),
    });
    expect(await Effect.runPromise(list)).toEqual({
      kind: 'unavailable',
      projectId: 'project-1',
    });
    expect(reports).toMatchObject([
      { kind: 'worktree-listing', error: { _tag: 'TimeoutError' } },
    ]);
    expect(pipeHasReader(head)).toBe(false);
  });

  it('stops Git without reporting the project when its caller is interrupted', async () => {
    const { project, head } = repositoryWhoseHeadPipeHoldsGit();
    const { list, reports } = listing(project);
    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const request = yield* Effect.forkChild(list);
        yield* Effect.sleep(Duration.millis(300));
        yield* Fiber.interrupt(request);
        return yield* Fiber.await(request);
      }),
    );
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
      true,
    );
    expect(reports).toEqual([]);
    expect(pipeHasReader(head)).toBe(false);
  });
});
