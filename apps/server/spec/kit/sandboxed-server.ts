import { ownerClient, runOwner } from '../../src/cli/owner-client.ts';
import { execFile } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { subscribe } from 'node:diagnostics_channel';
import { appendFileSync } from 'node:fs';
import { mkdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { FixedNetworkAddressReader } from '../fakes/fixed-network-address-reader.ts';
import { InMemoryRouteListenerRunner } from '../fakes/in-memory-route-listener-runner.ts';
import { ScriptedServiceUpdateRunner } from '../fakes/scripted-service-update-runner.ts';
import { ScriptedTunnelProbe } from '../fakes/scripted-tunnel-probe.ts';
import { composeServer } from '../../src/bootstrap/compose-server.ts';
import { readServerSettings } from '../../src/config/server-settings.ts';
import type { Runtime } from '../../src/ports/runtime.ts';
import { codingTool } from './coding-tool.ts';
import {
  changePerfSample,
  perfSample,
  placePerfSample,
} from './perf-sample.ts';

const issuedPairingSchema = z.object({
  grants: z.array(z.object({ code: z.string() })),
});
const redeemedPairingSchema = z.object({ credential: z.string().optional() });
const healthSchema = z.object({ environmentId: z.string() });

const execute = promisify(execFile);
const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.stdin.on('end', stop);
process.stdin.resume();

const root = process.env.PORCELAIN_DEV_ROOT;
if (!root) throw new Error('Missing development root');
const port = Number(process.env.PORCELAIN_DEV_PORT ?? '0');
const bin = process.env.PORCELAIN_DEV_BIN;
if (!bin) throw new Error('Missing development PATH folder');
const installation = process.env.PORCELAIN_DEV_INSTALLATION;
if (!installation) throw new Error('Missing development installation folder');
const codingToolExecutable = process.env.PORCELAIN_DEV_CODING_TOOL;
if (!codingToolExecutable)
  throw new Error('Missing development coding tool location');
let server: Runtime | undefined;
const listeningPort = () =>
  Number(new URL(server?.address ?? 'http://127.0.0.1:0').port);
const startServer = composeServer({
  networkAddressReader: () =>
    new FixedNetworkAddressReader(
      [
        {
          interfaceName: 'lo',
          address: '127.0.0.1',
          family: 'IPv4',
          internal: true,
          physical: false,
          netmask: '255.0.0.0',
          cidr: '127.0.0.1/8',
        },
        {
          interfaceName: 'eth0',
          address: '192.168.1.20',
          family: 'IPv4',
          internal: false,
          physical: true,
          netmask: '255.255.255.0',
          cidr: '192.168.1.20/24',
        },
        {
          interfaceName: 'docker0',
          address: '172.17.0.1',
          family: 'IPv4',
          internal: false,
          physical: false,
          netmask: '255.255.0.0',
          cidr: '172.17.0.1/16',
        },
        {
          interfaceName: 'tun0',
          address: '10.8.0.51',
          family: 'IPv4',
          internal: false,
          physical: false,
          netmask: '255.255.255.0',
          cidr: '10.8.0.51/24',
        },
      ],
      [
        {
          interfaceName: 'eth0',
          metric: 100,
          gateway: '192.168.1.1',
          gatewayHardware: '02:00:5e:10:00:01',
        },
      ],
    ),
  routeListenerRunner: () =>
    new InMemoryRouteListenerRunner(listeningPort, () => 41000),
  tunnelProbe: () =>
    new ScriptedTunnelProbe(async ({ origin }) => {
      const { hostname } = new URL(origin);
      if (hostname.split('.').includes('invalid'))
        return { kind: 'unreachable' };
      if (hostname.endsWith('.test')) return { kind: 'foreign' };
      const health = await fetch(`${server?.address ?? ''}/api/health`);
      return {
        kind: 'answered',
        environmentId: healthSchema.parse(await health.json()).environmentId,
      };
    }),
});
const relay = createServer((incoming) => {
  const address = new URL(server?.address ?? 'http://127.0.0.1:0');
  const outgoing = connect(Number(address.port), address.hostname);
  incoming.pipe(outgoing).pipe(incoming);
  incoming.on('error', () => outgoing.destroy());
  outgoing.on('error', () => incoming.destroy());
});

const listedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const routes = new Set<string>();
const hitsFile = join(root, 'hits.jsonl');
let fixtureReady = false;
subscribe('porcelain.http', (message) => {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('event' in message) ||
    !('owner' in message)
  )
    return;
  const owner = message.owner === true;
  if (
    message.event === 'registered' &&
    'method' in message &&
    'route' in message &&
    typeof message.route === 'string'
  ) {
    const methods =
      message.method === '*' ? [...listedMethods] : [message.method];
    for (const method of methods)
      if (typeof method === 'string' && listedMethods.has(method))
        routes.add(`${owner ? 'owner ' : ''}${method} ${message.route}`);
  } else if (
    fixtureReady &&
    'id' in message &&
    typeof message.id === 'string'
  ) {
    appendFileSync(
      hitsFile,
      `${JSON.stringify({ ...message, id: owner ? `owner-${message.id}` : message.id })}\n`,
    );
  }
});
function registeredRoutes() {
  return [...routes].sort();
}

