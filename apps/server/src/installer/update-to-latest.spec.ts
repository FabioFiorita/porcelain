import { TestClock } from 'effect/testing';
import { Effect, Schema } from 'effect';
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
import type { CommandRunner } from './command-runner.ts';
import { openServiceUpdateRunner } from './service-update-runner.ts';
import { updateToLatest } from './update-to-latest.ts';

type Answer = { code: number; stdout: string; stderr: string };
type UpdaterResult =
  | { stage: 'updated'; from?: string; target?: string }
  | { stage: 'failed'; reason?: string }
  | { stage: 'installing' }
  | { stage: 'missing' }
  | { stage: 'invalid' };

const packageName = '@fabiofiorita/porcelain';
const serviceNode = '/opt/service/bin/node';
const ok = (stdout = ''): Answer => ({ code: 0, stdout, stderr: '' });

let home: string;
let published: Answer;
let updaterResult: UpdaterResult;
let activePolls: number;
let installs: string[];
let handOffs: string[][];
let commands: string[];

const serviceRoot = () => join(home, '.local/share/porcelain/service');
const runtimePackage = () =>
  join(serviceRoot(), 'runtime/node_modules', packageName);
const updateRecordPath = () => join(serviceRoot(), 'update-record.json');
const installedVersion = () =>
  Schema.decodeUnknownSync(
    Schema.fromJsonString(Schema.Struct({ version: Schema.String })),
  )(readFileSync(join(serviceRoot(), 'installed.json'), 'utf8'));
const updateRecord = () =>
  Schema.decodeUnknownSync(
    Schema.fromJsonString(
      Schema.Struct({
        from: Schema.String,
        target: Schema.String,
        stage: Schema.String,
        reason: Schema.optional(Schema.String),
      }),
    ),
  )(readFileSync(updateRecordPath(), 'utf8'));

function writePackage(folder: string, version: string) {
  mkdirSync(join(folder, 'node_modules/effect'), { recursive: true });
  writeFileSync(
    join(folder, 'package.json'),
    JSON.stringify({ name: packageName, version }),
  );
  writeFileSync(join(folder, 'node_modules/effect/package.json'), '{}');
}

function install(version: string) {
  writePackage(runtimePackage(), version);
  writeFileSync(
    join(serviceRoot(), 'installed.json'),
    JSON.stringify({ version }),
  );
}

function finishUpdater() {
  const record = updateRecord();
  if (updaterResult.stage === 'missing') {
    rmSync(updateRecordPath());
    return;
  }
  if (updaterResult.stage === 'invalid') {
    writeFileSync(updateRecordPath(), '{broken');
    return;
  }
  writeFileSync(
    updateRecordPath(),
    JSON.stringify({
      from: record.from,
      target: record.target,
      ...updaterResult,
    }),
  );
  if (updaterResult.stage === 'updated') install(record.target);
}

const fakeCommand: CommandRunner = (command, args) =>
  Effect.sync(() => {
    commands.push(command);
    if (command === 'npm' && args[0] === 'view') return published;
    if (command === 'npm' && args[0] === 'install') {
      const target = args.at(-1) ?? '';
      installs.push(target);
      writePackage(
        join(
          args[args.indexOf('--prefix') + 1] ?? '',
          'node_modules',
          packageName,
        ),
        target.slice(`${packageName}@`.length),
      );
      return ok();
    }
    if (command === serviceNode) return ok();
    if (command === 'systemd-run') {
      handOffs.push([...args]);
      writeFileSync(
        updateRecordPath(),
        JSON.stringify({ ...updateRecord(), stage: 'installing' }),
      );
      finishUpdater();
      return ok();
    }
    if (command === 'systemctl') {
      if (activePolls === 0)
        return { code: 3, stdout: 'inactive\n', stderr: '' };
      activePolls -= 1;
      if (activePolls === 0) finishUpdater();
      return ok('active\n');
    }
    return { code: 1, stdout: '', stderr: `unexpected ${command}` };
  });

