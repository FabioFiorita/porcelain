import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  list,
  record,
  text,
} from '../.agents/skills/server-verify/scripts/feature.ts';
import { buildIsolatedServer } from './dev-server.ts';
import {
  IsolatedServer,
  Recorder,
} from '../.agents/skills/server-verify/scripts/session.ts';

const [simulatorId, driver = 'maestro'] = process.argv.slice(2);
if (
  !simulatorId ||
  !/^[0-9A-F-]{36}$/i.test(simulatorId) ||
  (driver !== 'maestro' && driver !== 'agent-device')
)
  throw new Error(
    'Usage: node scripts/mobile-pairing.ts <iOS simulator id> [maestro|agent-device]; start Metro and connect the development app first; close any Agent Device preview session before testing.',
  );
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = await mkdtemp(join(tmpdir(), 'porcelain-mobile-pairing-'));
const evidence = await mkdtemp(
  join(tmpdir(), 'porcelain-mobile-pairing-evidence-'),
);
const execute = promisify(execFile);
const recorder = new Recorder();
const driverSession = `porcelain-pairing-${randomUUID()}`;
const servers: IsolatedServer[] = [];
const links: string[] = [];
const names: string[] = [];

async function redact(folder: string): Promise<void> {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) await redact(path);
    else if (/\.(?:log|json|xml|txt|html)$/.test(path))
      await writeFile(path, recorder.scrub(await readFile(path, 'utf8')));
  }
}

try {
  await buildIsolatedServer(state);
  for (const title of ['First', 'Second']) {
    const server = await IsolatedServer.start(root, state);
    servers.push(server);
    const name = `Mobile ${title} ${randomUUID().slice(0, 8)}`;
    names.push(name);
    await server.read(recorder, {
      method: 'PUT',
      path: '/api/environment/name',
      body: { name },
    });
    const issued = await server.read(recorder, {
      method: 'POST',
      path: '/pairings',
      target: 'owner',
      body: { labels: ['Native mobile proof'], addresses: [server.address] },
    });
    const grant = record(list(record(issued.body).grants)[0]);
    const health = await server.read(recorder, {
      method: 'GET',
      path: '/api/health',
      auth: 'none',
    });
    const environment = record(health.body);
    const link = `${server.address}/pair#c=${encodeURIComponent(text(grant.code))}&e=${encodeURIComponent(text(environment.environmentId))}`;
    recorder.secret(link);
    links.push(link);
  }
  const [firstLink, secondLink] = links;
  const [firstName, secondName] = names;
  if (!firstLink || !secondLink || !firstName || !secondName)
    throw new Error('Both real environment fixtures must be ready.');
  const run = await execute(
    driver,
    [
      ...(driver === 'maestro'
        ? [
            '--udid',
            simulatorId,
            'test',
            '.agents/skills/mobile-verify/flows/pairing.yaml',
            '--test-output-dir',
            evidence,
            '--no-ansi',
          ]
        : [
            'test',
            '.agents/skills/mobile-verify/flows/pairing.yaml',
            '--maestro',
            '--platform',
            'ios',
            '--udid',
            simulatorId,
            '--session',
            driverSession,
            '--metro-host',
            'localhost',
            '--metro-port',
            '8081',
            '--artifacts-dir',
            evidence,
          ]),
      '-e',
      `FIRST_PAIRING_LINK=${firstLink}`,
      '-e',
      `SECOND_PAIRING_LINK=${secondLink}`,
      '-e',
      `FIRST_ENVIRONMENT_NAME=${firstName}`,
      '-e',
      `SECOND_ENVIRONMENT_NAME=${secondName}`,
    ],
    {
      cwd: root,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        MAESTRO_CLI_NO_ANALYTICS: '1',
        MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
      },
    },
  );
  await writeFile(
    join(evidence, `${driver}.log`),
    recorder.scrub(run.stdout + run.stderr),
  );
  for (const server of servers) {
    const access = await server.read(recorder, {
      method: 'GET',
      path: '/access',
      target: 'owner',
    });
    const devices = list(record(access.body).devices)
      .map(record)
      .filter((device) => device.label === 'Native mobile proof');
    const hits = await server.hits();
    const paired = hits.filter(
      (hit) =>
        !hit.kit &&
        hit.method === 'POST' &&
        hit.route === '/api/pair' &&
        hit.status === 200,
    );
    const authenticated = hits.filter(
      (hit) =>
        !hit.kit &&
        hit.method === 'GET' &&
        hit.route === '/api/environment' &&
        hit.status === 200,
    );
    await writeFile(
      join(evidence, `server-${servers.indexOf(server)}.json`),
      JSON.stringify(recorder.redact({ devices, hits }), null, 2),
    );
    if (
      devices.length !== 1 ||
      !devices.every(
        (device) => device.platform === 'iOS' || device.platform === 'iPadOS',
      ) ||
      paired.length !== 1 ||
      authenticated.length < 3
    )
      throw new Error(
        'The native UI must pair one Apple mobile device and authenticate again after restarting.',
      );
  }
  process.stdout.write(
    `PASS native pairing and restart against two real environments with ${driver}\nEvidence: ${evidence}\n`,
  );
} catch (error) {
  await writeFile(
    join(evidence, 'failure.log'),
    recorder.scrub(error instanceof Error ? error.message : String(error)),
  );
  if (error && typeof error === 'object') {
    for (const field of ['stdout', 'stderr']) {
      const output: unknown = Reflect.get(error, field);
      if (typeof output === 'string')
        await writeFile(
          join(evidence, `failure-${field}.log`),
          recorder.scrub(output),
        );
    }
  }
  process.stderr.write(`FAIL native pairing; evidence: ${evidence}\n`);
  process.exitCode = 1;
} finally {
  await redact(evidence);
  for (const server of servers) {
    const failure = await server.stop();
    if (failure) {
      process.stderr.write(`${failure}\n`);
      process.exitCode = 1;
    }
  }
  await rm(state, { recursive: true, force: true });
}
