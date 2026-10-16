import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import type { Socket } from 'node:net';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { Schema } from 'effect';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { World } from '@porcelain/web/kit/world';
import { expect, inject } from 'vitest';
import {
  IsolatedServer,
  Recorder,
} from '@porcelain/server/kit/isolated-server';
import { test } from '@porcelain/server/kit/server-test';
import { record, text } from '@porcelain/server/kit/session';
import {
  captureProcess,
  processes,
  sameProcess,
} from '../../verify-core/processes.ts';

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, '../../../..');
const cli = join(root, '.agents/skills/server-verify/scripts/cli');
const registry = join(
  tmpdir(),
  'porcelain-verify',
  createHash('sha256').update(root).digest('hex').slice(0, 16),
  'server',
);

async function command(...args: string[]) {
  try {
    const result = await execute(cli, args, { cwd: root });
    return { code: 0, ...result };
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('stdout' in error) ||
      !('stderr' in error)
    )
      throw error;
    return {
      code: 1,
      stdout: String(error.stdout),
      stderr: String(error.stderr),
    };
  }
}

async function unansweredPeer(handle: { address: string; credential: string }) {
  return new Promise<Socket>((resolvePeer, rejectPeer) => {
    const opening = request(new URL('/api/live', handle.address), {
      headers: {
        authorization: `Bearer ${handle.credential}`,
        origin: handle.address,
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-version': '13',
        'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
      },
    });
    opening.once('upgrade', (_response, socket) => resolvePeer(socket));
    opening.once('response', (response) => {
      response.resume();
      rejectPeer(new Error(`Upgrade answered ${response.statusCode}`));
    });
    opening.once('error', rejectPeer);
    opening.end();
  });
}

async function sandboxOwner(projectHome: string) {
  const owned = processes().filter(
    (entry) =>
      entry.pid === entry.pgid &&
      entry.command.startsWith('/usr/bin/bwrap ') &&
      entry.command.includes(projectHome),
  );
  const parentRows = await execute('ps', [
    '-p',
    owned.map((entry) => entry.pid).join(','),
    '-o',
    'pid=',
    '-o',
    'ppid=',
  ]);
  const parents = new Map(
    parentRows.stdout
      .trim()
      .split('\n')
      .map((line) => {
        const [pid, parent] = line.trim().split(/\s+/).map(Number);
        return [pid, parent];
      }),
  );
  const outer = owned.filter(
    (entry) =>
      !owned.some((candidate) => candidate.pid === parents.get(entry.pid)),
  );
  expect(outer).toHaveLength(1);
  const child = outer[0];
  if (child === undefined || !sameProcess(child))
    throw new Error('The captured sandbox process is unavailable');
  return child;
}

for (const failed of [false, true])
  test.skipIf(failed && process.platform !== 'linux')(
    `server verification ${failed ? 'retains a failed child exit' : 'confirms normal shutdown'} through repeated stop`,
    async ({ onTestFinished }) => {
      const started = await command('start');
      expect(started.code, started.stderr).toBe(0);
      const id = /^instance (\S+)$/m.exec(started.stdout)?.[1];
      if (id === undefined) throw new Error('The server published no instance');
      const folder = join(registry, 'instances', id);
      const evidence = join(registry, 'evidence', id);
      onTestFinished(async () => {
        await command('stop', '--instance', id);
        await rm(folder, { recursive: true, force: true });
      });
      const instance = record(
        JSON.parse(await readFile(join(folder, 'instance.json'), 'utf8')),
      );
      const detail = record(instance.detail);
      const handle = await IsolatedServer.attach(text(detail.manifestPath));
      const recorder = new Recorder();
      const live = await handle.live(recorder);
      onTestFinished(() => live.close());
      expect(await live.next(() => true)).toEqual({ type: 'ready' });
      let stopping: ReturnType<typeof command> | undefined;
      if (failed) {
        const child = await sandboxOwner(handle.projectHome);
        const peer = await unansweredPeer(handle);
        onTestFinished(() => {
          peer.destroy();
        });
        const closeFrame = new Promise<Buffer>((resolveFrame) =>
          peer.once('data', resolveFrame),
        );
        stopping = command('stop', '--instance', id);
        const frame = await closeFrame;
        expect(Buffer.from(frame).subarray(0, 4)).toEqual(
          Buffer.from([0x88, 2, 3, 0xe9]),
        );
        process.kill(child.pid, 'SIGKILL');
        await expect.poll(() => sameProcess(child)).toBe(false);
      }
      const stopped = await (stopping ?? command('stop', '--instance', id));
      const repeated = await command('stop', '--instance', id);
      const outcome = record(
        JSON.parse(await readFile(join(evidence, 'stop-result.json'), 'utf8')),
      );
      expect(stopped.code, stopped.stderr).toBe(failed ? 1 : 0);
      expect(repeated.code, repeated.stderr).toBe(failed ? 1 : 0);
      expect(outcome.complete).toBe(!failed);
      if (failed) {
        expect(String(outcome.report)).toContain(
          'Isolated server exited with code 1 during shutdown',
        );
        expect(stopped.stdout).toContain(`stop incomplete for ${id}`);
        expect(stopped.stdout).not.toContain(`stopped ${id}\n`);
        expect(repeated.stdout).toContain(`stop incomplete for ${id}`);
        expect(repeated.stdout).not.toContain(`stopped ${id}\n`);
      }
      expect(captureProcess(Number(instance.pid))).toBeUndefined();
      expect(existsSync(handle.projectHome)).toBe(false);
      expect(
        processes().filter((entry) =>
          entry.command.includes(handle.projectHome),
        ),
      ).toEqual([]);
    },
  );

