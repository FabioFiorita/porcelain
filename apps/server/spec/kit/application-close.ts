import { NodeServices } from '@effect/platform-node';
import { PorcelainClientApi } from '@porcelain/contracts/shared';
import { nativeOperation } from '@porcelain/effects';
import { Effect, Layer, ManagedRuntime, Scope } from 'effect';
import { FetchHttpClient, HttpClient, HttpClientRequest } from 'effect/http';
import { HttpApiClient } from 'effect/http-api';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Socket } from 'node:net';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { vi } from 'vitest';
import { composeServer } from '../../src/bootstrap/compose-server.ts';
import { readServerSettings } from '../../src/config/server-settings.ts';
import type { Runtime } from '../../src/ports/runtime.ts';
import { FixedNetworkAddressReader } from '../fakes/fixed-network-address-reader.ts';
import { ScriptedServiceUpdateRunner } from '../fakes/scripted-service-update-runner.ts';
import { scratchFolder } from './sandbox.ts';

const execute = promisify(execFile);
const SECOND_CLOSE_WINDOW_MS = 200;
const DRAIN_BOUND_MS = 10_000;

export type CloseRunningCommit = {
  duringDrain: readonly string[];
  hookRunningDuringDrain: boolean;
  drained: 'closed' | 'still closing';
  hookRunningWhenSettled: boolean;
  beforeCloseReturned: readonly string[];
  closeReturned: readonly string[];
  persistence: readonly { receipt: unknown; hookRunning: boolean }[];
  headCount: string;
  restarted:
    | { requestId: string; state: string; reason: string | undefined }
    | undefined;
};

function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function storedReceipt(database: DatabaseSync, requestId: string) {
  return database
    .prepare(
      'SELECT state, reason FROM git_action_receipts WHERE request_id = ?',
    )
    .get(requestId);
}

function savedClose(): (database: DatabaseSync) => void {
  const value: unknown = Object.getOwnPropertyDescriptor(
    DatabaseSync.prototype,
    'close',
  )?.value;
  if (typeof value !== 'function')
    throw new Error('DatabaseSync.close is not a prototype method');
  return (database) => {
    Reflect.apply(value, database, []);
  };
}

