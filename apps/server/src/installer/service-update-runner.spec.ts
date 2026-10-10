import { TestClock } from 'effect/testing';
import { Deferred, Effect, Exit, Fiber } from 'effect';
import { NodeServices } from '@effect/platform-node';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest';
import { openServiceUpdateRunner } from './service-update-runner.ts';
import { updateToLatest } from './update-to-latest.ts';
import type { CommandRunner } from './command-runner.ts';

type Answer = { code: number; stdout: string; stderr: string };

let home: string;
let published: string;
let updaterActive: boolean;
let npmViews: number;
let nativeModulesLoad: Answer;
let commands: string[];

const packageName = '@fabiofiorita/porcelain';
const serviceNode = '/opt/service/bin/node';
const runtimePackage = () =>
  join(
    home,
    '.local/share/porcelain/service/runtime/node_modules',
    packageName,
  );

function downloadInto(prefix: string, version: string) {
  const folder = join(prefix, 'node_modules', packageName);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, 'package.json'),
    JSON.stringify({ name: packageName, version }),
  );
  mkdirSync(join(folder, 'node_modules/effect'), { recursive: true });
  writeFileSync(join(folder, 'node_modules/effect/package.json'), '{}');
}

const answer = Effect.fn('Test.updateCommand')(
  (command: string, args: readonly string[]) =>
    Effect.sync(() => {
      const ok = (stdout: string): Answer => ({ code: 0, stdout, stderr: '' });
      commands.push(command);
      const target = args.at(-1) ?? '';
      if (command === 'npm' && args[0] === 'install') {
        downloadInto(
          args[args.indexOf('--prefix') + 1] ?? '',
          target.slice(`${packageName}@`.length),
        );
        return ok('');
      }
      if (command === serviceNode) return nativeModulesLoad;
      if (command === 'npm' && args[0] === 'view') {
        npmViews += 1;
        return ok(JSON.stringify(published));
      }
      if (command === 'systemctl')
        return updaterActive
          ? ok('active\n')
          : { code: 3, stdout: 'inactive\n', stderr: '' };
      return { code: 1, stdout: '', stderr: `unexpected ${command}` };
    }),
);

function install(version: string) {
  mkdirSync(runtimePackage(), { recursive: true });
  writeFileSync(
    join(runtimePackage(), 'package.json'),
    JSON.stringify({ name: packageName, version }),
  );
  writeFileSync(
    join(home, '.local/share/porcelain/service/installed.json'),
    JSON.stringify({ version }),
  );
}