test('startup keeps its original failure and the failed cleanup outcome', async () => {
  const failure = await IsolatedServer.start(
    root,
    join(inject('serverBuild'), 'missing-build'),
  ).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(AggregateError);
  if (!(failure instanceof AggregateError))
    throw new Error('Expected both failures');
  expect(failure.errors).toHaveLength(2);
  expect(String(failure.errors[0])).toContain(
    'Isolated server exited before ready: 1',
  );
  expect(String(failure.errors[0])).toContain('missing-build');
  expect(String(failure.errors[1])).toContain(
    'Isolated server exited with code 1 during shutdown',
  );
  expect(failure.cause).toBe(failure.errors[0]);
  expect(failure.message).toContain(String(failure.errors[0]));
  expect(failure.message).toContain(String(failure.errors[1]));
});

test.skipIf(process.platform !== 'linux')(
  'web fixture waits for both real servers and retains both stop failures',
  async ({ onTestFinished }) => {
    const world = await World.start(root, inject('serverBuild'));
    onTestFinished(async () => {
      await world.stop().catch(() => undefined);
    });
    const remote = await world.pairingLink('Shutdown proof', 'remote');
    const paired = await fetch(new URL('/api/pair', remote.address), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: remote.code, platform: 'Verification' }),
    });
    expect(paired.status).toBe(200);
    const credential = text(record(await paired.json()).credential);
    const inventory = await world.read({
      server: 'remote',
      target: 'network',
      path: '/api/inventory',
    });
    expect(inventory.status).toBe(200);
    const repository = Schema.decodeUnknownSync(readInventoryResponseSchema)(
      inventory.body,
    ).projects[0]?.worktrees[0]?.path;
    if (repository === undefined)
      throw new Error('The remote fixture has no repository');
    const remoteHome = resolve(repository, '..');
    const localOwner = await sandboxOwner(world.server.projectHome);
    const remoteOwner = await sandboxOwner(remoteHome);
    const localPeer = await unansweredPeer(world.server);
    const remotePeer = await unansweredPeer({
      address: remote.address,
      credential,
    });
    onTestFinished(async () => {
      localPeer.destroy();
      remotePeer.destroy();
      await expect.poll(() => sameProcess(remoteOwner)).toBe(false);
    });
    const closing = (peer: Socket) =>
      new Promise<Buffer>((resolveFrame) => peer.once('data', resolveFrame));
    const localFrame = closing(localPeer);
    const remoteFrame = closing(remotePeer);
    let finished = false;
    const stopping = world.stop().finally(() => {
      finished = true;
    });
    void stopping.catch(() => undefined);
    expect((await localFrame)[0]).toBe(0x88);
    expect((await remoteFrame)[0]).toBe(0x88);
    process.kill(localOwner.pid, 'SIGKILL');
    const localFailure = await world.server
      .stop()
      .catch((error: unknown) => String(error));
    expect(localFailure).toBe(
      'Error: Isolated server exited with code 1 during shutdown',
    );
    expect(finished).toBe(false);
    process.kill(remoteOwner.pid, 'SIGKILL');
    await expect(stopping).resolves.toEqual([
      'Error: Isolated server exited with code 1 during shutdown',
      'Error: Isolated server exited with code 1 during shutdown',
    ]);
    const failures = await stopping;
    expect(await world.stop()).toEqual(failures);
    expect(existsSync(world.server.projectHome)).toBe(false);
    expect(existsSync(remoteHome)).toBe(false);
  },
);
