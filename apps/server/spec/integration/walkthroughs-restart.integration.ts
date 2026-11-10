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

async function automaticFixture(
  onTestFinished: (cleanup: () => Promise<void>) => void,
  holdWriter = false,
) {
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
  git('switch', '-qc', 'release/fixture');
  git('commit', '-qm', 'Release base', '--allow-empty');
  const targetBaseOid = git('rev-parse', 'HEAD').toString().trim();
  git('switch', '-qc', 'topic');
  git('remote', 'add', 'origin', 'https://github.com/fixture/project.git');
  await writeFile(join(repo, 'change.txt'), 'A small change.\n');
  git('add', 'change.txt');
  git('commit', '-qm', 'Add change');
  await writeFile(
    join(bin, 'claude'),
    '#!/usr/bin/env node\n' +
      `if(process.argv[2]==='auth'){console.log(JSON.stringify({loggedIn:true}));process.exit(0)}require('fs').writeFileSync(${JSON.stringify(join(root, 'writer-started'))},String(process.pid));require('fs').appendFileSync(${JSON.stringify(join(root, 'writer-calls'))},'called'+String.fromCharCode(10));${holdWriter ? 'setInterval(()=>{},1000);' : "console.error('Fixture writer failed');process.exit(1);"}`,
    { mode: 0o700 },
  );
  vi.stubEnv('PATH', `${bin}:${process.env.PATH ?? '/usr/bin:/bin'}`);
  let githubCalls = 0;
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
  const watcher = watch(root);
  const writerStarted = new Promise<void>((resolve) =>
    watcher.on('change', (_event, name) => {
      if (name === 'writer-started') {
        watcher.close();
        resolve();
      }
    }),
  );
  const stop = async () => {
    if (application) await runtime.runPromise(application.close());
    application = undefined;
  };
  onTestFinished(async () => {
    watcher.close();
    try {
      await stop();
    } finally {
      await runtime.dispose();
      vi.unstubAllEnvs();
      await rm(root, { recursive: true, force: true });
    }
  });
  const pull = {
    number: 42,
    title: 'Readable pull request',
    url: 'https://github.com/fixture/project/pull/42',
    state: 'OPEN' as const,
    isDraft: false,
    author: { login: 'fixture', avatarUrl: '' },
    headRefName: 'topic',
    baseRefName: 'release/fixture',
    updatedAt: '2026-11-09T00:00:00.000Z',
    commits: { nodes: [] },
  };
  const start = async () => {
    const launch = composeServer({
      githubReader: () =>
        Layer.succeed(GitHubReader, {
          accounts: () => Effect.succeed(['fixture']),
          canRead: () => Effect.succeed(true),
          read: () =>
            Effect.succeed({
              ...pull,
              body: '',
              bodyHTML: '',
              headRefOid: git('rev-parse', 'HEAD').toString().trim(),
              mergeable: 'MERGEABLE',
              labels: { nodes: [], pageInfo: { hasNextPage: false } },
              comments: { nodes: [], pageInfo: { hasNextPage: false } },
              reviews: { nodes: [], pageInfo: { hasNextPage: false } },
            }),
          checks: () => Effect.die('No check read is needed'),
          list: () => {
            githubCalls++;
            return Effect.succeed({
              open: [pull],
              recent: [],
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

  await start();
  const project = await request('POST', '/api/projects', { path: repo });
  const worktreeId = text(record(list(project.worktrees)[0]).id);
  const path = `/api/worktrees/${worktreeId}/walkthrough`;
  await request('PUT', '/api/walkthrough-settings', {
    provider: 'claude',
    model: 'claude-opus-5-5',
    effort: 'low',
  });
  await request(
    'PUT',
    `/api/projects/${text(project.id)}/walkthrough-settings`,
    { mode: 'automatic' },
  );
  return {
    root,
    state,
    targetBaseOid,
    git,
    path,
    writerStarted,
    githubCalls: () => githubCalls,
    read: async () =>
      Schema.decodeUnknownSync(readWalkthroughResponseSchema)(
        await request('GET', path),
      ),
    restart: async () => {
      await stop();
      await start();
    },
    stop,
    fetch: (suffix: string, signal?: AbortSignal) => {
      if (!application) throw new Error('The fixture server is closed');
      return fetch(application.address + suffix, {
        headers: {
          authorization: `Bearer pcd_${deviceId}_${secret}`,
          origin: application.address,
        },
        ...(signal === undefined ? {} : { signal }),
      });
    },
    writerCalls: async () =>
      (await readFile(join(root, 'writer-calls'), 'utf8')).trim().split('\n'),
  };
}

test('pins an automatic walkthrough to the pull request target branch and inherited writer', async ({
  onTestFinished,
}) => {
  const fixture = await automaticFixture(onTestFinished);
  await fixture.restart();
  await fixture.writerStarted;
  expect((await fixture.read()).walkthrough).toMatchObject({
    pullRequestNumber: 42,
    baseOid: fixture.targetBaseOid,
    writer: { provider: 'claude', model: 'claude-opus-5-5', effort: 'low' },
  });
});

test('answers inventory while an automatic walkthrough writer is still running', async ({
  onTestFinished,
}) => {
  const fixture = await automaticFixture(onTestFinished, true);
  await fixture.restart();
  await fixture.writerStarted;
  expect((await fixture.read()).walkthrough?.state.status).toBe('running');
  const status = await fixture
    .fetch('/api/inventory', AbortSignal.timeout(1500))
    .then(
      (response) => response.status,
      () => 'blocked by the running writer',
    );
  expect(status).toBe(200);
});

test('recovers an interrupted automatic walkthrough without losing evidence and drains its writer', async ({
  onTestFinished,
}) => {
  const fixture = await automaticFixture(onTestFinished, true);
  await fixture.restart();
  await fixture.writerStarted;
  const before = await fixture.read();
  const image = Buffer.from('89504e470d0a1a0a', 'hex');
  const sql = new DatabaseSync(join(fixture.state, 'inventory.sqlite'));
  try {
    sql.exec('PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE');
    sql
      .prepare(
        'INSERT INTO walkthrough_evidence (run_id,asset_id,media_type,caption,bytes) VALUES (?,?,?,?,?)',
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
  const pid = Number(
    await readFile(join(fixture.root, 'writer-started'), 'utf8'),
  );
  await fixture.stop();
  expect(() => process.kill(pid, 0)).toThrow();
  await fixture.restart();
  const after = await fixture.read();
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
  const asset = await fixture.fetch(
    `${fixture.path}/${after.walkthrough?.id}/assets/fixture-image`,
  );
  expect(asset.status).toBe(200);
  expect(asset.headers.get('content-type')).toBe('image/png');
  expect(Buffer.from(await asset.arrayBuffer())).toEqual(image);
  expect(await fixture.writerCalls()).toEqual(['called']);
});

test('keeps a failed automatic PR handled across repeated startup polls and later commits', async ({
  onTestFinished,
}) => {
  const fixture = await automaticFixture(onTestFinished);
  await fixture.restart();
  await fixture.writerStarted;
  await expect
    .poll(async () => (await fixture.read()).walkthrough?.state.status, {
      timeout: 10000,
    })
    .toBe('failed');
  const before = await fixture.read();
  await fixture.restart();
  expect((await fixture.read()).walkthrough?.id).toBe(before.walkthrough?.id);
  await fixture.stop();
  fixture.git('commit', '-qm', 'A later commit', '--allow-empty');
  await fixture.restart();
  const changed = await fixture.read();
  expect(changed.walkthrough?.id).toBe(before.walkthrough?.id);
  expect(changed.outOfDate).toBe(true);
  expect(await fixture.writerCalls()).toEqual(['called']);
  expect(fixture.githubCalls()).toBeGreaterThanOrEqual(3);
});
