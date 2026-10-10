import { execFile, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  appendFile,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { expect as pollingExpect } from 'vitest';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type TestContext } from 'vitest';
import { test } from '../kit/server-test.ts';
import { list, record, text } from '../kit/session.ts';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const SERVER_CLI = '.agents/skills/server-verify/scripts/cli';
const WEB_CLI = '.agents/skills/web-verify/scripts/cli';
const WEB_CASE_MS = 3 * 60_000;
const STALE = 'server or CLI code changed since start, run start again\n';
const copiedAway = new Set([
  'node_modules',
  '.git',
  '.claude',
  '.turbo',
  'dist',
  'test-results',
]);

type Run = { code: number; stdout: string; stderr: string };
type Finished = TestContext['onTestFinished'];

function cli(root: string, path: string, ...args: string[]): Promise<Run> {
  return new Promise((resolveRun) => {
    execFile(
      join(root, path),
      args,
      { cwd: root, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolveRun({
          code: error === null ? 0 : Number(error.code ?? 1),
          stdout,
          stderr,
        });
      },
    );
  });
}

function instanceFile(root: string, surface: string, id: string): string {
  return join(
    tmpdir(),
    'porcelain-verify',
    createHash('sha256').update(root).digest('hex').slice(0, 16),
    surface,
    'instances',
    id,
    'instance.json',
  );
}

async function started(
  onTestFinished: Finished,
  { root = repositoryRoot, path = SERVER_CLI } = {},
) {
  const run = await cli(root, path, 'start');
  expect(run.code, run.stderr).toBe(0);
  const [, id = ''] = /^instance (\S+)\n/.exec(run.stdout) ?? [];
  const [, evidence = ''] = /\nevidence (\S+)\n/.exec(run.stdout) ?? [];
  const surface = path === WEB_CLI ? 'web' : 'server';
  const file = instanceFile(root, surface, id);
  onTestFinished(async () => {
    await cli(root, path, 'stop', '--instance', id);
    expect(
      running(dirname(file)),
      'no process of the instance outlives its stop',
    ).toStrictEqual([]);
    await rm(dirname(file), { recursive: true, force: true });
  });
  const instance = record(JSON.parse(await readFile(file, 'utf8')));
  return {
    run,
    id,
    evidence,
    file,
    pid: Number(instance.pid),
    startedAt: text(instance.startedAt),
    fingerprint: text(instance.fingerprint),
    secrets: list(instance.secrets).map(text),
    detail: record(instance.detail),
  };
}

async function evidenceOf(folder: string) {
  const entries = await readdir(folder, {
    recursive: true,
    withFileTypes: true,
  });
  const files = entries.filter((entry) => entry.isFile());
  const contents = await Promise.all(
    files.map((entry) => readFile(join(entry.parentPath, entry.name), 'utf8')),
  );
  const numbered = files
    .map((entry) => entry.name)
    .filter(
      (name, index) =>
        /^\d{3}-/.test(name) && files[index]?.parentPath === folder,
    )
    .toSorted();
  return { numbered, text: contents.join('\n') };
}

