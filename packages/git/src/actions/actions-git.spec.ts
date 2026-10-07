import { NodeServices } from '@effect/platform-node';
import { Cause, Effect, Exit, Fiber, Schedule } from 'effect';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { executeGitAction } from './actions-git.ts';
import { gitLimits } from '../../spec/fixtures/git-limits.ts';

let root: string;
let checkout: string;
const git = (...args: string[]) =>
  execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
const head = () => git('rev-parse', 'HEAD');
const session = () => ({
  path: checkout,
  verify: () => Effect.void,
  confirm: () => Effect.void,
  conversionFilters: <A, E, R>(read: Effect.Effect<A, E, R>) => read,
});
const expected = () => {
  const tracking = spawnSync(
    'git',
    [
      '-C',
      checkout,
      'rev-parse',
      '--verify',
      '--quiet',
      'refs/remotes/origin/main',
    ],
    { encoding: 'utf8' },
  );
  return {
    headOid: head(),
    branch: 'main',
    inProgress: null,
    mergeHeadOid: null,
    upstreamOid: tracking.status === 0 ? tracking.stdout.trim() : null,
  };
};
function run<A, E>(work: Effect.Effect<A, E, NodeServices.NodeServices>) {
  return Effect.runPromise(
    work.pipe(Effect.provide(NodeServices.layer), Effect.timeout('20 seconds')),
  );
}
const action = (
  intent: Parameters<typeof executeGitAction>[3],
  progress?: (line: string) => void,
) =>
  executeGitAction(
    session(),
    gitLimits,
    'native-action',
    intent,
    expected(),
    progress,
  );

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-native-actions-'));
  checkout = join(root, 'checkout');
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
  git('config', 'user.name', 'T');
  git('config', 'user.email', 't@e');
  writeFileSync(join(checkout, 'a.txt'), 'base\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('native Git actions', () => {
  it('pushes one branch, reports no change on replay and fetches into its tracking ref with progress', async () => {
    const remote = join(root, 'remote.git');
    execFileSync('git', ['clone', '-q', '--bare', checkout, remote]);
    git('remote', 'add', 'origin', remote);
    writeFileSync(join(checkout, 'a.txt'), 'published\n');
    git('commit', '-q', '-am', 'published');
    const sourceOid = head();
    const lines: string[] = [];
    const push = {
      action: 'push' as const,
      remoteName: 'origin',
      destinationRef: 'refs/heads/main',
      allowCreate: false,
    };
    expect(await run(action(push, (line) => lines.push(line)))).toEqual({
      state: 'succeeded',
      result: { sourceOid, destinationRef: 'refs/heads/main' },
      refreshRequired: true,
    });
    expect(
      execFileSync('git', ['--git-dir', remote, 'rev-parse', 'main'], {
        encoding: 'utf8',
      }).trim(),
    ).toBe(sourceOid);
    expect(lines.some((line) => line.includes('Writing objects'))).toBe(true);
    expect(await run(action(push))).toMatchObject({ state: 'no-change' });
    git('update-ref', '-d', 'refs/remotes/origin/main');
    expect(
      await run(
        action({
          action: 'fetch',
          remoteName: 'origin',
          sourceRef: 'refs/heads/main',
        }),
      ),
    ).toEqual({
      state: 'succeeded',
      result: { trackingOid: sourceOid },
      refreshRequired: true,
    });
    expect({
      tracking: git('rev-parse', 'refs/remotes/origin/main'),
      temporary: git('for-each-ref', 'refs/porcelain/fetch'),
      head: head(),
    }).toEqual({ tracking: sourceOid, temporary: '', head: sourceOid });
  });

  it('refuses a symbolic link hook before writing Git state', async () => {
    const script = join(root, 'hook');
    writeFileSync(script, '#!/bin/sh\nexit 0\n');
    chmodSync(script, 0o755);
    symlinkSync(script, join(checkout, '.git/hooks/pre-commit'));
    const before = head();
    writeFileSync(join(checkout, 'a.txt'), 'edited\n');
    expect(
      await run(
        Effect.flip(
          action({ action: 'commit', paths: ['a.txt'], message: 'edited' }),
        ),
      ),
    ).toMatchObject({
      _tag: 'GitActionRejectedError',
      reason: 'UNSUPPORTED_CONFIGURATION',
    });
    expect(head()).toBe(before);
  });

  it('refuses an existing index lock before writing Git state', async () => {
    writeFileSync(join(checkout, '.git/index.lock'), 'locked');
    const before = head();
    expect(
      await run(
        Effect.flip(
          action({
            action: 'stash-create',
            message: 'saved',
            includeUntracked: false,
          }),
        ),
      ),
    ).toMatchObject({
      _tag: 'GitActionRejectedError',
      reason: 'CHECKOUT_BUSY',
    });
    expect(head()).toBe(before);
  });

  it.each(['pre-commit', 'post-commit'])(
    'interrupts a running %s hook, drains it and preserves the index for the resulting head',
    async (hook) => {
      const pidFile = join(root, 'hook.pid');
      const script = join(checkout, '.git/hooks', hook);
      writeFileSync(
        script,
        `#!/bin/sh\necho $$ > '${pidFile}'\nexec sleep 30\n`,
      );
      chmodSync(script, 0o755);
      writeFileSync(join(checkout, 'a.txt'), 'committed\n');
      const work = action({
        action: 'commit',
        paths: ['a.txt'],
        message: 'committed',
      });
      const { exit, pid } = await run(
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(work);
          const pid = yield* Effect.try(() =>
            Number(readFileSync(pidFile, 'utf8').trim()),
          ).pipe(
            Effect.retry(Schedule.spaced('10 millis')),
            Effect.timeout('5 seconds'),
          );
          yield* Fiber.interrupt(fiber);
          return { exit: yield* Fiber.await(fiber), pid };
        }),
      );
      expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
        true,
      );
      expect(() => process.kill(pid, 0)).toThrow();
      expect({
        commits: git('rev-list', '--count', 'HEAD'),
        staged: git('diff', '--cached', '--name-only'),
        modified: git('diff', '--name-only'),
        lock: existsSync(join(checkout, '.git/index.lock')),
        temporary: readdirSync(join(checkout, '.git')).filter((name) =>
          name.startsWith('porcelain-index-'),
        ),
      }).toEqual({
        commits: hook === 'post-commit' ? '2' : '1',
        staged: '',
        modified: hook === 'post-commit' ? '' : 'a.txt',
        lock: false,
        temporary: [],
      });
    },
  );
});