export async function closeRunningCommit(): Promise<CloseRunningCommit> {
  const root = realpathSync(
    await mkdtemp(join(scratchFolder(), 'porcelain-close-')),
  );
  const repository = join(root, 'repository');
  const state = join(root, 'state');
  const gatePath = join(root, 'hook.sock');
  const hookStarted = Promise.withResolvers<number>();
  const routeDraining = Promise.withResolvers<void>();
  const routeReleased = Promise.withResolvers<void>();
  const requestId = randomUUID();
  const credential = randomUUID();
  const events: string[] = [];
  let closing = false;
  let hookPid = 0;
  let hookSocket: Socket | undefined;
  const persistence: { receipt: unknown; hookRunning: boolean }[] = [];
  const closeDatabase = savedClose();
  const databaseClosed = vi
    .spyOn(DatabaseSync.prototype, 'close')
    .mockImplementation(function (this: DatabaseSync) {
      try {
        if (closing) {
          events.push('persistence-closed');
          persistence.push({
            receipt: storedReceipt(this, requestId),
            hookRunning: running(hookPid),
          });
        }
      } finally {
        closeDatabase(this);
      }
    });
  const gate = createServer((socket) => {
    hookSocket = socket;
    socket.once('data', (pid) => hookStarted.resolve(Number(pid.toString())));
  });
  const runtime = ManagedRuntime.make(
    Layer.merge(NodeServices.layer, Layer.effect(Scope.Scope, Effect.scope)),
  );
  let application: Runtime | undefined;
  let first: Promise<void> | undefined;
  let second: Promise<void> | undefined;
  const git = (...args: string[]) =>
    execute('git', args, {
      cwd: repository,
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
      },
    });
  const start = composeServer({
    networkAddressReader: () => new FixedNetworkAddressReader([], []),
    routeListenerRunner: () => ({
      listen: () => Effect.die(new Error('No remote listener requested')),
      close: ({ route }) =>
        closing && route === 'lan' && !events.includes('lan-route-closing')
          ? nativeOperation(async () => {
              events.push('lan-route-closing');
              routeDraining.resolve();
              await routeReleased.promise;
              events.push('lan-route-closed');
            })
          : Effect.void,
    }),
    tunnelProbe: () => ({
      probe: () => Effect.succeed({ kind: 'unreachable' as const }),
    }),
  });
  const host = {
    version: undefined,
    desktopSession: {
      deviceId: randomUUID(),
      secretHash: createHash('sha256').update(credential).digest('hex'),
    },
    serviceUpdateRunner: new ScriptedServiceUpdateRunner(
      {
        managed: false,
        version: undefined,
        latest: undefined,
        available: false,
        running: false,
        last: undefined,
      },
      [],
      0,
    ),
  };
  const open = async () => {
    const opened = await runtime.runPromise(
      start(
        readServerSettings({
          dataDirectory: state,
          projectHome: root,
          port: 0,
        }),
        new AbortController().signal,
        host,
      ),
    );
    const api = await runtime.runPromise(
      HttpApiClient.make(PorcelainClientApi, {
        baseUrl: opened.address,
        transformClient: (client) =>
          HttpClient.mapRequest(
            client,
            HttpClientRequest.setHeader(
              'authorization',
              `Bearer ${credential}`,
            ),
          ),
      }).pipe(Effect.provide(FetchHttpClient.layer)),
    );
    return { opened, api };
  };
  try {
    await mkdir(repository);
    await git('init', '-b', 'main');
    await git('config', 'user.name', 'Porcelain Test');
    await git('config', 'user.email', 'test@example.invalid');
    await git('config', 'commit.gpgsign', 'false');
    await writeFile(join(repository, 'note.txt'), 'Initial note\n');
    await git('add', 'note.txt');
    await git('commit', '-m', 'Initial commit');
    await new Promise<void>((resolve, reject) => {
      gate.once('error', reject);
      gate.listen(gatePath, resolve);
    });
    const { opened, api } = await open();
    application = opened;
    const project = await runtime.runPromise(
      api.projects.registerProject({ payload: { path: repository } }),
    );
    const worktree = project.worktrees[0];
    if (!worktree) throw new Error('The registered repository has no worktree');
    await writeFile(
      join(repository, 'note.txt'),
      'Changed note for shutdown\n',
    );
    const changes = await runtime.runPromise(
      api.changes.readChanges({ params: { worktreeId: worktree.id } }),
    );
    const change = changes.changes.find((entry) => entry.path === 'note.txt');
    if (!change?.fingerprint) throw new Error('The note has no fingerprint');
    const hook = join(repository, '.git', 'hooks', 'pre-commit');
    await writeFile(
      hook,
      `#!${process.execPath}\nconst socket = require('node:net').connect(${JSON.stringify(gatePath)}, () => socket.write(String(process.pid)));\nsetInterval(() => {}, 60000);\n`,
    );
    await chmod(hook, 0o700);
    const accepted = await runtime.runPromise(
      api.gitActions.runGitAction({
        params: { worktreeId: worktree.id },
        payload: {
          requestId,
          input: {
            action: 'commit',
            message: 'Keep the changed note',
            paths: ['note.txt'],
          },
          expected: {
            headOid: changes.headOid,
            branch: 'main',
            inProgress: undefined,
            mergeHeadOid: undefined,
            files: [{ path: 'note.txt', fingerprint: change.fingerprint }],
          },
        },
      }),
    );
    if (!('state' in accepted) || accepted.state !== 'running')
      throw new Error('The commit was not accepted as running');
    hookPid = await Promise.race([
      hookStarted.promise,
      delay(5_000).then(() => {
        throw new Error('The commit hook did not reach the gate');
      }),
    ]);
    if (!running(hookPid)) throw new Error('The commit hook exited early');

    closing = true;
    first = runtime
      .runPromise(opened.close())
      .then(() => void events.push('first-close-returned'));
    await routeDraining.promise;
    second = runtime
      .runPromise(opened.close())
      .then(() => void events.push('second-close-returned'));
    await delay(SECOND_CLOSE_WINDOW_MS);
    const duringDrain = [...events];
    const hookRunningDuringDrain = running(hookPid);
    routeReleased.resolve();
    const drained = await Promise.race([
      Promise.all([first, second]).then(() => 'closed' as const),
      delay(DRAIN_BOUND_MS).then(() => 'still closing' as const),
    ]);
    const hookRunningWhenSettled = running(hookPid);
    const settled = [...events];
    const observedPersistence = persistence.map((entry) => ({ ...entry }));
    application = drained === 'closed' ? undefined : application;
    closing = false;
    const headCount =
      drained === 'closed'
        ? (await git('rev-list', '--count', 'HEAD')).stdout
        : '';
    let restarted: CloseRunningCommit['restarted'];
    if (drained === 'closed') {
      const again = await open();
      application = again.opened;
      const receipt = await runtime.runPromise(
        again.api.gitActions.readGitActionReceipt({
          params: { worktreeId: worktree.id, requestId },
        }),
      );
      restarted = {
        requestId: receipt.requestId,
        state: receipt.state,
        reason: 'reason' in receipt ? receipt.reason : undefined,
      };
    }
    return {
      duringDrain,
      hookRunningDuringDrain,
      drained,
      hookRunningWhenSettled,
      beforeCloseReturned: settled.slice(0, 3),
      closeReturned: settled.slice(3).toSorted(),
      persistence: observedPersistence,
      headCount,
      restarted,
    };
  } finally {
    closing = false;
    routeReleased.resolve();
    hookSocket?.destroy();
    try {
      if (hookPid !== 0 && running(hookPid)) process.kill(hookPid, 'SIGKILL');
    } catch {
      hookPid = 0;
    }
    await Promise.allSettled([first, second]);
    if (application) await runtime.runPromise(application.close());
    await runtime.dispose();
    databaseClosed.mockRestore();
    await new Promise<void>((resolve) => gate.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
}