async function checkoutCopy(onTestFinished: Finished): Promise<string> {
  const copy = await mkdtemp(join(tmpdir(), 'porcelain-checkout-'));
  onTestFinished(() => rm(copy, { recursive: true, force: true }));
  const linked: string[] = [];
  await cp(repositoryRoot, copy, {
    recursive: true,
    filter: (source) => {
      if (!copiedAway.has(basename(source))) return true;
      if (basename(source) === 'node_modules')
        linked.push(relative(repositoryRoot, source));
      return false;
    },
  });
  for (const path of linked)
    await symlink(join(repositoryRoot, path), join(copy, path));
  return copy;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function running(fragment: string): string[] {
  const listed = spawnSync('ps', ['-A', '-ww', '-o', 'pid=', '-o', 'args='], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return listed.stdout
    .split('\n')
    .filter(
      (line) =>
        line.includes(fragment) &&
        !line.trimStart().startsWith(`${listed.pid} `),
    );
}

async function settled(done: () => boolean): Promise<boolean> {
  try {
    await pollingExpect.poll(done, { timeout: 20_000 }).toBe(true);
    return true;
  } catch {
    return false;
  }
}

async function sessionFixture(onTestFinished: Finished) {
  const copy = await checkoutCopy(onTestFinished);
  const fixture = '.agents/skills/server-verify/scripts/session.mjs';
  const secret = 'private-session-callback-secret';
  await writeFile(
    join(copy, fixture),
    String.raw`#!/usr/bin/env node
import { Schema } from 'effect';
import { spawn } from 'node:child_process';
import { Registry } from '../../verify-core/registry.ts';
import { captureProcess, endProcess, sameProcess } from '../../verify-core/processes.ts';
import { once } from 'node:events';
const secret = ${JSON.stringify(secret)};
const registry = new Registry({
  name: 'server',
  cli: import.meta.url,
  detail: Schema.Struct({ childPid: Schema.Finite }),
  inputs: { roots: [], apps: [] },
  format: 'text',
  stale: () => undefined,
  stopWithinMs: 1000,
});
const command = process.argv[2];
if (command === 'serve') {
  await registry.serve(process.argv[3], async (life) => {
    const keepAlive = setInterval(() => {}, 1000);
    life.onStop(() => clearInterval(keepAlive));
    let childPid = 0;
    if (life.options.failure) {
      life.secret(secret);
      const child = spawn(process.execPath,
        ['-e', 'setInterval(() => {}, 1000)', '--', secret],
        { stdio: 'ignore', detached: true });
      childPid = child.pid;
      life.own(childPid);
      life.onStop(() => { throw new Error('cleanup ' + secret); });
    }
    return { childPid };
  });
} else if (command === 'start') {
  const instance = await registry.launch({ failure: process.argv[3] === 'failure' }, 5000);
  process.stdout.write(JSON.stringify({ id: instance.id, pid: instance.pid,
    folder: instance.folder, evidence: instance.evidence, childPid: instance.detail.childPid }) + '\n');
} else if (command === 'stop') {
  const result = await registry.stopById(process.argv[3]);
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.complete ? 0 : 1;
} else if (command === 'evidence') {
  process.stdout.write(registry.evidencePath(process.argv[3]) + '\n');
} else if (command === 'process-outcomes') {
  const child = spawn(process.execPath,
    ['-e', "process.on('SIGTERM', () => {}); process.stdout.write('ready'); setInterval(() => {}, 1000)"],
    { stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    await once(child.stdout, 'data');
    const captured = captureProcess(child.pid);
    if (captured === undefined) throw new Error('child identity was not captured');
    const stale = await endProcess({ ...captured, birth: captured.birth + '-stale' }, 20);
    const survived = sameProcess(captured);
    const forced = await endProcess(captured, 20);
    process.stdout.write(JSON.stringify({ stale, survived, forced, alive: sameProcess(captured) }) + '\n');
  } finally {
    child.kill('SIGKILL');
  }
}
`,
    { mode: 0o700 },
  );
  const instances: {
    id: string;
    pid: number;
    childPid: number;
    folder: string;
  }[] = [];
  onTestFinished(async () => {
    for (const instance of instances) {
      await cli(copy, fixture, 'stop', instance.id);
      for (const pid of [instance.pid, instance.childPid])
        if (pid > 0 && alive(pid)) {
          process.kill(pid, 'SIGTERM');
          if (!(await settled(() => !alive(pid)))) process.kill(pid, 'SIGKILL');
          await settled(() => !alive(pid));
        }
      expect(
        [instance.pid, instance.childPid].filter(
          (pid) => pid > 0 && alive(pid),
        ),
      ).toStrictEqual([]);
      await rm(instance.folder, { recursive: true, force: true });
    }
  });
  return {
    secret,
    command: (...args: string[]) => cli(copy, fixture, ...args),
    start: async (failure = false) => {
      const run = await cli(
        copy,
        fixture,
        'start',
        ...(failure ? ['failure'] : []),
      );
      const value = record(JSON.parse(run.stdout));
      const instance = {
        id: text(value.id),
        pid: Number(value.pid),
        childPid: Number(value.childPid),
        folder: text(value.folder),
        evidence: text(value.evidence),
      };
      instances.push(instance);
      return instance;
    },
  };
}

test('cleanup reports success after confirmed SIGKILL and refuses a stale child identity', async ({
  onTestFinished,
}) => {
  const fixture = await sessionFixture(onTestFinished);
  const run = await fixture.command('process-outcomes');
  const outcome = record(JSON.parse(run.stdout));
  const stale = record(outcome.stale);
  const forced = record(outcome.forced);

  expect(run.code).toBe(0);
  expect(stale.complete).toBe(false);
  expect(list(stale.report).map(text).join('\n')).toContain(
    'different identity',
  );
  expect(outcome.survived).toBe(true);
  expect(forced.complete).toBe(true);
  expect(list(forced.report).map(text).join('\n')).toContain('after SIGTERM');
  expect(outcome.alive).toBe(false);
});

test('every surface can read retained evidence and repeat a confirmed stop without starting an instance', async ({
  onTestFinished,
}) => {
  const copy = await checkoutCopy(onTestFinished);
  const id = 'abc12345';
  for (const surface of ['server', 'web', 'desktop', 'mobile']) {
    const path = `.agents/skills/${surface}-verify/scripts/cli`;
    const home = resolve(instanceFile(copy, surface, id), '../../..');
    const evidence = join(home, 'evidence', id);
    onTestFinished(() => rm(home, { recursive: true, force: true }));
    await mkdir(evidence, { recursive: true, mode: 0o700 });
    await writeFile(
      join(evidence, 'stop-result.json'),
      JSON.stringify({ complete: true, report: [] }),
      { mode: 0o600 },
    );
    const retained = await cli(copy, path, 'evidence', '--instance', id);
    const repeated = await cli(copy, path, 'stop', '--instance', id);

    expect(retained.code, `${surface}: ${retained.stderr}`).toBe(0);
    expect(retained.stdout).toContain(evidence);
    expect(repeated.code, `${surface}: ${repeated.stderr}`).toBe(0);
    expect(repeated.stdout).toContain(`already stopped ${id}`);
    for (const selector of ['00000000', `../${id}`]) {
      const refusedEvidence = await cli(
        copy,
        path,
        'evidence',
        '--instance',
        selector,
      );
      const refusedStop = await cli(copy, path, 'stop', '--instance', selector);
      expect(refusedEvidence.code, surface).toBe(1);
      expect(refusedEvidence.stdout, surface).toBe('');
      expect(refusedStop.code, surface).toBe(1);
      expect(refusedStop.stdout, surface).not.toMatch(
        /(?:^|\n)(?:already )?stopped /,
      );
    }
    expect(existsSync(join(home, 'instances')), surface).toBe(false);
    expect(await readdir(evidence), surface).toStrictEqual([
      'stop-result.json',
    ]);
  }
});

test('a throwing cleanup stays incomplete after its supervisor exits and redacts its secret', async ({
  onTestFinished,
}) => {
  const fixture = await sessionFixture(onTestFinished);
  const instance = await fixture.start(true);
  const captured = await readFile(
    join(instance.folder, 'processes.json'),
    'utf8',
  );
  const stopped = await fixture.command('stop', instance.id);
  const repeated = await fixture.command('stop', instance.id);
  const retained = await fixture.command('evidence', instance.id);
  const outcome = record(
    JSON.parse(
      await readFile(join(instance.evidence, 'stop-result.json'), 'utf8'),
    ),
  );
  const evidence = await evidenceOf(instance.evidence);

  expect(captured).toContain(fixture.secret);
  expect(stopped.code).toBe(1);
  expect(record(JSON.parse(stopped.stdout)).complete).toBe(false);
  expect(repeated.code).toBe(1);
  expect(record(JSON.parse(repeated.stdout)).complete).toBe(false);
  expect(outcome.complete).toBe(false);
  expect(list(outcome.report).map(text).join('\n')).toContain(
    'cleanup [redacted]',
  );
  expect(alive(instance.pid)).toBe(false);
  expect(alive(instance.childPid)).toBe(false);
  expect(existsSync(join(instance.folder, 'instance.json'))).toBe(true);
  expect(existsSync(join(instance.folder, 'processes.json'))).toBe(true);
  expect(retained.code).toBe(0);
  expect(retained.stdout).toContain(instance.evidence);
  expect(stopped.stdout).not.toContain(fixture.secret);
  expect(repeated.stdout).not.toContain(fixture.secret);
  expect(evidence.text).not.toContain(fixture.secret);
});

test('an inactive session stops only when requested', async ({
  onTestFinished,
}) => {
  const fixture = await sessionFixture(onTestFinished);
  const instance = await fixture.start();
  const activity = join(instance.folder, 'last-command');
  await writeFile(activity, '');
  await utimes(activity, 0, 0);

  expect(alive(instance.pid)).toBe(true);
  expect(existsSync(join(instance.evidence, 'idle-stop.txt'))).toBe(false);
  const stopped = await fixture.command('stop', instance.id);
  expect(stopped.code).toBe(0);
  expect(record(JSON.parse(stopped.stdout)).complete).toBe(true);
  expect(alive(instance.pid)).toBe(false);
  expect(existsSync(instance.folder)).toBe(false);
});

test('server doctor diagnoses startup separately from optional drivers before start', async ({
  onTestFinished,
}) => {
  const copy = await checkoutCopy(onTestFinished);
  const doctor = await cli(copy, SERVER_CLI, 'doctor');
  expect(doctor.code).toBe(0);
  expect(doctor.stdout).toContain('Startup dependencies:');
  expect(doctor.stdout).toContain('ready: Node, Git, ps and server sandbox');
  expect(doctor.stdout).toContain('Optional drivers:');
  expect(doctor.stdout).toContain('live instances: none');
  const bin = join(copy, 'doctor-path');
  await mkdir(bin);
  await symlink('/usr/bin/git', join(bin, 'git'));
  await symlink('/bin/ps', join(bin, 'ps'));
  if (process.platform === 'linux')
    await symlink('/usr/bin/bwrap', join(bin, 'bwrap'));
  const diagnose = () =>
    new Promise<Run>((resolveRun) => {
      execFile(
        process.execPath,
        [join(copy, '.agents/skills/server-verify/scripts/cli.ts'), 'doctor'],
        {
          cwd: copy,
          env: { ...process.env, PATH: bin },
        },
        (error, stdout, stderr) =>
          resolveRun({
            code: error === null ? 0 : Number(error.code ?? 1),
            stdout,
            stderr,
          }),
      );
    });
  const optional = await diagnose();
  expect(optional.code, optional.stderr).toBe(0);
  expect(optional.stdout).toContain(
    'curl: missing (optional; Node fetch can drive HTTP)',
  );
  await rm(join(bin, 'git'));
  const missingGit = await diagnose();
  expect(missingGit.code).toBe(1);
  expect(missingGit.stdout).toContain('git is missing: install Git');
  await rm(join(bin, 'ps'));
  const missingPs = await diagnose();
  expect(missingPs.code).toBe(1);
  expect(missingPs.stdout).toContain('ps is missing: install procps');
  expect(missingPs.stderr).toBe('');
});

test('a server card exposes private connections and deterministic operations retain redacted evidence', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished);
  const [, connectionPath = ''] =
    /\nconnection (.+)\n/.exec(instance.run.stdout) ?? [];
  expect(connectionPath, 'start prints the private connection path').toBe(
    join(dirname(instance.file), 'connection.json'),
  );
  const connection = record(JSON.parse(await readFile(connectionPath, 'utf8')));
  const fixtures = record(connection.fixtures);
  const build = record(connection.build);
  const origins = record(connection.requiredOrigin);
  const files = record(connection.credentialFiles);
  const manifest = record(
    JSON.parse(await readFile(text(instance.detail.manifestPath), 'utf8')),
  );
  const routes = record(connection.routes);
  const protocol = record(record(connection.live).protocolExample);
  const server = (...args: string[]) =>
    cli(repositoryRoot, SERVER_CLI, ...args, '--instance', instance.id);
  const ids = await server('ids');
  const issued = await server('pairing-link');
  const code = new URL(issued.stdout.trim()).hash.split('&')[0]?.slice(3) ?? '';
  const published = await server('agent', 'publish-review', 'CLI review');
  const layers = await server('server', 'published-review');
  const status = await server('status');
  const connectionMode = (await stat(connectionPath)).mode & 0o777;
  const folderMode = (await stat(dirname(connectionPath))).mode & 0o777;
  const stopped = await server('stop');
  const retained = await server('evidence');
  const repeated = await server('stop');
  const evidence = await evidenceOf(instance.evidence);

  expect(instance.run.code).toBe(0);
  expect(instance.run.stdout.trim().split('\n')).toHaveLength(9);
  expect(Object.keys(connection).toSorted()).toStrictEqual(
    [
      'instanceId',
      'surface',
      'build',
      'fixtures',
      'serverUrl',
      'webUrl',
      'webSocketUrl',
      'requiredOrigin',
      'ownerSocketPath',
      'serverDataDirectory',
      'credentialFiles',
      'pairing',
      'mcp',
      'evidenceDirectory',
      'statusCommand',
      'logsCommand',
      'stopCommand',
      'routes',
      'live',
    ].toSorted(),
  );
  expect(connection.instanceId).toBe(instance.id);
  expect(connection.surface).toBe('server');
  expect(build.commit).toMatch(/^[a-f0-9]{40}$/);
  expect(typeof build.dirty).toBe('boolean');
  expect(build.sourceFingerprint).toBe(instance.fingerprint);
  expect(build.startedAt).toBe(instance.startedAt);
  expect(fixtures.projectId).toBe(instance.detail.projectId);
  expect(fixtures.worktreeId).toBe(instance.detail.worktreeId);
  expect(fixtures.repositoryPath).toBe(instance.detail.repository);
  expect(fixtures.projectHome).toBe(instance.detail.projectHome);
  expect(fixtures.environmentId).toMatch(/^[a-f0-9-]{36}$/);
  expect(connection.serverUrl).toBe(instance.detail.address);
  expect(connection.webUrl).toBe(instance.detail.address);
  expect(connection.webSocketUrl).toBe(
    `${text(instance.detail.address).replace('http:', 'ws:')}/api/live`,
  );
  expect(origins).toStrictEqual({
    http: instance.detail.address,
    webSocket: instance.detail.address,
  });
  expect(existsSync(text(connection.ownerSocketPath))).toBe(false);
  expect(text(connection.serverDataDirectory)).toContain('/state');
  expect(files).toStrictEqual({ fixture: manifest.credentialFile });
  expect(connectionMode).toBe(0o600);
  expect(folderMode).toBe(0o700);
  expect(list(routes.owner)).toContain('POST /pairings');
  expect(list(routes.owner)).toContain('POST /mcp');
  expect(Object.keys(routes).toSorted()).toStrictEqual(['network', 'owner']);
  expect(list(routes.network)).toContain('GET /api/health');
  expect(list(routes.network)).toContain('PATCH /api/projects/:projectId');
  expect(
    [
      ...list(routes.owner).map((route) => `owner ${text(route)}`),
      ...list(routes.network).map(text),
    ].toSorted(),
  ).toStrictEqual(list(manifest.routes).map(text).toSorted());
  expect(record(protocol.notices)).toStrictEqual({
    _tag: 'Request',
    id: '1',
    tag: 'notices',
    payload: null,
    headers: [],
  });
  expect(record(protocol.ack)).toStrictEqual({ _tag: 'Ack', requestId: '1' });
  for (const name of ['statusCommand', 'logsCommand', 'stopCommand'])
    expect(text(connection[name])).toContain(instance.id);
  expect(text(record(connection.pairing).command)).toContain('pairing-link');
  expect(text(record(connection.mcp).command)).toContain(
    text(connection.serverDataDirectory),
  );
  expect(ids.code).toBe(0);
  expect(JSON.parse(ids.stdout)).toStrictEqual(fixtures);
  expect(issued.code).toBe(0);
  expect(issued.stdout).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/pair#c=pcp_/);
  expect(code).not.toBe('');
  expect(published.code).toBe(0);
  expect(published.stdout).toContain('reached the server');
  expect(layers.code).toBe(0);
  expect(layers.stdout).toContain('CLI review');
  expect(status.code).toBe(0);
  expect(record(JSON.parse(status.stdout)).stale).toBe(null);
  expect(stopped.code).toBe(0);
  expect(retained.code).toBe(0);
  expect(retained.stdout).toContain(instance.evidence);
  expect(repeated.code).toBe(0);
  expect(repeated.stdout).toContain('already stopped');
  expect(alive(instance.pid)).toBe(false);
  expect(evidence.numbered).toStrictEqual([
    '001-start.json',
    '002-ids.json',
    '003-pairing-link.json',
    '004-agent.json',
    '005-server.json',
    '006-server-stop.json',
    '007-stop.json',
  ]);
  expect(evidence.text).toContain('CLI review');
  expect(evidence.text).not.toContain(code);
  for (const secret of instance.secrets) {
    expect(instance.run.stdout).not.toContain(secret);
    expect(JSON.stringify(connection)).not.toContain(secret);
    expect(evidence.text).not.toContain(secret);
  }
  expect(existsSync(dirname(instance.file))).toBe(false);
});

