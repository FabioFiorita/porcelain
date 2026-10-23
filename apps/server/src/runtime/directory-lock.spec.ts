import { NodeServices } from '@effect/platform-node';
import { testClock } from '@porcelain/kernel/test-kit';
import {
  Context,
  Deferred,
  Effect,
  Exit,
  FileSystem,
  Layer,
  Schema,
  Scope,
} from 'effect';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { acquireDirectoryLock, directoryLockIsHeld } from './directory-lock.ts';

class HeldError extends Error {}

const roots: string[] = [];
const scopes: Scope.Closeable[] = [];
function takeLock(
  input: Parameters<typeof acquireDirectoryLock>[0],
  fileSystem: (fs: FileSystem.FileSystem) => FileSystem.FileSystem = (fs) => fs,
) {
  const scope = Effect.runSync(Scope.make());
  scopes.push(scope);
  return Effect.runPromise(
    Effect.gen(function* () {
      const services = yield* Layer.build(NodeServices.layer);
      return yield* acquireDirectoryLock(input).pipe(
        Effect.provideService(
          FileSystem.FileSystem,
          fileSystem(Context.get(services, FileSystem.FileSystem)),
        ),
        Effect.provideContext(services),
      );
    }).pipe(Scope.provide(scope)),
  );
}

function lockPath(): string {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-lock-'));
  roots.push(root);
  return join(root, 'server.lock');
}

async function options(path: string, waitMs = 0) {
  const clock = await testClock('2026-09-24T00:00:00.000Z');
  return {
    path,
    waitMs,
    pollMs: 5,
    staleTakeovers: 3,
    clock,
    held: () => new HeldError(),
  };
}

function leaveLock(path: string, pid: number): void {
  mkdirSync(path);
  writeFileSync(
    join(path, 'owner.json'),
    JSON.stringify({ pid, token: 'left' }),
  );
}