const sample = process.env.PORCELAIN_DEV_SAMPLE;
const QUIET_INVENTORY_MS = 24 * 60 * 60 * 1000;
const COMMITTED = '# Sample repository\n';
const fixture = {
  folders: {
    home: 'home',
    repository: 'repository',
    state: 'state',
    web: 'web',
  },
  branch: 'main',
  device: { label: 'Development setup', platform: 'Development' },
  readme: {
    path: 'README.md',
    committed: COMMITTED,
    changed: `${COMMITTED}\nA change to review.\n`,
  },
  initialCommit: 'Initial commit',
  web: {
    shell: '<!doctype html><title>Porcelain</title>\n',
    asset: { path: 'assets/app-0123abcd.js', text: 'export {};\n' },
    escape: 'leak.txt',
  },
  summaryLinkLifetimeMs: 2000,
  liveTicketLifetimeMs: 1000,
  gitActionDeadlineMs: 1500,
  inventoryStaleAfterMs: sample === 'perf' ? QUIET_INVENTORY_MS : 200,
  codingTool,
  serviceUpdate: {
    version: '1.0.0',
    latest: '1.1.0',
    failure:
      'Could not install the persistent runtime: npm could not reach the registry',
    stepMs: 400,
  },
};

const offered = {
  managed: true,
  version: fixture.serviceUpdate.version,
  latest: fixture.serviceUpdate.latest,
  available: true,
  running: false,
  last: undefined,
};
const attempt = (stage: 'downloading' | 'installing' | 'restarting') => ({
  ...offered,
  running: true,
  last: {
    from: fixture.serviceUpdate.version,
    target: fixture.serviceUpdate.latest,
    stage,
    reason: undefined,
  },
});
const serviceUpdateRunner = new ScriptedServiceUpdateRunner(
  offered,
  [
    [
      attempt('downloading'),
      attempt('installing'),
      {
        ...offered,
        last: {
          from: fixture.serviceUpdate.version,
          target: fixture.serviceUpdate.latest,
          stage: 'failed',
          reason: fixture.serviceUpdate.failure,
        },
      },
    ],
    [
      attempt('downloading'),
      attempt('installing'),
      attempt('restarting'),
      {
        ...offered,
        version: fixture.serviceUpdate.latest,
        available: false,
        last: {
          from: fixture.serviceUpdate.version,
          target: fixture.serviceUpdate.latest,
          stage: 'updated',
          reason: undefined,
        },
      },
    ],
  ],
  fixture.serviceUpdate.stepMs,
);