test('a CLI command refuses to drive an instance once a server source file changed since start', async ({
  onTestFinished,
}) => {
  const copy = await checkoutCopy(onTestFinished);
  const instance = await started(onTestFinished, { root: copy });
  const before = await cli(copy, SERVER_CLI, 'server', 'project');
  await appendFile(join(copy, 'apps/server/src/config/limits.ts'), '\n');

  const refused = await cli(copy, SERVER_CLI, 'server', 'project');
  const status = await cli(
    copy,
    SERVER_CLI,
    'status',
    '--instance',
    instance.id,
  );
  const logs = await cli(copy, SERVER_CLI, 'logs', '--instance', instance.id);
  await cli(copy, SERVER_CLI, 'stop', '--instance', instance.id);
  const evidence = await evidenceOf(instance.evidence);

  expect(before.code).toBe(0);
  expect(record(JSON.parse(before.stdout)).id).toBe(instance.detail.projectId);
  expect(refused.stderr, 'a stale build is refused').toBe(STALE);
  expect(refused.code).toBe(1);
  expect(refused.stdout).toBe('');
  expect(status.code).toBe(0);
  expect(record(JSON.parse(status.stdout)).stale).toBe(STALE.trim());
  expect(logs.code).toBe(0);
  expect(evidence.numbered).toStrictEqual([
    '001-start.json',
    '002-server.json',
    '003-refused.json',
    '004-server-stop.json',
    '005-stop.json',
  ]);
});