afterEach(async () => {
  for (const scope of scopes.splice(0))
    await Effect.runPromise(Scope.close(scope, Exit.void));
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe('acquireDirectoryLock', () => {
  it('refuses with the held error while a live process holds the lock', async () => {
    const path = lockPath();
    await takeLock(await options(path));
    await expect(takeLock(await options(path))).rejects.toThrow(HeldError);
  });

  it('takes over a lock whose owner is no longer running', async () => {
    const path = lockPath();
    const exited = spawnSync(process.execPath, ['-e', '']).pid;
    leaveLock(path, exited);
    const lock = await takeLock(await options(path));
    await Effect.runPromise(lock.release);
    expect(existsSync(path)).toBe(false);
  });

  it('keeps concurrent stale takeover exclusive across ownership replacement', async () => {
    const path = lockPath();
    const exited = spawnSync(process.execPath, ['-e', '']).pid;
    leaveLock(path, exited);
    const removing = Effect.runSync(Deferred.make<void>());
    const resume = Effect.runSync(Deferred.make<void>());
    const input = { ...(await options(path)), pollMs: 1 };
    const pause = Effect.gen(function* () {
      yield* Deferred.succeed(removing, undefined);
      yield* Deferred.await(resume);
    });
    const contender = takeLock(input, (fs) => ({
      ...fs,
      remove: (target, settings) =>
        target === path
          ? pause.pipe(Effect.andThen(fs.remove(target, settings)))
          : fs.remove(target, settings),
      rename: (source, target) =>
        target === join(path, 'owner.json')
          ? pause.pipe(Effect.andThen(fs.rename(source, target)))
          : fs.rename(source, target),
    }));
    const outcome = contender.then(
      () => 'acquired',
      (error: unknown) => error,
    );
    try {
      await Effect.runPromise(
        Deferred.await(removing).pipe(Effect.timeout('2 seconds')),
      );
      const replacement = await takeLock(input).then(
        () => 'acquired',
        (error: unknown) => error,
      );
      const owner = readFileSync(join(path, 'owner.json'), 'utf8');
      await Effect.runPromise(Deferred.succeed(resume, undefined));
      const delayed = await outcome;
      expect(
        [replacement, delayed].filter((result) => result === 'acquired'),
      ).toHaveLength(1);
      if (replacement === 'acquired') {
        expect(delayed).toBeInstanceOf(HeldError);
        expect(readFileSync(join(path, 'owner.json'), 'utf8')).toBe(owner);
      } else {
        expect(replacement).toBeInstanceOf(HeldError);
        expect(delayed).toBe('acquired');
      }
    } finally {
      await Effect.runPromise(Deferred.succeed(resume, undefined));
      await outcome;
    }
  });

  it.each(['same directory', 'replacement directory'])(
    'rechecks ownership inside exclusion after observing a stale %s',
    async (replacement) => {
      const path = lockPath();
      const exited = spawnSync(process.execPath, ['-e', '']).pid;
      leaveLock(path, exited);
      const observed = Effect.runSync(Deferred.make<void>());
      const resume = Effect.runSync(Deferred.make<void>());
      let paused = false;
      const input = await options(path);
      const contender = takeLock(input, (fs) => ({
        ...fs,
        stat: (target) =>
          Effect.gen(function* () {
            const info = yield* fs.stat(target);
            if (target === path && !paused) {
              paused = true;
              yield* Deferred.succeed(observed, undefined);
              yield* Deferred.await(resume);
            }
            return info;
          }),
      })).then(
        () => 'acquired',
        (error: unknown) => error,
      );
      try {
        await Effect.runPromise(
          Deferred.await(observed).pipe(Effect.timeout('2 seconds')),
        );
        const first = await takeLock(input);
        if (replacement === 'replacement directory') {
          await Effect.runPromise(first.release);
          await takeLock(input);
        }
        const owner = readFileSync(join(path, 'owner.json'), 'utf8');
        await Effect.runPromise(Deferred.succeed(resume, undefined));
        expect(await contender).toBeInstanceOf(HeldError);
        expect(readFileSync(join(path, 'owner.json'), 'utf8')).toBe(owner);
      } finally {
        await Effect.runPromise(Deferred.succeed(resume, undefined));
        await contender;
      }
    },
  );

  it('preserves stale ownership when takeovers are disabled', async () => {
    const path = lockPath();
    const exited = spawnSync(process.execPath, ['-e', '']).pid;
    leaveLock(path, exited);
    const before = readFileSync(join(path, 'owner.json'), 'utf8');
    await expect(
      takeLock({ ...(await options(path)), staleTakeovers: 0 }),
    ).rejects.toThrow(HeldError);
    expect(readFileSync(join(path, 'owner.json'), 'utf8')).toBe(before);
    expect(readdirSync(path)).toEqual(['owner.json']);
  });

  it('preserves stale ownership when the exclusion file cannot be opened', async () => {
    const path = lockPath();
    const exited = spawnSync(process.execPath, ['-e', '']).pid;
    leaveLock(path, exited);
    const before = readFileSync(join(path, 'owner.json'), 'utf8');
    mkdirSync(join(path, 'ownership.sqlite'));
    await expect(takeLock(await options(path))).rejects.toThrow(
      'withOwnershipExclusion',
    );
    expect(readFileSync(join(path, 'owner.json'), 'utf8')).toBe(before);
  });

  it('retries an exclusion open failure when its directory has been replaced', async () => {
    const path = lockPath();
    const exited = spawnSync(process.execPath, ['-e', '']).pid;
    leaveLock(path, exited);
    let replaced = false;
    await expect(
      takeLock(await options(path), (fs) => ({
        ...fs,
        stat: (target) =>
          Effect.gen(function* () {
            const info = yield* fs.stat(target);
            if (target === path && !replaced) {
              replaced = true;
              renameSync(path, `${path}.retired`);
              leaveLock(path, process.pid);
              mkdirSync(join(path, 'ownership.sqlite'));
            }
            return info;
          }),
      })),
    ).rejects.toThrow(HeldError);
    expect(readFileSync(join(path, 'owner.json'), 'utf8')).toBe(
      JSON.stringify({ pid: process.pid, token: 'left' }),
    );
  });

  it('retries when the observed lock disappears before exclusion opens', async () => {
    const path = lockPath();
    const exited = spawnSync(process.execPath, ['-e', '']).pid;
    leaveLock(path, exited);
    let removed = false;
    const lock = await takeLock(await options(path, 250), (fs) => ({
      ...fs,
      stat: (target) =>
        Effect.gen(function* () {
          const info = yield* fs.stat(target);
          if (target === path && !removed) {
            removed = true;
            rmSync(path, { recursive: true, force: true });
          }
          return info;
        }),
    }));
    expect(await held(path)).toBe(true);
    await Effect.runPromise(lock.release);
    expect(existsSync(path)).toBe(false);
  });

  it.each(['missing', '{broken', '{}'])(
    'reclaims %s ownership and keeps the owner record compatible with older readers',
    async (record) => {
      const path = lockPath();
      mkdirSync(path);
      if (record !== 'missing') writeFileSync(join(path, 'owner.json'), record);
      const lock = await takeLock(await options(path));
      const owner = Schema.decodeUnknownSync(
        Schema.fromJsonString(
          Schema.Struct({
            pid: Schema.Int,
            token: Schema.String,
            createdAt: Schema.String,
            bootId: Schema.optional(Schema.String),
            startTime: Schema.optional(Schema.String),
          }),
        ),
      )(readFileSync(join(path, 'owner.json'), 'utf8'));
      expect(owner.pid).toBe(process.pid);
      expect(owner.token).not.toBe('left');
      expect(owner.createdAt).toBe('2026-09-24T00:00:00.000Z');
      expect(await held(path)).toBe(true);
      rmSync(path, { recursive: true, force: true });
      await Effect.runPromise(lock.release);
      expect(existsSync(path)).toBe(false);
    },
  );

  it('waits for a holder that releases within the wait', async () => {
    const path = lockPath();
    const first = await takeLock(await options(path));
    const second = takeLock(await options(path, 500));
    await Effect.runPromise(first.release);
    await expect(second).resolves.toBeDefined();
    expect(existsSync(path)).toBe(true);
  });

  it('never removes a lock another holder took after it', async () => {
    const path = lockPath();
    const first = await takeLock(await options(path));
    rmSync(path, { recursive: true, force: true });
    const second = await takeLock(await options(path));
    await Effect.runPromise(first.release);
    expect(existsSync(path)).toBe(true);
    await Effect.runPromise(second.release);
  });
});

const held = (path: string) =>
  Effect.runPromise(
    directoryLockIsHeld(path).pipe(Effect.provide(NodeServices.layer)),
  );

it('reads an absent lock without creating a directory or claiming ownership', async () => {
  const path = lockPath();
  expect(await held(path)).toBe(false);
  expect(existsSync(path)).toBe(false);
});

it('reads live ownership concurrently without changing it and reports release', async () => {
  const path = lockPath();
  const lock = await takeLock(await options(path));
  const before = readFileSync(join(path, 'owner.json'), 'utf8');
  expect(await Promise.all([held(path), held(path), held(path)])).toEqual([
    true,
    true,
    true,
  ]);
  expect(readFileSync(join(path, 'owner.json'), 'utf8')).toBe(before);
  expect(readdirSync(path)).toEqual(['owner.json']);
  await Effect.runPromise(lock.release);
  expect(await held(path)).toBe(false);
});

it('reports an exited owner as inactive without deleting its stale lock', async () => {
  const path = lockPath();
  const exited = spawnSync(process.execPath, ['-e', '']).pid;
  leaveLock(path, exited);
  const before = readFileSync(join(path, 'owner.json'), 'utf8');
  expect(await held(path)).toBe(false);
  expect(readFileSync(join(path, 'owner.json'), 'utf8')).toBe(before);
});

it.each([
  'missing',
  '{broken',
  '{}',
  '{"pid":"wrong","token":"left"}',
  '{"pid":1}',
])(
  'reports %s ownership as inactive without taking the lock',
  async (record) => {
    const path = lockPath();
    mkdirSync(path);
    if (record !== 'missing') writeFileSync(join(path, 'owner.json'), record);
    expect(await held(path)).toBe(false);
    expect(readdirSync(path)).toEqual(
      record === 'missing' ? [] : ['owner.json'],
    );
    if (record !== 'missing')
      expect(readFileSync(join(path, 'owner.json'), 'utf8')).toBe(record);
  },
);

it.each(['bootId', 'startTime'] as const)(
  'reclaims a lock when the live PID has a different %s',
  async (field) => {
    const path = lockPath();
    await takeLock(await options(path));
    const ownerPath = join(path, 'owner.json');
    const owner = Schema.decodeUnknownSync(
      Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
    )(readFileSync(ownerPath, 'utf8'));
    writeFileSync(
      ownerPath,
      JSON.stringify({ ...owner, [field]: 'a different process' }),
    );
    if (process.platform !== 'linux') {
      expect(await held(path)).toBe(true);
      await expect(takeLock(await options(path))).rejects.toThrow(HeldError);
      return;
    }
    expect(await held(path)).toBe(false);
    const replacement = await takeLock(await options(path));
    expect(await held(path)).toBe(true);
    await Effect.runPromise(replacement.release);
    expect(existsSync(path)).toBe(false);
  },
);

it('preserves a live lock written before process fingerprints were recorded', async () => {
  const path = lockPath();
  leaveLock(path, process.pid);
  const before = readFileSync(join(path, 'owner.json'), 'utf8');
  expect(await held(path)).toBe(true);
  await expect(takeLock(await options(path))).rejects.toThrow(HeldError);
  expect(readFileSync(join(path, 'owner.json'), 'utf8')).toBe(before);
});
