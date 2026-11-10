import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { Effect, DateTime, Layer, ManagedRuntime, Scope, Schema } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { storageLayer } from '@porcelain/storage';
import { SqlClient } from 'effect/sql';
import { DatabaseSync } from 'node:sqlite';
import { readWalkthroughResponseSchema } from '@porcelain/contracts/walkthroughs';
import { expect, vi } from 'vitest';
import { GitHubReader } from '@porcelain/reviews/ports';
import { composeServer } from '../../src/bootstrap/compose-server.ts';
import { readServerSettings } from '../../src/config/server-settings.ts';
import type { Runtime } from '../../src/ports/runtime.ts';
import { FixedNetworkAddressReader } from '../fakes/fixed-network-address-reader.ts';
import { InMemoryRouteListenerRunner } from '../fakes/in-memory-route-listener-runner.ts';
import { ScriptedServiceUpdateRunner } from '../fakes/scripted-service-update-runner.ts';
import { ScriptedTunnelProbe } from '../fakes/scripted-tunnel-probe.ts';
import { scratchFolder } from '../kit/sandbox.ts';
import { test } from '../kit/server-test.ts';
import { record, list, text } from '../kit/session.ts';

test('automatically handles an open PR once across restarts and new commits, drains its writer and preserves evidence after interruption', async () => {
  const root = await mkdtemp(
    join(scratchFolder(), 'porcelain-walkthrough-restart-'),
  );
  const repo = join(root, 'repository');
  const state = join(root, 'state');
  const bin = join(root, 'bin');
  await mkdir(bin);
  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  const git = (...args: string[]) =>
    execFileSync('git', [
      '-C',
      repo,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      ...args,
    ]);
  git('commit', '-qm', 'Initial', '--allow-empty');
  git('branch', 'walkthrough-base');
  git('switch', '-qc', 'topic');
  git('remote', 'add', 'origin', 'https://github.com/fixture/project.git');
  await writeFile(join(repo, 'change.txt'), 'A small change.\n');
  git('add', 'change.txt');
  git('commit', '-qm', 'Add change');
  await writeFile(
    join(bin, 'claude'),
    '#!/usr/bin/env node\n' +
      `require('fs').writeFileSync(${JSON.stringify(join(root, 'writer-started'))},String(process.pid));require('fs').appendFileSync(${JSON.stringify(join(root, 'writer-calls'))},'called'+String.fromCharCode(10));setInterval(()=>{},1000);`,
    { mode: 0o700 },
  );
  vi.stubEnv('PATH', `${bin}:${process.env.PATH ?? '/usr/bin:/bin'}`);
  let githubCalls = 0;
  let pullState: 'OPEN' | 'CLOSED' = 'CLOSED';
  const deviceId = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  const database = ManagedRuntime.make(
    storageLayer(state, { worktreeIdLength: 32, busyTimeoutMs: 5000 }).pipe(
      Layer.provide(NodeServices.layer),
    ),
  );
  try {
    await database.runPromise(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const now = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
        yield* sql`INSERT INTO devices (id, label, platform, secret_hash, created_at, last_seen_at, route, route_inferred, trusted, can_manage_sharing, can_edit_ways_in) VALUES (${deviceId}, 'Fixture', 'test', ${createHash('sha256').update(secret).digest('hex')}, ${now}, ${now}, 'loopback', 0, 0, 0, 0)`.pipe(
          Effect.orDie,
        );
      }),
    );
  } finally {
    await database.dispose();
  }
  const runtime = ManagedRuntime.make(
    Layer.merge(NodeServices.layer, Layer.effect(Scope.Scope, Effect.scope)),
  );
  let application: Runtime | undefined;
  const start = async () => {
    const launch = composeServer({
      githubReader: () =>
        Layer.succeed(GitHubReader, {
          accounts: () => Effect.succeed(['fixture']),
          canRead: () => Effect.succeed(true),
          read: () =>
            Effect.succeed({
              number: 42,
              title: 'Readable pull request',
              url: 'https://github.com/fixture/project/pull/42',
              state: 'OPEN' as const,
              isDraft: false,
              author: { login: 'fixture', avatarUrl: '' },
              headRefName: 'topic',
              updatedAt: '2026-11-09T00:00:00.000Z',
              commits: { nodes: [] },
              body: '',
              bodyHTML: '',
              baseRefName: 'main',
              headRefOid: git('rev-parse', 'HEAD').toString().trim(),
              mergeable: 'MERGEABLE',
              labels: { nodes: [], pageInfo: { hasNextPage: false } },
              comments: { nodes: [], pageInfo: { hasNextPage: false } },
              reviews: { nodes: [], pageInfo: { hasNextPage: false } },
            }),
          checks: () => Effect.die('No check read is needed'),
          list: () => {
            githubCalls++;
            const pull = {
              number: 42,
              title: 'Readable pull request',
              url: 'https://github.com/fixture/project/pull/42',
              state: pullState,
              isDraft: false,
              author: { login: 'fixture', avatarUrl: '' },
              headRefName: 'topic',
              updatedAt: '2026-11-09T00:00:00.000Z',
              commits: { nodes: [] },
            };
            return Effect.succeed({
              open: pullState === 'OPEN' ? [pull] : [],
              recent: pullState === 'CLOSED' ? [pull] : [],
              truncated: false,
            });
          },
        }),
      networkAddressReader: () => new FixedNetworkAddressReader([], []).layer,
      routeListenerRunner: () =>
        InMemoryRouteListenerRunner.layer(
          new InMemoryRouteListenerRunner(
            () => 0,
            () => 0,
          ),
        ),
      tunnelProbe: () =>
        new ScriptedTunnelProbe(() =>
          Effect.succeed({ kind: 'unreachable' as const }),
        ).layer,
    });
    application = await runtime.runPromise(
      launch(
        readServerSettings({
          dataDirectory: state,
          projectHome: root,
          port: 0,
        }),
        {
          version: undefined,
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
        },
      ),
    );
    return application;
  };
  const request = async (method: string, path: string, body?: object) => {
    if (!application) throw new Error('The fixture server is closed');
    const response = await fetch(application.address + path, {
      method,
      headers: {
        authorization: `Bearer pcd_${deviceId}_${secret}`,
        origin: application.address,
        'content-type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status !== 200)
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    return record(await response.json());
  };
  try {
    application = await start();
    const project = await request('POST', '/api/projects', { path: repo });
    const worktreeId = text(record(list(project.worktrees)[0]).id);
    const path = `/api/worktrees/${worktreeId}/walkthrough`;
    expect(githubCalls).toBe(0);
    await request(
      'PUT',
      `/api/projects/${text(project.id)}/walkthrough-settings`,
      { mode: 'automatic', provider: 'claude' },
    );
    await runtime.runPromise(application.close());
    application = await start();
    expect(
      Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
        await request('GET', path),
      ).walkthrough,
    ).toBeUndefined();
    await runtime.runPromise(application.close());
    application = undefined;
    pullState = 'OPEN';
    const watcher = watch(root);
    const started = new Promise<void>((resolve) =>
      watcher.on('change', (_event, name) => {
        if (name === 'writer-started') {
          watcher.close();
          resolve();
        }
      }),
    );
    try {
      application = await start();
      await started;
    } finally {
      watcher.close();
    }
    const before = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
      await request('GET', path),
    );
    expect(before.walkthrough?.state.status).toBe('running');
    expect(before.walkthrough?.pullRequestNumber).toBe(42);
    const image = Buffer.from('89504e470d0a1a0a', 'hex');
    const sql = new DatabaseSync(join(state, 'inventory.sqlite'));
    try {
      sql.exec('PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE');
      sql
        .prepare(
          'INSERT INTO walkthrough_evidence (run_id, asset_id, media_type, caption, bytes) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          before.walkthrough?.id ?? '',
          'fixture-image',
          'image/png',
          'Existing proof',
          image,
        );
      sql.exec('COMMIT');
    } finally {
      sql.close();
    }
    const pid = Number(await readFile(join(root, 'writer-started'), 'utf8'));
    if (application) await runtime.runPromise(application.close());
    application = undefined;
    expect(() => process.kill(pid, 0)).toThrow();
    application = await start();
    const after = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
      await request('GET', path),
    );
    expect(after.walkthrough?.id).toBe(before.walkthrough?.id);
    expect(after.walkthrough?.state).toEqual({
      status: 'failed',
      failure: {
        kind: 'other',
        message:
          'The server stopped while this walkthrough was running. The interrupted writer was not restarted.',
      },
    });
    expect(after.outOfDate).toBe(false);
    if (!application) throw new Error('The restarted server is unavailable');
    const asset = await fetch(
      application.address +
        `${path}/${after.walkthrough?.id}/assets/fixture-image`,
      {
        headers: {
          authorization: `Bearer pcd_${deviceId}_${secret}`,
          origin: application.address,
        },
      },
    );
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await asset.arrayBuffer())).toEqual(image);
    await runtime.runPromise(application.close());
    application = undefined;
    git('commit', '-qm', 'A later commit', '--allow-empty');
    application = await start();
    const changed = Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
      await request('GET', path),
    );
    expect(changed.walkthrough?.id).toBe(before.walkthrough?.id);
    expect(changed.outOfDate).toBe(true);
    expect(
      (await readFile(join(root, 'writer-calls'), 'utf8')).trim().split('\n'),
    ).toEqual(['called']);
  } finally {
    if (application) await runtime.runPromise(application.close());
    await runtime.dispose();
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  }
});