test('a CLI command refuses to drive an instance once the CLI code changed since start', async ({
  onTestFinished,
}) => {
  const copy = await checkoutCopy(onTestFinished);
  await started(onTestFinished, { root: copy });
  await appendFile(join(copy, '.agents/skills/verify-core/registry.ts'), '\n');

  const refused = await cli(copy, SERVER_CLI, 'server', 'project');

  expect(refused.stderr).toBe(STALE);
  expect(refused.stdout).toBe('');
});

test('each checkout sees only the instances it started', async ({
  onTestFinished,
}) => {
  const copy = await checkoutCopy(onTestFinished);
  const instance = await started(onTestFinished, { root: copy });

  const elsewhere = await cli(
    repositoryRoot,
    SERVER_CLI,
    'server',
    'project',
    '--instance',
    instance.id,
  );
  const stoppedElsewhere = await cli(
    repositoryRoot,
    SERVER_CLI,
    'stop',
    '--instance',
    instance.id,
  );
  const evidenceElsewhere = await cli(
    repositoryRoot,
    SERVER_CLI,
    'evidence',
    '--instance',
    instance.id,
  );
  const own = await cli(copy, SERVER_CLI, 'server', 'project');

  expect(elsewhere.stderr).toMatch(
    new RegExp(`^no running instance ${instance.id} in this checkout`),
  );
  expect(elsewhere.code).toBe(1);
  expect(stoppedElsewhere.code).toBe(1);
  expect(evidenceElsewhere.code).toBe(1);
  expect(evidenceElsewhere.stdout).toBe('');
  expect(alive(instance.pid)).toBe(true);
  expect(record(JSON.parse(own.stdout)).id).toBe(instance.detail.projectId);
});