const update = Effect.fn('Test.updateToLatest')(function* (
  packageRoot: string = runtimePackage(),
  allowDowngrade: boolean = false,
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
    runner: fakeCommand,
    nodeExecutable: serviceNode,
  }).pipe(Effect.provide(NodeServices.layer));
  yield* Effect.addFinalizer(() => updates.close());
  return yield* updateToLatest(updates, {
    check: {
      now: '2026-10-09T12:00:00.000Z',
      staleBefore: '2026-10-09T12:00:00.000Z',
    },
    pollMs: 1,
    allowDowngrade,
    handingOff: (from, target) => handOffs.push(['announced', from, target]),
  });
});

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'porcelain-update-to-latest-'));
  mkdirSync(serviceRoot(), { recursive: true });
  published = ok(JSON.stringify('1.1.0'));
  updaterResult = { stage: 'updated' };
  activePolls = 0;
  installs = [];
  handOffs = [];
  commands = [];
  install('1.0.0');
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('updating the installed service to the newest published version', () => {
  it.effect(
    'rejects --allow-downgrade on the installed command before changing anything',
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(update(runtimePackage(), true));
        expect(error.message).toBe(
          '--allow-downgrade requires an exact version: run `npx @fabiofiorita/porcelain@<version> service update --allow-downgrade`.',
        );
        expect(installs).toEqual([]);
        expect(existsSync(updateRecordPath())).toBe(false);
      }),
  );

  it.effect(
    'leaves --allow-downgrade on a pinned CLI to the exact-version installer',
    () =>
      Effect.gen(function* () {
        const pinned = join(home, 'pinned');
        writePackage(pinned, '0.9.0');
        expect(yield* update(pinned, true)).toEqual({ kind: 'unmanaged' });
        expect(commands).toEqual([]);
      }),
  );

  it.each([
    { stage: 'missing' },
    { stage: 'invalid' },
    { stage: 'updated', target: '1.2.0' },
    { stage: 'updated', from: '0.8.0' },
  ] as const)('fails instead of reporting updated for %j', async (result) => {
    updaterResult = result;
    const error = await Effect.runPromise(
      Effect.scoped(update()).pipe(Effect.flip),
    );
    expect(error.message).toBe(
      'The update to Porcelain 1.1.0 failed: the updater left no record of this update.',
    );
  });

  it.effect('fails when an inactive updater leaves unfinished progress', () =>
    Effect.gen(function* () {
      updaterResult = { stage: 'installing' };
      const error = yield* Effect.flip(update());
      expect(error.message).toBe(
        'The update to Porcelain 1.1.0 failed: The update stopped before it finished',
      );
    }),
  );

  it.effect('reports failure even when the updater leaves no reason', () =>
    Effect.gen(function* () {
      updaterResult = { stage: 'failed' };
      const error = yield* Effect.flip(update());
      expect(error.message).toBe(
        'The update to Porcelain 1.1.0 failed: the updater gave no reason.',
      );
    }),
  );

  it.effect(
    'hands the update to the newer published version and waits until its updater finishes',
    () =>
      Effect.gen(function* () {
        expect(yield* update()).toEqual({
          kind: 'updated',
          from: '1.0.0',
          target: '1.1.0',
        });
        expect(installs).toEqual([`${packageName}@1.1.0`]);
        expect(handOffs[0]).toEqual(['announced', '1.0.0', '1.1.0']);
        expect(handOffs[1]?.slice(-4)).toEqual([
          serviceNode,
          join(
            serviceRoot(),
            'updater/node_modules',
            packageName,
            'bin/porcelain.js',
          ),
          'service',
          'update',
        ]);
        expect(installedVersion()).toEqual({ version: '1.1.0' });
        expect(updateRecord()).toEqual({
          from: '1.0.0',
          target: '1.1.0',
          stage: 'updated',
        });
      }).pipe(TestClock.withLive),
  );

  it.effect(
    'reports the installed version as current and changes nothing when it is the newest published',
    () =>
      Effect.gen(function* () {
        published = ok(JSON.stringify('1.0.0'));
        expect(yield* update()).toEqual({
          kind: 'current',
          version: '1.0.0',
          latest: '1.0.0',
        });
        expect(installs).toEqual([]);
        expect(commands).not.toContain('systemd-run');
        expect(existsSync(updateRecordPath())).toBe(false);
        expect(installedVersion()).toEqual({ version: '1.0.0' });
      }).pipe(TestClock.withLive),
  );

  it.effect(
    'never replaces the installed version with an older published one',
    () =>
      Effect.gen(function* () {
        published = ok(JSON.stringify('0.9.0'));
        expect(yield* update()).toEqual({
          kind: 'current',
          version: '1.0.0',
          latest: '0.9.0',
        });
        expect(installs).toEqual([]);
        expect(installedVersion()).toEqual({ version: '1.0.0' });
      }).pipe(TestClock.withLive),
  );

  it.effect(
    'leaves a CLI that runs outside the installed runtime, such as a pinned npx, to install its own version',
    () =>
      Effect.gen(function* () {
        const pinned = join(home, 'npx/node_modules', packageName);
        writePackage(pinned, '1.0.5');
        expect(yield* update(pinned)).toEqual({ kind: 'unmanaged' });
        expect(commands).not.toContain('npm');
        expect(commands).not.toContain('systemd-run');
      }).pipe(TestClock.withLive),
  );

  it.effect('fails with the updater’s own reason when the update fails', () =>
    Effect.gen(function* () {
      updaterResult = {
        stage: 'failed',
        reason: 'The updated service did not become healthy.',
      };
      const error = yield* Effect.flip(update());
      expect(error.message).toBe(
        'The update to Porcelain 1.1.0 failed: The updated service did not become healthy.',
      );
      expect(installedVersion()).toEqual({ version: '1.0.0' });
    }).pipe(TestClock.withLive),
  );

  it.effect(
    'changes nothing when npm cannot say which version is the newest',
    () =>
      Effect.gen(function* () {
        published = { code: 1, stdout: '', stderr: 'npm error offline' };
        const error = yield* Effect.flip(update());
        expect(error._tag).toBe('PublishedVersionUnknownError');
        expect(installs).toEqual([]);
        expect(existsSync(updateRecordPath())).toBe(false);
      }).pipe(TestClock.withLive),
  );

  it.effect('refuses to start while another update is running', () =>
    Effect.gen(function* () {
      activePolls = 1_000;
      const error = yield* Effect.flip(update());
      expect(error._tag).toBe('ServiceUpdateRunningError');
      expect(installs).toEqual([]);
      expect(commands).not.toContain('systemd-run');
    }).pipe(TestClock.withLive),
  );
});
