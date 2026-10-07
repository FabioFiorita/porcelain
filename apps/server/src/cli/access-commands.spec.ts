import { Effect, Layer, Option } from 'effect';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { EnvironmentSettings } from '../config/environment-settings.ts';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import { CliInvocation, serverSettingsFor } from './settings.ts';
import { issuePairings, setDeviceTrust } from './access-commands.ts';

const owned: { directory: string; server: Server }[] = [];
afterEach(async () => {
  for (const { directory, server } of owned.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});

function limits() {
  return Effect.runPromise(
    serverSettingsFor({
      dataDirectory: Option.none(),
      host: Option.none(),
      port: Option.none(),
      allowHosts: [],
      lan: false,
    }).pipe(
      Effect.provide(
        Layer.merge(
          Layer.succeed(EnvironmentSettings, {
            read: Effect.succeed({
              dataDirectory: undefined,
              host: undefined,
              port: undefined,
              projectHome: undefined,
              webRoot: undefined,
              allowedHosts: [],
            }),
          }),
          Layer.succeed(CliInvocation, {
            homeDirectory: '/home/agent',
            webRoot: '/build/web',
          }),
        ),
      ),
      Effect.map((settings) => settings.limits),
    ),
  );
}

async function fixture(answer: () => { status: number; body: unknown }) {
  const directory = await mkdtemp(join(tmpdir(), 'pc-access-'));
  const calls: {
    method: string | undefined;
    path: string | undefined;
    body: unknown;
  }[] = [];
  const server = createServer((request, response) => {
    let text = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      text += chunk;
    });
    request.on('end', () => {
      const body: unknown = text ? JSON.parse(text) : undefined;
      calls.push({ method: request.method, path: request.url, body });
      const result = answer();
      response.writeHead(result.status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(result.body));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(ownerSocketPath(directory), resolve);
  });
  owned.push({ directory, server });
  return { calls, directory };
}

it('issues a pairing with CLI settings while sending only contract fields', async () => {
  const test = await fixture(() => ({
    status: 200,
    body: {
      grants: [
        {
          grant: {
            id: 'grant-1',
            label: 'Phone',
            addresses: ['http://localhost:3000'],
            createdAt: '2026-10-07T12:00:00.000Z',
            expiresAt: '2026-10-07T12:15:00.000Z',
            trusted: true,
          },
          code: 'test-code',
          link: 'http://localhost:3000/pair#c=test-code&e=test-environment',
        },
      ],
    },
  }));
  const output: string[] = [];
  const settings = {
    dataDirectory: test.directory,
    labels: ['Phone'],
    addresses: ['http://localhost:3000'],
    trusted: true,
  };
  await Effect.runPromise(
    issuePairings(
      test.directory,
      settings,
      { stdout: (text) => output.push(text), stderr: () => {} },
      await limits(),
      false,
    ),
  );
  expect(test.calls).toEqual([
    {
      method: 'POST',
      path: '/pairings',
      body: {
        labels: ['Phone'],
        addresses: ['http://localhost:3000'],
        trusted: true,
      },
    },
  ]);
  expect(output.join('')).toBe(
    'Phone\nhttp://localhost:3000/pair#c=test-code&e=test-environment\n' +
      'Expires 2026-10-07T12:15:00.000Z\n\n' +
      'This link works once, for 15 minutes.\n' +
      'A device paired with it is trusted: it may update Porcelain.\n',
  );
});

it('sets device trust with CLI settings while sending only contract fields', async () => {
  const test = await fixture(() => ({
    status: 200,
    body: { id: 'device-1', trusted: true },
  }));
  const output: string[] = [];
  const settings = {
    dataDirectory: test.directory,
    id: 'device-1',
    trusted: true,
  };
  await Effect.runPromise(
    setDeviceTrust(
      test.directory,
      settings,
      { stdout: (text) => output.push(text), stderr: () => {} },
      await limits(),
    ),
  );
  expect(test.calls).toEqual([
    {
      method: 'POST',
      path: '/access/trust',
      body: { id: 'device-1', trusted: true },
    },
  ]);
  expect(output).toEqual([
    'That device is trusted: it may update Porcelain.\n',
  ]);
});