test('stop never signals a process whose command line is not the instance supervisor', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished);
  const stranger = spawn('sleep', ['300'], { stdio: 'ignore' });
  const strangerPid = stranger.pid ?? 0;
  onTestFinished(async () => {
    stranger.kill('SIGKILL');
    if (alive(instance.pid)) process.kill(instance.pid, 'SIGTERM');
    await settled(() => !alive(instance.pid));
  });
  const saved = record(JSON.parse(await readFile(instance.file, 'utf8')));
  await writeFile(
    instance.file,
    JSON.stringify({ ...saved, pid: strangerPid }),
  );

  const driven = await cli(
    repositoryRoot,
    SERVER_CLI,
    'server',
    'project',
    '--instance',
    instance.id,
  );
  const stopped = await cli(
    repositoryRoot,
    SERVER_CLI,
    'stop',
    '--instance',
    instance.id,
  );

  expect(driven.stderr).toMatch(
    new RegExp(`^no running instance ${instance.id} in this checkout`),
  );
  expect(stopped.stdout).toMatch(
    new RegExp(
      `process ${strangerPid} is not this instance's supervisor; it was not signalled`,
    ),
  );
  expect(stopped.code).toBe(1);
  expect(stopped.stdout).toContain('stop incomplete');
  expect(stopped.stdout).not.toMatch(/(?:^|\n)(?:already )?stopped /);
  expect(existsSync(instance.file)).toBe(true);
  expect(existsSync(join(dirname(instance.file), 'processes.json'))).toBe(true);
  expect(alive(strangerPid)).toBe(true);
  expect(alive(instance.pid)).toBe(true);
});

test('stop leaves an unrelated process alive even when its command contains a recorded marker', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished);
  const marker = `cliDaemon.js web-${instance.id}`;
  const stranger = spawn(
    process.execPath,
    ['-e', 'setInterval(() => {}, 1000)', '--', marker],
    { stdio: 'ignore', detached: true },
  );
  const strangerPid = stranger.pid ?? 0;
  onTestFinished(() => {
    stranger.kill('SIGKILL');
  });
  const saved = record(JSON.parse(await readFile(instance.file, 'utf8')));
  await writeFile(
    instance.file,
    JSON.stringify({ ...saved, markers: [marker] }),
  );

  const stopped = await cli(
    repositoryRoot,
    SERVER_CLI,
    'stop',
    '--instance',
    instance.id,
  );

  expect(stopped.code).toBe(0);
  expect(alive(strangerPid)).toBe(true);
  expect(alive(instance.pid)).toBe(false);
  const repeated = await cli(
    repositoryRoot,
    SERVER_CLI,
    'stop',
    '--instance',
    instance.id,
  );
  expect(repeated.code).toBe(0);
  expect(repeated.stdout).toContain('already stopped');
  expect(alive(strangerPid)).toBe(true);
});

test('stop refuses a PID without a captured owner even when its command names the instance', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished);
  const marker = `${join(repositoryRoot, '.agents/skills/server-verify/scripts/cli.ts')} serve ${dirname(instance.file)}`;
  const stranger = spawn(
    process.execPath,
    ['-e', 'setInterval(() => {}, 1000)', '--', marker],
    {
      stdio: 'ignore',
      detached: true,
    },
  );
  const strangerPid = stranger.pid ?? 0;
  onTestFinished(async () => {
    stranger.kill('SIGKILL');
    if (alive(instance.pid)) process.kill(instance.pid, 'SIGTERM');
    await settled(() => !alive(instance.pid));
  });
  const saved = record(JSON.parse(await readFile(instance.file, 'utf8')));
  await writeFile(
    instance.file,
    JSON.stringify({ ...saved, pid: strangerPid }),
  );

  const stopped = await cli(
    repositoryRoot,
    SERVER_CLI,
    'stop',
    '--instance',
    instance.id,
  );

  expect(stopped.code).toBe(1);
  expect(stopped.stdout).toContain(
    `process ${strangerPid} has no captured owner; it was not signalled`,
  );
  expect(stopped.stdout).toContain('stop incomplete');
  expect(stopped.stdout).not.toMatch(/(?:^|\n)(?:already )?stopped /);
  expect(existsSync(instance.file)).toBe(true);
  expect(existsSync(join(dirname(instance.file), 'processes.json'))).toBe(true);
  expect(alive(strangerPid)).toBe(true);
  expect(alive(instance.pid)).toBe(true);
});