async function seedReviewSample(repository: string) {
  const write = async (path: string, text: string) => {
    const file = join(repository, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text);
  };
  const at = async (date: string, args: readonly string[]) => {
    await execute('git', [...args], {
      cwd: repository,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date,
      },
    });
  };
  const commit = async (message: string, date: string) => {
    await execute('git', ['add', '-A'], { cwd: repository, env: process.env });
    await at(date, ['commit', '-m', message]);
  };

  await at('2026-09-01T09:00:00', [
    'commit',
    '--amend',
    '--no-edit',
    '--reset-author',
  ]);
  await write(
    'src/parse.ts',
    "export type Note = { title: string; body: string };\n\nexport function parseNote(text: string): Note {\n  const [title = '', ...rest] = text.split('\\n');\n  return { title: title.replace(/^# /, ''), body: rest.join('\\n').trim() };\n}\n",
  );
  await write(
    'src/notes/store.ts',
    "import type { Note } from '../parse.ts';\n\nconst notes: Note[] = [];\n\nexport function saveNote(note: Note) {\n  notes.push(note);\n}\n\nexport function listNotes() {\n  return notes;\n}\n",
  );
  await commit('Add the note parser', '2026-09-03T10:00:00');
  await write(
    'src/app.ts',
    "import { parseNote } from './parse.ts';\nimport { saveNote } from './notes/store.ts';\n\nconst form = document.querySelector('form');\nform?.addEventListener('submit', (event) => {\n  event.preventDefault();\n  const data = new FormData(form);\n  saveNote(parseNote(String(data.get('note') ?? '')));\n});\n",
  );
  await write(
    'src/style.css',
    'body {\n  font: 16px/1.5 sans-serif;\n  margin: 2rem;\n}\n\nform {\n  display: grid;\n  gap: 0.75rem;\n}\n',
  );
  await write(
    'src/legacy.ts',
    'export function readLegacyNote(text: string) {\n  return text.trim();\n}\n',
  );
  await commit('Show a note on the page', '2026-09-08T11:00:00');
  await write(
    'docs/guide.md',
    '# Notes\n\nA note starts with a heading line, then the body.\n\n# Grocery\n\nMilk\nBread\n',
  );
  await commit('Explain the note format', '2026-09-14T09:30:00');
  await write(
    'tests/parse.test.ts',
    "import { parseNote } from '../src/parse.ts';\n\nconst note = parseNote('\\n');\nif (note.title !== '' || note.body !== '') throw new Error('empty note');\n",
  );
  await commit('Cover an empty note', '2026-09-18T15:00:00');
  await write(
    'assets/mark.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">\n  <circle cx="8" cy="8" r="6" />\n</svg>\n',
  );
  await commit('Add the mark', '2026-09-22T16:00:00');
  await execute('git', ['checkout', '-b', 'wip-outline'], {
    cwd: repository,
    env: process.env,
  });
  await write(
    'docs/outline.md',
    '# Next guide\n\n- Saving a note\n- Finding a note by title\n',
  );
  await commit('Outline the next guide', '2026-09-24T10:00:00');
  await execute('git', ['checkout', 'main'], {
    cwd: repository,
    env: process.env,
  });
  await at('2026-09-25T09:00:00', [
    'merge',
    '--no-ff',
    '-m',
    'Merge the guide outline',
    'wip-outline',
  ]);
  await execute('git', ['checkout', '-b', 'wip-search'], {
    cwd: repository,
    env: process.env,
  });
  await write(
    'src/search.ts',
    "import type { Note } from './parse.ts';\n\nexport function findNotes(notes: readonly Note[], query: string) {\n  const needle = query.toLowerCase();\n  return notes.filter((note) => note.title.toLowerCase().includes(needle));\n}\n",
  );
  await commit('Search notes by title', '2026-09-26T12:00:00');
  await execute('git', ['checkout', 'main'], {
    cwd: repository,
    env: process.env,
  });
  await write(
    'src/app.ts',
    "import { parseNote } from './parse.ts';\nimport { listNotes, saveNote } from './notes/store.ts';\n\nconst form = document.querySelector('form');\nform?.addEventListener('submit', (event) => {\n  event.preventDefault();\n  const data = new FormData(form);\n  const note = parseNote(String(data.get('note') ?? ''));\n  saveNote(note);\n  document.querySelector('output')?.replaceChildren(\n    listNotes()\n      .map((item) => item.title)\n      .join('\\n'),\n  );\n});\n",
  );
  await write(
    'src/format.ts',
    "export function noteTitle(title: string) {\n  return title.trim() || 'Untitled';\n}\n",
  );
  await execute('git', ['add', 'src/app.ts', 'src/format.ts'], {
    cwd: repository,
    env: process.env,
  });
  await write(
    'src/parse.ts',
    "export type Note = { title: string; body: string };\n\nexport function parseNote(text: string): Note {\n  const [first = '', ...rest] = text.split('\\n');\n  const title = first.startsWith('# ') ? first.slice(2) : first;\n  return { title, body: rest.join('\\n').trim() };\n}\n",
  );
  await unlink(join(repository, 'src/legacy.ts'));
  await write('src/config.ts', "export const pageTitle = 'Notes';\n");
  await write(
    'docs/draft.md',
    '# Draft\n\nHow search should treat an empty query.\n',
  );
}

