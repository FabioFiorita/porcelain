import { makeGitSession } from './request-git-session.ts';
import { NodeServices } from '@effect/platform-node';
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  constants,
  mkdtempSync,
  openSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitLimits } from '../../spec/fixtures/git-limits.ts';
import { gitWorktree } from '../../spec/fixtures/git-worktree.ts';
import { Cause, Duration, Effect, Exit, Fiber, Schedule } from 'effect';
import { describe, expect, it } from 'vitest';
function run<A, E>(operation: Effect.Effect<A, E, NodeServices.NodeServices>) {
  return Effect.runPromise(operation.pipe(Effect.provide(NodeServices.layer)));
}

describe('Effect checkout session', () => {
  it('verifies once, confirms against disk again, and retries after a failed confirmation', async ({
    onTestFinished,
  }) => {
    const root = realpathSync(
      mkdtempSync(join(tmpdir(), 'porcelain-checkout-')),
    );
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const actual = repository(root);
    const session = await run(makeGitSession(gitLimits));
    const opened = {
      worktree: actual,
      checkout: await run(
        session.checkout(
          actual.path,
          actual.metadataIdentity,
          actual.repositoryIdentity,
        ),
      ),
    };
    await run(opened.checkout.verify());
    renameSync(actual.administrativeDirectory, join(root, 'saved-git'));
    execFileSync('git', ['init', '-q', actual.path]);
    await run(opened.checkout.verify());
    expect(await run(Effect.flip(opened.checkout.confirm()))).toMatchObject({
      _tag: 'RepositoryIdentityMismatchError',
    });
    rmSync(actual.administrativeDirectory, { recursive: true });
    renameSync(join(root, 'saved-git'), actual.administrativeDirectory);
    await run(opened.checkout.verify());
    expect(opened.worktree).toEqual(actual);
    expect(
      await run(
        session.checkout(
          actual.path,
          actual.metadataIdentity,
          actual.repositoryIdentity,
        ),
      ),
    ).toBe(opened.checkout);
  });

  it('does not admit metadata or a common directory belonging to another repository', async ({
    onTestFinished,
  }) => {
    const root = realpathSync(
      mkdtempSync(join(tmpdir(), 'porcelain-mismatched-checkout-')),
    );
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const actual = repository(root);
    const session = await run(makeGitSession(gitLimits));
    const wrongMetadata = await run(
      session.checkout(
        actual.path,
        'another-metadata',
        actual.repositoryIdentity,
      ),
    );
    const wrongRepository = await run(
      session.checkout(
        actual.path,
        actual.metadataIdentity,
        'another-repository',
      ),
    );
    expect(await run(Effect.flip(wrongMetadata.verify()))).toMatchObject({
      _tag: 'RepositoryIdentityMismatchError',
    });
    expect(await run(Effect.flip(wrongRepository.verify()))).toMatchObject({
      _tag: 'RepositoryIdentityMismatchError',
    });
  });

  it('caches successful conversion reads and allows a new read after a failed attempt', async ({
    onTestFinished,
  }) => {
    const root = realpathSync(
      mkdtempSync(join(tmpdir(), 'porcelain-checkout-filters-')),
    );
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const actual = repository(root);
    const session = await run(makeGitSession(gitLimits));
    const checkout = await run(
      session.checkout(
        actual.path,
        actual.metadataIdentity,
        actual.repositoryIdentity,
      ),
    );
    const failed = await run(
      Effect.exit(
        checkout.conversionFilters(Effect.die(new Error('Filter read failed'))),
      ),
    );
    expect(failed._tag).toBe('Failure');
    execFileSync('git', ['config', 'test.filter', 'first'], {
      cwd: actual.path,
    });
    const read = Effect.sync(() => [
      execFileSync('git', ['config', '--get', 'test.filter'], {
        cwd: actual.path,
        encoding: 'utf8',
      }).trim(),
    ]);
    expect(await run(checkout.conversionFilters(read))).toEqual(['first']);
    execFileSync('git', ['config', 'test.filter', 'second'], {
      cwd: actual.path,
    });
    expect(await run(checkout.conversionFilters(read))).toEqual(['first']);
  });

  it('preserves verification deadlines and retries once the real repository is readable again', async ({
    onTestFinished,
  }) => {
    const root = realpathSync(
      mkdtempSync(join(tmpdir(), 'porcelain-checkout-deadline-')),
    );
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const actual = repository(root);
    const head = join(actual.administrativeDirectory, 'HEAD');
    rmSync(head);
    execFileSync('mkfifo', [head]);
    const session = await run(
      makeGitSession({ ...gitLimits, readTimeoutMs: 100 }),
    );
    const checkout = await run(
      session.checkout(
        actual.path,
        actual.metadataIdentity,
        actual.repositoryIdentity,
      ),
    );
    expect(await run(Effect.flip(checkout.verify()))).toMatchObject({
      _tag: 'GitTimeoutError',
    });
    rmSync(head);
    writeFileSync(head, 'ref: refs/heads/main\n');
    await run(checkout.verify());
    expect(checkout.path).toBe(actual.path);
  });

  it('interrupts cached checkout verification, stops real Git, and does not cache its interruption', async ({
    onTestFinished,
  }) => {
    const root = realpathSync(
      mkdtempSync(join(tmpdir(), 'porcelain-checkout-interrupt-')),
    );
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const actual = repository(root);
    const head = join(actual.administrativeDirectory, 'HEAD');
    rmSync(head);
    execFileSync('mkfifo', [head]);
    const session = await run(
      makeGitSession({
        ...gitLimits,
        readTimeoutMs: 30_000,
      }),
    );
    const checkout = await run(
      session.checkout(
        actual.path,
        actual.metadataIdentity,
        actual.repositoryIdentity,
      ),
    );
    const exit = await run(
      Effect.gen(function* () {
        const request = yield* Effect.forkChild(checkout.verify());
        return yield* Effect.acquireUseRelease(
          Effect.try(() =>
            openSync(head, constants.O_WRONLY | constants.O_NONBLOCK),
          ).pipe(
            Effect.retry(Schedule.spaced(Duration.millis(10))),
            Effect.timeout(Duration.seconds(5)),
          ),
          () => Effect.andThen(Fiber.interrupt(request), Fiber.await(request)),
          (writer) => Effect.sync(() => closeSync(writer)),
        );
      }),
    );
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
      true,
    );
    expect(() =>
      closeSync(openSync(head, constants.O_WRONLY | constants.O_NONBLOCK)),
    ).toThrow();
    rmSync(head);
    writeFileSync(head, 'ref: refs/heads/main\n');
    await run(checkout.verify());
  });
});

function repository(root: string) {
  execFileSync('git', ['init', '-q', '-b', 'main', join(root, 'main')]);
  return gitWorktree(root);
}