test('stop refuses a stale process identity even when its PID and command still match', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished);
  const stranger = spawn('sleep', ['300'], { stdio: 'ignore', detached: true });
  const strangerPid = stranger.pid ?? 0;
  onTestFinished(() => {
    stranger.kill('SIGKILL');
  });
  const command = spawnSync(
    'ps',
    ['-p', String(strangerPid), '-ww', '-o', 'args='],
    {
      encoding: 'utf8',
    },
  ).stdout.trim();
  const ledger = join(dirname(instance.file), 'processes.json');
  const owned = list(JSON.parse(await readFile(ledger, 'utf8')));
  await writeFile(
    ledger,
    JSON.stringify([
      ...owned,
      {
        pid: strangerPid,
        pgid: strangerPid,
        command,
        birth: 'a previous process at this PID',
      },
    ]),
  );

  const stopped = await cli(
    repositoryRoot,
    SERVER_CLI,
    'stop',
    '--instance',
    instance.id,
  );

  expect(stopped.code).toBe(1);
  expect(stopped.stdout).toContain(
    `process ${strangerPid} has a different identity; it was not signalled`,
  );
  expect(stopped.stdout).toContain('stop incomplete');
  expect(stopped.stdout).not.toMatch(/(?:^|\n)(?:already )?stopped /);
  expect(existsSync(instance.file)).toBe(true);
  expect(existsSync(ledger)).toBe(true);
  const outcome = record(
    JSON.parse(
      await readFile(join(instance.evidence, 'stop-result.json'), 'utf8'),
    ),
  );
  const retained = await cli(
    repositoryRoot,
    SERVER_CLI,
    'evidence',
    '--instance',
    instance.id,
  );
  const evidence = await evidenceOf(instance.evidence);
  expect(outcome.complete).toBe(false);
  expect(retained.code).toBe(0);
  expect(retained.stdout).toContain(instance.evidence);
  expect(
    instance.secrets.filter((secret) => evidence.text.includes(secret)),
  ).toStrictEqual([]);
  expect(alive(strangerPid)).toBe(true);
  expect(alive(instance.pid)).toBe(false);
});

test('failed startup cleans a captured detached child even when the supervisor dies before readiness', async ({
  onTestFinished,
}) => {
  const copy = await checkoutCopy(onTestFinished);
  const fixture = '.agents/skills/server-verify/scripts/crash.mjs';
  const pidFile = join(copy, 'crash-child.pid');
  await writeFile(
    join(copy, fixture),
    String.raw`#!/usr/bin/env node
import { Schema } from 'effect';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Registry } from '../../verify-core/registry.ts';
const registry = new Registry({
  name: 'server',
  cli: import.meta.url,
  detail: Schema.Struct({}),
  inputs: { roots: [], apps: [] },
  format: 'text',
  stale: () => undefined,
  stopWithinMs: 1000,
});
if (process.argv[2] === 'serve') {
  await registry.serve(process.argv[3], async (life) => {
    const child = spawn('sleep', ['300'], { stdio: 'ignore', detached: true });
    life.own(child.pid);
    writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
    process.kill(process.pid, 'SIGKILL');
    return {};
  });
} else {
  try {
    await registry.launch({}, 5000);
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
`,
    { mode: 0o700 },
  );
  let childPid = 0;
  onTestFinished(() => {
    if (childPid > 0 && alive(childPid)) process.kill(childPid, 'SIGKILL');
  });

  const run = await cli(copy, fixture, 'start');
  childPid = Number(await readFile(pidFile, 'utf8'));
  const [, id = ''] = /instance (\S+) did not start/.exec(run.stderr) ?? [];
  const [, evidence = ''] = /evidence: (.+)\n/.exec(run.stderr) ?? [];

  expect(run.code).toBe(1);
  expect(id).not.toBe('');
  expect(alive(childPid)).toBe(false);
  expect(existsSync(dirname(instanceFile(copy, 'server', id)))).toBe(false);
  expect(existsSync(join(evidence, 'supervisor.log'))).toBe(true);
});

test('stopping one instance leaves another instance in the same checkout usable', async ({
  onTestFinished,
}) => {
  const copy = await checkoutCopy(onTestFinished);
  const first = await started(onTestFinished, { root: copy });
  const second = await started(onTestFinished, { root: copy });
  const ambiguousStop = await cli(copy, SERVER_CLI, 'stop');
  const ambiguousEvidence = await cli(copy, SERVER_CLI, 'evidence');

  const stopped = await cli(copy, SERVER_CLI, 'stop', '--instance', first.id);
  const health = await cli(
    copy,
    SERVER_CLI,
    'server',
    'project',
    '--instance',
    second.id,
  );

  expect(stopped.code).toBe(0);
  expect(ambiguousStop.code).toBe(1);
  expect(ambiguousEvidence.code).toBe(1);
  expect(ambiguousStop.stderr).toContain('--instance');
  expect(ambiguousEvidence.stderr).toContain('--instance');
  expect(alive(first.pid)).toBe(false);
  expect(alive(second.pid)).toBe(true);
  expect(health.code).toBe(0);
  expect(record(JSON.parse(health.stdout)).id).toBe(second.detail.projectId);
});