try {
  const home = join(root, fixture.folders.home);
  const repository = join(root, fixture.folders.repository);
  const state = join(root, fixture.folders.state);
  await mkdir(home);
  Object.assign(process.env, {
    HOME: home,
    XDG_CONFIG_HOME: home,
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_DATA_HOME: join(root, 'data'),
    TMPDIR: root,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.hooksPath',
    GIT_CONFIG_VALUE_0: '/dev/null',
    GCM_INTERACTIVE: 'Never',
  });

  const git = async (...args: string[]) => {
    await execute('git', args, { cwd: repository, env: process.env });
  };
  const sampleGit = (cwd: string, ...args: string[]) =>
    execute('git', args, { cwd, env: process.env });
  const gitTrace = sample === 'perf' ? join(root, 'git-trace.jsonl') : null;
  let perf: Awaited<ReturnType<typeof changePerfSample>> | null = null;
  await mkdir(repository);
  if (sample === 'perf')
    await placePerfSample({
      source: join(installation, 'server', perfSample.source),
      repository,
      git: sampleGit,
    });
  else await git('init', '-b', fixture.branch);
  await git('config', 'user.name', 'Porcelain Development');
  await git('config', 'user.email', 'porcelain@example.invalid');
  const readme = join(repository, fixture.readme.path);
  await writeFile(readme, fixture.readme.committed);
  await git('add', fixture.readme.path);
  await git('commit', '-m', fixture.initialCommit);
  if (sample === 'review') await seedReviewSample(repository);
  if (sample === 'perf')
    perf = await changePerfSample({ root, repository, git: sampleGit });
  await writeFile(readme, fixture.readme.changed);
  if (gitTrace !== null)
    await writeFile(
      join(home, '.gitconfig'),
      `[trace2]\n\teventTarget = ${gitTrace}\n\teventBrief = true\n`,
    );

  const web = join(root, fixture.folders.web);
  await mkdir(join(web, 'assets'), { recursive: true });
  await writeFile(join(web, 'index.html'), fixture.web.shell);
  await writeFile(join(web, fixture.web.asset.path), fixture.web.asset.text);
  await symlink('../credential.json', join(web, fixture.web.escape));

  const desktopCredential = randomBytes(32).toString('base64url');
  const settings = readServerSettings({
    dataDirectory: state,
    projectHome: root,
    port,
    webRoot: web,
  });
  server = await startServer(
    {
      ...settings,
      limits: {
        ...settings.limits,
        jobs: {
          ...settings.limits.jobs,
          refreshInventoryMs: sample === 'perf' ? QUIET_INVENTORY_MS : 250,
        },
        access: {
          ...settings.limits.access,
          liveTicket: {
            ...settings.limits.access.liveTicket,
            lifetimeMs: fixture.liveTicketLifetimeMs,
          },
        },
        inventory: {
          ...settings.limits.inventory,
          staleAfterMs: fixture.inventoryStaleAfterMs,
        },
        gitActions: {
          ...settings.limits.gitActions,
          deadlineMs: fixture.gitActionDeadlineMs,
        },
        reviews: {
          ...settings.limits.reviews,
          summaryLink: {
            ...settings.limits.reviews.summaryLink,
            lifetimeMs: fixture.summaryLinkLifetimeMs,
          },
        },
      },
    },
    shutdown.signal,
    {
      serviceUpdateRunner,
      version: fixture.serviceUpdate.version,
      desktopSession: {
        deviceId: randomUUID(),
        secretHash: createHash('sha256')
          .update(desktopCredential)
          .digest('hex'),
      },
    },
  );
  const [grant] = issuedPairingSchema.parse(
    await runOwner(
      ownerClient(
        state,
        settings.limits.owner.requestTimeoutMs,
      ).administration.issuePairing({
        payload: {
          labels: [fixture.device.label],
          addresses: [new URL(server.address).origin],
          trusted: false,
        },
      }),
    ),
  ).grants;
  if (!grant) throw new Error('Could not create a development pairing');
  const paired = await fetch(`${server.address}/api/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: grant.code,
      platform: fixture.device.platform,
    }),
    signal: shutdown.signal,
  });
  if (!paired.ok)
    throw new Error(`Development pairing failed: ${paired.status}`);
  const pairing = redeemedPairingSchema.parse(await paired.json());
  const credential = pairing.credential;
  if (credential === undefined || credential === '')
    throw new Error('Development pairing returned no credential');
  const registered = await fetch(`${server.address}/api/projects`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${credential}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ path: repository }),
    signal: shutdown.signal,
  });
  if (!registered.ok)
    throw new Error(
      `Sample repository registration failed: ${registered.status}`,
    );

  await new Promise<void>((resolveRelay, rejectRelay) => {
    relay.once('error', rejectRelay);
    relay.listen(join(root, 'network.sock'), () => resolveRelay());
  });

  const credentialFile = join(root, 'credential.json');
  await writeFile(
    credentialFile,
    `${JSON.stringify({ credential, desktopCredential })}\n`,
    { mode: 0o600 },
  );
  const manifest = join(root, 'manifest.json');
  fixtureReady = true;
  await writeFile(
    manifest,
    `${JSON.stringify({ address: server.address, dataDirectory: state, repository, socketPath: server.socketPath, credentialFile, hitsFile, gitTrace, bin, installation, codingTool: codingToolExecutable, fixture: { ...fixture, perf: perf && { files: perfSample.files, commits: perfSample.commits, ...perf } }, routes: registeredRoutes() }, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(
    `${JSON.stringify({ manifest, address: server.address, repository })}\n`,
  );
  if (!shutdown.signal.aborted)
    await new Promise<void>((resolve) =>
      shutdown.signal.addEventListener('abort', () => resolve(), {
        once: true,
      }),
    );
} catch (error) {
  if (!shutdown.signal.aborted) {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  }
} finally {
  try {
    relay.close();
    await server?.close();
  } finally {
    process.stdin.destroy();
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}
