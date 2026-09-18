import { once } from 'node:events';
import { access, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test, vi } from 'vitest';
import type { PlaygroundProfileName } from '../apps/server/src/development/profiles.ts';
import {
  playgroundProfile,
  runWebPlayground,
  runWebPlaygroundCli,
} from './web-playground.ts';

test('pnpm dev opens the app profile while preview and redirected smoke runs keep the fixture', () => {
  expect(playgroundProfile(['node', 'web-playground.ts'], {})).toBe('app');
  expect(playgroundProfile(['--preview'], {})).toBe('fixture');
  expect(
    playgroundProfile(['--port=4175'], {
      PORCELAIN_PLAYGROUND_DIRECTORY: '/tmp',
    }),
  ).toBe('fixture');
  expect(
    playgroundProfile(['--profile=monorepo', '--preview'], {
      PORCELAIN_PLAYGROUND_DIRECTORY: '/tmp',
    }),
  ).toBe('monorepo');
  // The shell environment never overrides the choice; only the flag does.
  expect(
    playgroundProfile([], { PORCELAIN_PLAYGROUND_PROFILE: 'monorepo' }),
  ).toBe('app');
  expect(
    playgroundProfile(['--preview'], {
      PORCELAIN_PLAYGROUND_PROFILE: 'monorepo',
    }),
  ).toBe('fixture');
  expect(() => playgroundProfile(['--profile=huge'], {})).toThrow(
    'Unknown playground profile "huge". Choose one of: fixture, app, monorepo.',
  );
});

test('forwards the profile to the playground server and creates nothing for an unknown one', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'porcelain-web-profile-'));
  try {
    await expect(
      runWebPlayground({
        preview: false,
        port: 0,
        directory: parent,
        signal: new AbortController().signal,
        profile: 'huge' as PlaygroundProfileName,
      }),
    ).rejects.toThrow('Playground server exited before startup');
    expect(await readdir(parent)).toEqual([]);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('cancelling while a profile is generated stops the server and removes its run and partial base', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'porcelain-web-cancel-'));
  try {
    const controller = new AbortController();
    const running = runWebPlayground({
      preview: false,
      port: 0,
      directory: parent,
      signal: controller.signal,
      profile: 'app',
    });
    // Abort once the base build has started, long before the server is ready.
    await vi.waitFor(
      async () =>
        expect(
          (await readdir(join(parent, '.cache'))).some((name) =>
            name.includes('.tmp-'),
          ),
        ).toBe(true),
      { timeout: 10_000 },
    );
    controller.abort();
    await expect(running).rejects.toThrow('Startup cancelled');
    expect(await readdir(parent)).toEqual(['.cache']);
    expect(await readdir(join(parent, '.cache'))).toEqual([]);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('serves a template inventory through Vite and cleans owned state on cancellation', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'porcelain-web-lifecycle-'));
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing test port');
  await new Promise<void>((done) => probe.close(() => done()));
  const manifest = join(parent, 'info.json');
  const controller = new AbortController();
  const running = runWebPlaygroundCli({
    preview: false,
    port: address.port,
    directory: parent,
    manifest,
  });
  // Observe startup errors immediately while the readiness assertion is pending.
  const completion = running.then(
    (code) => code,
    (error: unknown) => error,
  );
  try {
    await vi.waitFor(() => access(manifest), { timeout: 10000 });
    const info = JSON.parse(await readFile(manifest, 'utf8')) as {
      tokenFile: string;
    };
    const token = await readFile(info.tokenFile, 'utf8');
    await vi.waitFor(
      async () => {
        const response = await fetch(
          `http://127.0.0.1:${address.port}/api/inventory`,
          {
            headers: { authorization: `Bearer ${token}` },
          },
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          projects: [
            {
              worktrees: expect.arrayContaining([
                expect.objectContaining({ branch: 'refs/heads/main' }),
                expect.objectContaining({ branch: 'refs/heads/review' }),
              ]),
            },
          ],
        });
      },
      { timeout: 10000 },
    );
    expect(
      (await fetch(`http://127.0.0.1:${address.port}/api/inventory`)).status,
    ).toBe(401);
    expect(
      (
        await fetch(`http://127.0.0.1:${address.port}/__porcelain/playground`, {
          method: 'POST',
          headers: {
            origin: `http://127.0.0.1:${address.port}`,
            'x-porcelain-playground': '1',
          },
        })
      ).status,
    ).toBe(200);
    const secondManifest = join(parent, 'second-info.json');
    await expect(
      runWebPlayground({
        preview: false,
        port: address.port,
        directory: parent,
        manifest: secondManifest,
        signal: controller.signal,
      }),
    ).rejects.toThrow('exited unexpectedly');
    await expect(access(secondManifest)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    // A failed second launch must not stop the first run's Vite.
    expect((await fetch(`http://127.0.0.1:${address.port}`)).ok).toBe(true);
    process.emit('SIGTERM');
    expect(await completion).toBe(0);
    await expect(access(dirname(info.tokenFile))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(access(manifest)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fetch(`http://127.0.0.1:${address.port}`)).rejects.toThrow();
  } finally {
    process.emit('SIGTERM');
    controller.abort();
    await completion;
    await rm(parent, { recursive: true, force: true });
  }
}, 20000);