const runner = Effect.fn('Test.openUpdateRunner')(function* (
  packageRoot: string = runtimePackage(),
  command: CommandRunner = (command, args) => answer(command, args),
) {
  const updates = yield* openServiceUpdateRunner({
    homeDirectory: home,
    packageRoot,
    searchPath: '/usr/bin',
    command: {
      timeoutMs: 1000,
      maxBytes: 1024,
      processGroup: { lingerMs: 10, cleanupMs: 10, pollMs: 1 },
    },
    locks: { startupWaitMs: 0, pollMs: 1, staleTakeovers: 1 },
    runner: command,
    nodeExecutable: serviceNode,
  }).pipe(Effect.provide(NodeServices.layer));
  yield* Effect.addFinalizer(() => updates.close());
  return updates;
});
const check = (now: string, staleBefore: string) => ({ now, staleBefore });

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'porcelain-service-updates-'));
  published = '1.1.0';
  updaterActive = false;
  npmViews = 0;
  nativeModulesLoad = { code: 0, stdout: '', stderr: '' };
  commands = [];
  install('1.0.0');
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('the installed service update runner', () => {
  it.effect(
    'keeps overlapping status reads available without inventing an update',
    () =>
      Effect.gen(function* () {
        const readers = [
          yield* runner(),
          yield* runner(),
          yield* runner(),
          yield* runner(),
        ];
        const states = yield* Effect.all(
          readers.map((updates) =>
            updates.read(
              check('2026-10-10T12:00:00.000Z', '2026-10-10T12:00:00.000Z'),
            ),
          ),
          { concurrency: 'unbounded' },
        );
        expect(
          states.map((state) => ({
            running: state.running,
            available: state.available,
          })),
        ).toEqual([
          { running: false, available: true },
          { running: false, available: true },
          { running: false, available: true },
          { running: false, available: true },
        ]);
        expect(
          existsSync(join(home, '.local/share/porcelain/service/updater.lock')),
        ).toBe(false);
      }),
  );

  it.effect(
    'refuses both a CLI and another server start while a separate runner prepares, preserves its files, and releases ownership after failure',
    () =>
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const release = yield* Deferred.make<Answer>();
        const server = yield* runner(runtimePackage(), (command, args) => {
          if (command !== 'npm' || args[0] !== 'install')
            return answer(command, args);
          return Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
          );
        });
        const cli = yield* runner();
        yield* server.start({ version: '1.1.0' });
        yield* Deferred.await(started);
        const root = join(home, '.local/share/porcelain/service');
        writeFileSync(join(root, 'updater/half-installed'), 'owned by server');
        const recordBefore = readFileSync(
          join(root, 'update-record.json'),
          'utf8',
        );
        const refused = yield* Effect.flip(
          updateToLatest(cli, {
            check: check(
              '2026-10-10T12:00:00.000Z',
              '2026-10-10T12:00:00.000Z',
            ),
            pollMs: 1,
            allowDowngrade: false,
            handingOff: () => {
              throw new Error('A refused update cannot announce hand-off');
            },
          }),
        );
        expect(refused.message).toBe('An update is already running');
        expect(
          (yield* Effect.flip(cli.start({ version: '1.1.0' }))).message,
        ).toBe('An update is already running');
        expect(
          (yield* Effect.flip(server.start({ version: '1.1.0' }))).message,
        ).toBe('An update is already running');
        expect(readFileSync(join(root, 'updater/half-installed'), 'utf8')).toBe(
          'owned by server',
        );
        expect(readFileSync(join(root, 'update-record.json'), 'utf8')).toBe(
          recordBefore,
        );
        expect(commands).not.toContain('systemd-run');
        yield* Deferred.succeed(release, {
          code: 1,
          stdout: '',
          stderr: 'offline',
        });
        expect(yield* server.awaitUpdate(1)).toMatchObject({
          stage: 'failed',
          reason: 'Could not install the persistent runtime: offline',
        });
        expect(existsSync(join(root, 'updater.lock'))).toBe(false);
        yield* cli.start({ version: '1.1.0' });
        expect(yield* cli.awaitUpdate(1)).toMatchObject({
          stage: 'failed',
          reason:
            'Could not start the updater beside the running service: unexpected systemd-run',
        });
      }).pipe(TestClock.withLive),
  );

  it.effect(
    'hands a verified runtime off once and releases the preparation lock after success',
    () =>
      Effect.gen(function* () {
        let handOffs = 0;
        let lockedAtHandOff = false;
        const updates = yield* runner(runtimePackage(), (command, args) => {
          if (command !== 'systemd-run') return answer(command, args);
          return Effect.sync(() => {
            handOffs += 1;
            lockedAtHandOff = existsSync(
              join(home, '.local/share/porcelain/service/updater.lock'),
            );
            writeFileSync(
              join(home, '.local/share/porcelain/service/update-record.json'),
              JSON.stringify({
                from: '1.0.0',
                target: '1.1.0',
                stage: 'updated',
              }),
            );
            return { code: 0, stdout: '', stderr: '' };
          });
        });
        yield* updates.start({ version: '1.1.0' });
        expect(yield* updates.awaitUpdate(1)).toEqual({
          from: '1.0.0',
          target: '1.1.0',
          stage: 'updated',
          reason: undefined,
        });
        expect(handOffs).toBe(1);
        expect(lockedAtHandOff).toBe(true);
        expect(
          existsSync(join(home, '.local/share/porcelain/service/updater.lock')),
        ).toBe(false);
      }).pipe(TestClock.withLive),
  );

  it.effect(
    'refuses an active updater under the lock without rewriting its progress record',
    () =>
      Effect.gen(function* () {
        const updates = yield* runner();
        updaterActive = true;
        const recordPath = join(
          home,
          '.local/share/porcelain/service/update-record.json',
        );
        writeFileSync(
          recordPath,
          JSON.stringify({
            from: '1.0.0',
            target: '1.1.0',
            stage: 'installing',
          }),
        );
        const before = readFileSync(recordPath, 'utf8');
        expect(
          (yield* Effect.flip(updates.start({ version: '1.1.0' }))).message,
        ).toBe('An update is already running');
        expect(readFileSync(recordPath, 'utf8')).toBe(before);
        expect(commands).toEqual(['systemctl']);
        expect(
          existsSync(join(home, '.local/share/porcelain/service/updater.lock')),
        ).toBe(false);
      }).pipe(TestClock.withLive),
  );

  it.effect(
    'releases a claimed preparation when the runner closes before hand-off can start',
    () =>
      Effect.gen(function* () {
        const checking = yield* Deferred.make<void>();
        const resume = yield* Deferred.make<void>();
        const updates = yield* runner(runtimePackage(), (command, args) =>
          command === 'systemctl'
            ? Deferred.succeed(checking, undefined).pipe(
                Effect.andThen(Deferred.await(resume)),
                Effect.andThen(answer(command, args)),
              )
            : answer(command, args),
        );
        const starting = yield* Effect.forkChild(
          updates.start({ version: '1.1.0' }),
        );
        yield* Deferred.await(checking);
        yield* updates.close();
        yield* Deferred.succeed(resume, undefined);
        expect(Exit.hasInterrupts(yield* Fiber.await(starting))).toBe(true);
        expect(commands).not.toContain('npm');
        const root = join(home, '.local/share/porcelain/service');
        expect(existsSync(join(root, 'updater.lock'))).toBe(false);
        expect(existsSync(join(root, 'update-record.json'))).toBe(false);
      }).pipe(TestClock.withLive),
  );

  it.effect(
    'owns accepted preparation after caller disconnect and waits for native cleanup before recording shutdown',
    () =>
      Effect.gen(function* () {
        const started = Deferred.makeUnsafe<void>();
        const aborted = Deferred.makeUnsafe<void>();
        const cleanup = Deferred.makeUnsafe<Answer>();
        let interrupted = false;
        const updates = yield* runner(runtimePackage(), (command, args) => {
          if (command !== 'npm' || args[0] !== 'install')
            return answer(command, args);
          return Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Deferred.await(cleanup)),
            Effect.onInterrupt(() =>
              Effect.gen(function* () {
                interrupted = true;
                yield* Deferred.succeed(aborted, undefined);
                yield* Deferred.await(cleanup);
              }),
            ),
          );
        });
        const caller = yield* Effect.forkChild(
          updates
            .start({ version: '1.1.0' })
            .pipe(Effect.andThen(Effect.never)),
        );
        yield* Deferred.await(started);
        yield* Fiber.interrupt(caller);
        expect(interrupted).toBe(false);
        const closing = yield* Effect.forkChild(updates.close());
        yield* Deferred.await(aborted);
        expect(
          (yield* updates.read(
            check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
          )).running,
        ).toBe(true);
        yield* Deferred.succeed(cleanup, {
          code: 1,
          stdout: '',
          stderr: 'Stopped',
        });
        yield* Fiber.join(closing);
        expect(
          yield* updates.read(
            check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
          ),
        ).toMatchObject({
          running: false,
          last: {
            from: '1.0.0',
            target: '1.1.0',
            stage: 'failed',
            reason: 'The server stopped before the update was handed off.',
          },
        });
        expect(commands).not.toContain('systemd-run');
      }).pipe(TestClock.withLive),
  );

  it.effect('offers the newer published version to the installed service', () =>
    Effect.gen(function* () {
      expect(
        yield* (yield* runner()).read(
          check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
        ),
      ).toEqual({
        managed: true,
        version: '1.0.0',
        latest: '1.1.0',
        available: true,
        running: false,
        last: undefined,
      });
    }).pipe(TestClock.withLive),
  );

  it.effect(
    'asks the registry again only once its last answer is older than the freshness window',
    () =>
      Effect.gen(function* () {
        const updates = yield* runner();
        yield* updates.read(
          check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
        );
        published = '1.2.0';
        const fresh = yield* updates.read(
          check('2026-09-29T12:05:00.000Z', '2026-09-29T11:55:00.000Z'),
        );
        expect(fresh.latest).toBe('1.1.0');
        expect(npmViews).toBe(1);
        const stale = yield* updates.read(
          check('2026-09-29T12:11:00.000Z', '2026-09-29T12:01:00.000Z'),
        );
        expect(stale.latest).toBe('1.2.0');
        expect(npmViews).toBe(2);
      }).pipe(TestClock.withLive),
  );

  it.effect('does not ask the registry while an update runs', () =>
    Effect.gen(function* () {
      updaterActive = true;
      const state = yield* (yield* runner()).read(
        check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
      );
      expect(state.running).toBe(true);
      expect(npmViews).toBe(0);
    }).pipe(TestClock.withLive),
  );

  it.effect(
    'stops a read whose request went away before the registry answered',
    () =>
      Effect.gen(function* () {
        const updates = yield* runner();
        const exit = yield* Effect.exit(
          Effect.interrupt.pipe(
            Effect.andThen(
              updates.read(
                check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
              ),
            ),
          ),
        );
        expect(Exit.hasInterrupts(exit)).toBe(true);
        expect(npmViews).toBe(0);
      }).pipe(TestClock.withLive),
  );

  it.effect(
    'starts nothing for a request that went away before the update was claimed',
    () =>
      Effect.gen(function* () {
        const updates = yield* runner();
        const exit = yield* Effect.exit(
          Effect.interrupt.pipe(
            Effect.andThen(updates.start({ version: '1.1.0' })),
          ),
        );
        expect(Exit.hasInterrupts(exit)).toBe(true);
        const state = yield* updates.read(
          check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
        );
        expect(state).toMatchObject({ running: false, last: undefined });
      }).pipe(TestClock.withLive),
  );

  it.effect(
    'offers nothing to a server that does not run from the installed runtime',
    () =>
      Effect.gen(function* () {
        const state = yield* (yield* runner(join(home, 'elsewhere'))).read(
          check('2026-09-29T12:00:00.000Z', '2026-09-29T11:50:00.000Z'),
        );
        expect(state).toMatchObject({ managed: false, available: false });
        expect(npmViews).toBe(0);
      }).pipe(TestClock.withLive),
  );

  it.effect(
    'fails the update with the reason and hands nothing over when the downloaded runtime cannot load its native modules',
    () =>
      Effect.gen(function* () {
        nativeModulesLoad = {
          code: 1,
          stdout: '',
          stderr: 'Could not locate the bindings file.',
        };
        const updates = yield* runner();
        yield* updates.start({ version: '1.1.0' });
        const last = yield* updates.awaitUpdate(1);
        expect(last).toEqual({
          from: '1.0.0',
          target: '1.1.0',
          stage: 'failed',
          reason:
            'The persistent runtime cannot load its native modules (node:sqlite, @parcel/watcher): Could not locate the bindings file.',
        });
        expect(commands).not.toContain('systemd-run');
      }).pipe(TestClock.withLive),
  );
});