test('retained sessions require an explicit valid instance selector and never guess history', async ({
  onTestFinished,
}) => {
  const copy = await checkoutCopy(onTestFinished);
  const instance = await started(onTestFinished, { root: copy });
  const unknown = instance.id === '00000000' ? 'ffffffff' : '00000000';
  const foreignSelectors = [unknown, `../${instance.id}`, 'ABCD1234'];
  for (const selector of foreignSelectors) {
    const evidence = await cli(
      copy,
      SERVER_CLI,
      'evidence',
      '--instance',
      selector,
    );
    const stopped = await cli(copy, SERVER_CLI, 'stop', '--instance', selector);
    expect(evidence.code).toBe(1);
    expect(evidence.stdout).toBe('');
    expect(stopped.code).toBe(1);
    expect(stopped.stdout).not.toMatch(/(?:^|\n)(?:already )?stopped /);
    expect(alive(instance.pid)).toBe(true);
  }
  const stopped = await cli(
    copy,
    SERVER_CLI,
    'stop',
    '--instance',
    instance.id,
  );
  const evidenceWithoutId = await cli(copy, SERVER_CLI, 'evidence');
  const stopWithoutId = await cli(copy, SERVER_CLI, 'stop');
  const retained = await cli(
    copy,
    SERVER_CLI,
    'evidence',
    '--instance',
    instance.id,
  );
  expect(stopped.code).toBe(0);
  expect(evidenceWithoutId.code).toBe(1);
  expect(stopWithoutId.code).toBe(1);
  expect(retained.code).toBe(0);
  expect(retained.stdout).toContain(instance.evidence);
});

test('stop ends the sandboxed server of an instance whose supervisor is gone', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished);
  const build = join(dirname(instance.file), 'build');
  const before = running(build);
  process.kill(instance.pid, 'SIGKILL');
  await settled(() => !alive(instance.pid));

  const stopped = await cli(
    repositoryRoot,
    SERVER_CLI,
    'stop',
    '--instance',
    instance.id,
  );

  expect(before, 'the sandboxed server runs before the stop').not.toStrictEqual(
    [],
  );
  expect(stopped.code).toBe(0);
  expect(stopped.stdout).toMatch(
    new RegExp(`stopped owned process group ${instance.pid}`),
  );
  expect(running(build)).toStrictEqual([]);
});

test('a supervisor stopped after its instance folder was removed still ends its sandboxed server', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished);
  const build = join(dirname(instance.file), 'build');
  const before = running(build);
  await rm(dirname(instance.file), { recursive: true, force: true });

  process.kill(instance.pid, 'SIGTERM');
  const exited = await settled(() => !alive(instance.pid));

  expect(before, 'the sandboxed server runs before the stop').not.toStrictEqual(
    [],
  );
  expect(exited).toBe(true);
  expect(running(build)).toStrictEqual([]);
});

test('concurrent commands each record their own numbered evidence file', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished);

  const runs = await Promise.all(
    Array.from({ length: 6 }, () =>
      cli(
        repositoryRoot,
        SERVER_CLI,
        'server',
        'project',
        '--instance',
        instance.id,
      ),
    ),
  );
  await cli(repositoryRoot, SERVER_CLI, 'stop', '--instance', instance.id);
  const evidence = await evidenceOf(instance.evidence);

  expect(runs.map((run) => run.code)).toStrictEqual([0, 0, 0, 0, 0, 0]);
  expect(evidence.numbered).toStrictEqual([
    '001-start.json',
    '002-server.json',
    '003-server.json',
    '004-server.json',
    '005-server.json',
    '006-server.json',
    '007-server.json',
    '008-server-stop.json',
    '009-stop.json',
  ]);
});

