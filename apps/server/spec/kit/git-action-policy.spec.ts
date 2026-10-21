import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { readServerSettings } from '../../src/config/server-settings.ts';
import { IsolatedServer, Recorder } from './isolated-server.ts';
import { expectation, fingerprintOf, settledReceipt } from './reads.ts';
import { gitPath } from './requests.ts';
import { temporaryServerBuild } from './sandbox.ts';

const root = resolve(import.meta.dirname, '../../../..');
let build: Awaited<ReturnType<typeof temporaryServerBuild>>;
beforeAll(async () => {
  build = await temporaryServerBuild();
});
afterAll(async () => {
  await build?.remove();
});

it.each([
  {
    name: 'absent sample',
    sample: undefined,
    ambient: '',
    deadline: 120000,
    version: '1.0.0',
    available: true,
  },
  {
    name: 'ambient interruption cannot opt in',
    sample: undefined,
    ambient: 'git-interruption',
    deadline: 120000,
    version: '1.0.0',
    available: true,
  },
  {
    name: 'unknown ambient sample',
    sample: undefined,
    ambient: 'unknown',
    deadline: 120000,
    version: '1.0.0',
    available: true,
  },
  {
    name: 'service-ahead',
    sample: 'service-ahead' as const,
    ambient: '',
    deadline: 120000,
    version: '2.0.0',
    available: false,
  },
  {
    name: 'explicit interruption',
    sample: 'git-interruption' as const,
    ambient: '',
    deadline: 1500,
    version: '1.0.0',
    available: true,
  },
])(
  '$name publishes the effective policy and still commits real Git',
  async ({ sample, ambient, deadline, version, available }) => {
    const previousSample = process.env.PORCELAIN_DEV_SAMPLE;
    process.env.PORCELAIN_DEV_SAMPLE = ambient;
    const server = await IsolatedServer.start(
      root,
      build.folder,
      sample,
    ).finally(() => {
      if (previousSample === undefined)
        Reflect.deleteProperty(process.env, 'PORCELAIN_DEV_SAMPLE');
      else process.env.PORCELAIN_DEV_SAMPLE = previousSample;
    });
    try {
      const production = readServerSettings({
        dataDirectory: resolve(server.projectHome, 'state'),
        projectHome: server.projectHome,
        port: 0,
        webRoot: resolve(server.projectHome, 'web'),
      });
      expect(production.limits.gitActions.deadlineMs).toBe(120000);
      expect(server.fixture.gitActionDeadlineMs).toBe(deadline);
      const recorder = new Recorder();
      const session = server.session(recorder, await server.sampleIds());
      const service = await session.read({
        method: 'GET',
        path: '/api/service/update',
      });
      expect(service.body).toMatchObject({ version, available });
      const path = session.fixture.readme.path;
      const requestId = randomUUID();
      const body = {
        requestId,
        input: { action: 'commit', message: 'Policy proof', paths: [path] },
        expected: {
          ...(await expectation(session)),
          files: [{ path, fingerprint: await fingerprintOf(session, path) }],
        },
      };
      const accepted = await session.read(
        { method: 'POST', path: gitPath(session, '/actions'), body },
        202,
      );
      expect(accepted.body).toMatchObject({ requestId, state: 'running' });
      const { receipt } = await settledReceipt(session, requestId);
      expect(receipt).toMatchObject({ requestId, state: 'succeeded' });
      expect((await session.git('log', '-1', '--format=%s')).trim()).toBe(
        'Policy proof',
      );
      const replay = await session.read({
        method: 'POST',
        path: gitPath(session, '/actions'),
        body,
      });
      expect(replay.body).toStrictEqual(receipt);
      expect((await session.git('rev-list', '--count', 'HEAD')).trim()).toBe(
        '2',
      );
    } finally {
      await server.stop();
      await server.stop();
    }
    expect(existsSync(server.projectHome)).toBe(false);
  },
);
