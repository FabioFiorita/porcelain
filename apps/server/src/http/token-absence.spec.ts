import { createHmac, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { parseCliArguments } from '../cli/arguments.ts';
import { readStartupSettings } from '../config/startup-settings.ts';
import { pairThroughSocket } from '../development/pair-through-socket.ts';
import { startRuntime } from '../lifecycle/runtime.ts';

/**
 * What an installation that used the old shared token actually has lying
 * around: the file the launcher wrote, and the environment variables that
 * configured it.
 */
const admin = 'a'.repeat(43);

async function upgraded(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const dataDirectory = join(root, 'state');
  await mkdir(join(root, 'home'), { recursive: true });
  // The old launcher created this directory; 3a's check tightens it, so the
  // fixture starts from the mode a real upgrade would already have.
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  // Left exactly where the old launcher put it. Starting must not remove it:
  // it is the owner's file, and deleting other people's files is not an
  // upgrade step.
  const tokenFile = join(dataDirectory, 'admin-token');
  await writeFile(tokenFile, admin, { mode: 0o600 });
  const runtime = await startRuntime({
    dataDirectory,
    projectHome: join(root, 'home'),
    port: 0,
  });
  return {
    runtime,
    tokenFile,
    close: async () => {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

it('starts on an installation that still has an admin token, and refuses that token', async () => {
  // The two variables the old world actually read, each through the code that
  // read it. `toEqual` is exact on purpose: restoring either branch puts a
  // field back into these settings and fails here.
  expect(
    readStartupSettings({
      PORCELAIN_DATA_DIRECTORY: '/fixture/state',
      PORCELAIN_PROJECT_HOME: '/fixture/home',
      PORCELAIN_PORT: '0',
      PORCELAIN_TOKEN: admin,
    }),
  ).toEqual({
    dataDirectory: '/fixture/state',
    projectHome: '/fixture/home',
    port: 0,
    host: '127.0.0.1',
    allowedHosts: [],
  });
  // A stale `PORCELAIN_TOKEN_FILE` exported in a shell profile is inert rather
  // than fatal: unlike the flag, nobody retypes it, so refusing to start would
  // strand an installation over a line someone forgot years ago. It is not in
  // `ServeEnvironment` any more, so this is the environment as a process
  // actually hands it over — every other variable included.
  const stale: NodeJS.ProcessEnv = {
    PORCELAIN_TOKEN_FILE: '/fixture/credentials/token',
  };
  expect(parseCliArguments(['serve'], stale, '/fixture/home')).toEqual({
    command: 'serve',
    settings: {
      dataDirectory: '/fixture/home/.porcelain',
      projectHome: '/fixture/home',
      host: '127.0.0.1',
      port: 3000,
      webRoot: expect.any(String),
      allowedHosts: [],
    },
  });
  const server = await upgraded('porcelain-upgrade-');
  try {
    const { address } = server.runtime;

    // The old value, in every shape it used to work in.
    const oldCookie = `porcelain_session=${sign(admin)}`;
    for (const headers of [
      { authorization: `Bearer ${admin}` },
      { authorization: `Bearer ${admin}`, 'x-porcelain-browser': '1' },
      { cookie: oldCookie },
      { cookie: oldCookie, 'x-porcelain-browser': '1' },
      { cookie: `porcelain_device=${admin}` },
    ]) {
      const refused = await fetch(`${address}/api/inventory`, { headers });
      expect(refused.status, JSON.stringify(headers)).toBe(401);
      await refused.text();
    }

    // The agent route is gone, not merely unauthorized.
    const mcp = await fetch(`${address}/api/mcp`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${admin}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(mcp.status).toBe(404);
    await mcp.text();

    // A device paired through the owner socket works, as a viewer.
    const credential = await pairThroughSocket(
      server.runtime.socketPath,
      address,
      'Upgrade fixture',
    );
    const allowed = await fetch(`${address}/api/inventory`, {
      headers: { authorization: `Bearer ${credential}` },
    });
    expect(allowed.status).toBe(200);
    await allowed.json();

    // The owner's old file is still theirs, untouched.
    expect(await readFile(server.tokenFile, 'utf8')).toBe(admin);
  } finally {
    await server.close();
  }
}, 30000);

it('rejects the old option with the command that replaces it', () => {
  const home = '/fixture/home';
  expect(() =>
    parseCliArguments(['serve', '--token-file', '/fixture/token'], {}, home),
  ).toThrow('porcelain pair');
  expect(() =>
    parseCliArguments(['serve', '--token-file=/fixture/token'], {}, home),
  ).toThrow('--address');
});

/**
 * The old cookie exactly as the deleted middleware wrote and accepted it:
 * `<expiresAt>.<hex hmac of "browser-session:<expiresAt>">`, keyed by the admin
 * token. Getting the format right is the point — a malformed value would be
 * refused by any implementation, and would prove nothing about this one.
 */
function sign(token: string) {
  const expires = String(Date.now() + 86_400_000);
  const mac = createHmac('sha256', token)
    .update(`browser-session:${expires}`)
    .digest('hex');
  return `${expires}.${mac}`;
}

it('leaves no shared secret anywhere in a started installation', async () => {
  const server = await upgraded('porcelain-secretless-');
  try {
    // A credential this process never minted, in the right shape.
    const unminted = `pcd_${randomBytes(16).toString('hex')}_${'x'.repeat(43)}`;
    const refused = await fetch(`${server.runtime.address}/api/inventory`, {
      headers: { authorization: `Bearer ${unminted}` },
    });
    expect(refused.status).toBe(401);
    await refused.text();
  } finally {
    await server.close();
  }
}, 30000);