test(
  'the web CLI publishes a browser-free connection card and a fresh pairing link, then stops its server and Vite',
  async ({ onTestFinished }) => {
    const instance = await started(onTestFinished, { path: WEB_CLI });
    const web = (...args: string[]) =>
      cli(repositoryRoot, WEB_CLI, ...args, '--instance', instance.id);
    expect(instance.run.stdout).toContain('\nconnection ');
    const [, connectionPath = ''] =
      /\nconnection (\S+)\n/.exec(instance.run.stdout) ?? [];
    const connection = record(
      JSON.parse(await readFile(connectionPath, 'utf8')),
    );
    expect(connection.surface).toBe('web');
    expect(connection.webUrl).toBe(instance.detail.web);
    expect(connection.serverUrl).toBe(instance.detail.address);
    expect(connection.webSocketUrl).toBe(
      text(instance.detail.web).replace(/^http/, 'ws') + '/api/live',
    );
    expect(connection.webMode).toBe('test');
    expect(connection.initialRoute).toBe(
      `/${text(instance.detail.projectId)}/${text(instance.detail.worktreeId)}`,
    );
    expect(record(connection.requiredOrigin)).toStrictEqual({
      http: instance.detail.web,
      webSocket: instance.detail.web,
    });
    expect(record(connection.fixtures).repositoryPath).toBe(
      instance.detail.repository,
    );
    expect(record(connection.pairing).command).toContain(
      "'pairing-link' '--instance'",
    );
    expect(record(connection.remote).startCommand).toContain(
      "'remote' 'start' '--instance'",
    );
    expect((await stat(connectionPath)).mode & 0o777).toBe(0o600);
    expect(instance.detail).not.toHaveProperty('session');
    expect(existsSync(join(instance.evidence, 'browser.json'))).toBe(false);
    const owned = list(
      JSON.parse(
        await readFile(join(dirname(instance.file), 'processes.json'), 'utf8'),
      ),
    ).map(record);
    expect(
      owned.some((process) =>
        /cliDaemon|chromium|chrome-headless/i.test(text(process.command)),
      ),
    ).toBe(false);
    const vite = await fetch(text(connection.webUrl) + '/src/main.tsx');
    expect(vite.status).toBe(200);
    expect(vite.headers.get('content-type')).toContain('javascript');
    const health = await fetch(text(connection.webUrl) + '/api/health');
    expect(health.status).toBe(200);
    expect(health.headers.get('content-type')).toContain('application/json');
    const status = printed(await web('status'));
    expect(record(status).alive).toBe(true);
    expect(record(status).connectionPath).toBe(connectionPath);
    expect((await web('logs')).code).toBe(0);

    const first = await web('pairing-link');
    const second = await web('pairing-link');
    expect(first.code).toBe(0);
    const link = new URL(first.stdout.trim());
    expect(link.origin).toBe(connection.webUrl);
    expect(link.pathname).toBe('/pair');
    const fragment = new URLSearchParams(link.hash.slice(1));
    const code = fragment.get('c') ?? '';
    expect(code).toMatch(/^pcp_/);
    expect(fragment.get('e')).toBe(record(connection.fixtures).environmentId);
    expect(second.stdout).not.toBe(first.stdout);
    const stopped = await web('stop');
    expect(stopped.code).toBe(0);
    expect(existsSync(dirname(instance.file))).toBe(false);
    expect(
      await fetch(text(connection.webUrl)).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
    expect(
      await fetch(text(connection.serverUrl)).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
    const evidence = await evidenceOf(instance.evidence);
    expect(evidence.text).toContain('/pair#c=[redacted]&e=');
    expect(evidence.text).not.toContain(code);
    expect((await web('evidence')).stdout.trim()).toBe(instance.evidence);
    expect((await web('stop')).stdout).toContain(
      `already stopped ${instance.id}`,
    );
  },
  WEB_CASE_MS,
);

test(
  'concurrent web commands each record their own numbered evidence file',
  async ({ onTestFinished }) => {
    const instance = await started(onTestFinished, { path: WEB_CLI });

    const runs = await Promise.all(
      Array.from({ length: 4 }, () =>
        cli(
          repositoryRoot,
          WEB_CLI,
          'server',
          'project',
          '--instance',
          instance.id,
        ),
      ),
    );
    await cli(repositoryRoot, WEB_CLI, 'stop', '--instance', instance.id);
    const evidence = await evidenceOf(instance.evidence);

    expect(runs.map((run) => run.code)).toStrictEqual([0, 0, 0, 0]);
    expect(evidence.numbered).toStrictEqual([
      '001-start.json',
      '002-server-project.json',
      '003-server-project.json',
      '004-server-project.json',
      '005-server-project.json',
    ]);
  },
  WEB_CASE_MS,
);

function printed(run: Run): unknown {
  const [json = ''] = run.stdout.split('\nrecorded ');
  return JSON.parse(json);
}

test(
  'an agent comment sent through the web CLI reaches the disposable MCP route and typed readback',
  async ({ onTestFinished }) => {
    const instance = await started(onTestFinished, { path: WEB_CLI });
    const web = (...args: string[]) =>
      cli(repositoryRoot, WEB_CLI, ...args, '--instance', instance.id);
    const body = 'Sent through the web CLI as the agent';

    const sent = await web('agent', 'comment', 'README.md', body);
    const threads = list(printed(await web('server', 'comment-threads')));
    const evidence = await evidenceOf(instance.evidence);

    expect(sent.code).toBe(0);
    expect(threads.map((thread) => record(thread).anchor)).toStrictEqual([
      { kind: 'file', filePath: 'README.md' },
    ]);
    expect(
      list(record(threads[0]).messages).map((message) => {
        const { author, body: said } = record(message);
        return { author, said };
      }),
    ).toStrictEqual([{ author: 'agent', said: body }]);
    expect(evidence.text).toContain(body);
    expect(evidence.numbered).toContain('002-agent-comment.json');
  },
  WEB_CASE_MS,
);

test(
  'the web CLI prints the second computer’s pairing link and keeps it and that computer’s credentials out of its evidence',
  async ({ onTestFinished }) => {
    const instance = await started(onTestFinished, { path: WEB_CLI });
    const web = (...args: string[]) =>
      cli(repositoryRoot, WEB_CLI, ...args, '--instance', instance.id);
    const remote = await web('remote', 'start');
    const issued = await web('remote', 'pairing-link');
    const [link = ''] = issued.stdout.split('\n');
    const code = decodeURIComponent(/#c=([^&]+)/.exec(link)?.[1] ?? '');
    const secrets = list(
      record(JSON.parse(await readFile(instance.file, 'utf8'))).secrets,
    ).map(text);
    const added = secrets.filter(
      (secret) => !instance.secrets.includes(secret),
    );

    await web('stop');
    const evidence = await evidenceOf(instance.evidence);

    expect(remote.code).toBe(0);
    expect(evidence.numbered).toContain('003-remote-pairing-link.json');
    expect(code, 'the link is printed for the next step').toMatch(/^pcp_/);
    expect(added, 'the second computer’s credentials').toHaveLength(2);
    expect(
      record(
        JSON.parse(
          await readFile(
            join(instance.evidence, '003-remote-pairing-link.json'),
            'utf8',
          ),
        ),
      ).output,
    ).toBe('[redacted]\n');
    expect(
      [...secrets, code].filter((secret) => evidence.text.includes(secret)),
      'no credential or code in the evidence',
    ).toStrictEqual([]);
    expect(
      secrets.filter(
        (secret) =>
          remote.stdout.includes(secret) || issued.stdout.includes(secret),
      ),
      'no credential printed',
    ).toStrictEqual([]);
  },
  WEB_CASE_MS,
);
