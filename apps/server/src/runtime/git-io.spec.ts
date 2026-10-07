import { NodeServices } from '@effect/platform-node';
import { withReadLease } from '@porcelain/effects';
import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { Cause, Deferred, Effect, Exit, Fiber, FileSystem } from 'effect';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readGitEffect } from './git-io.ts';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-git-io-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('Effect Git IO', () => {
  it('refuses a lease for another worktree before touching its files', async () => {
    const touched = join(root, 'touched');
    const result = await Effect.runPromiseExit(
      withReadLease(
        'another',
        readGitEffect(
          'requested',
          Effect.sync(() => writeFileSync(touched, 'wrong checkout')),
        ),
      ),
    );
    expect(Exit.isFailure(result) && Cause.hasDies(result.cause)).toBe(true);
    expect(Exit.isFailure(result) && Cause.squash(result.cause)).toMatchObject({
      message: 'Worktree IO requires its current admitted lease',
    });
    expect(existsSync(touched)).toBe(false);
  });

  it('maps missing real filesystem metadata to repository unavailable', async () => {
    const missing = Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.stat(join(root, 'missing-git-directory'));
    }).pipe(Effect.provide(NodeServices.layer));
    const failure = await Effect.runPromise(
      Effect.flip(withReadLease('tree', readGitEffect('tree', missing))),
    );
    expect(failure).toMatchObject({ _tag: 'RepositoryUnavailableError' });
  });

  it('maps a real path below a regular file to repository unavailable', async () => {
    const file = join(root, 'file');
    writeFileSync(file, 'ordinary file');
    const unavailable = Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.stat(join(file, 'metadata'));
    }).pipe(Effect.provide(NodeServices.layer));
    expect(
      await Effect.runPromise(
        Effect.flip(withReadLease('tree', readGitEffect('tree', unavailable))),
      ),
    ).toMatchObject({ _tag: 'RepositoryUnavailableError' });
  });

  it('preserves an expected missing worktree error in the failure channel', async () => {
    const missing = new WorktreeNotFoundError();
    const failure = await Effect.runPromise(
      Effect.flip(
        withReadLease('tree', readGitEffect('tree', Effect.fail(missing))),
      ),
    );
    expect(failure).toBe(missing);
  });

  it('keeps interruption as interruption and awaits resource cleanup', async () => {
    const settled = join(root, 'settled');
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const fiber = yield* Effect.forkChild(
          withReadLease(
            'tree',
            readGitEffect(
              'tree',
              Effect.acquireUseRelease(
                Effect.void,
                () =>
                  Effect.andThen(
                    Deferred.succeed(started, undefined),
                    Effect.never,
                  ),
                () => Effect.sync(() => writeFileSync(settled, 'released')),
              ),
            ),
          ),
        );
        yield* Deferred.await(started);
        yield* Fiber.interrupt(fiber);
        return yield* Fiber.await(fiber);
      }),
    );
    expect(
      Exit.isFailure(result) && Cause.hasInterruptsOnly(result.cause),
    ).toBe(true);
    expect(readFileSync(settled, 'utf8')).toBe('released');
  });

  it('keeps an unexpected fault as a defect', async () => {
    const result = await Effect.runPromiseExit(
      withReadLease(
        'tree',
        readGitEffect('tree', Effect.die(new Error('Broken parser'))),
      ),
    );
    expect(Exit.isFailure(result) && Cause.hasDies(result.cause)).toBe(true);
    expect(Exit.isFailure(result) && Cause.squash(result.cause)).toMatchObject({
      message: 'Broken parser',
    });
  });
});
