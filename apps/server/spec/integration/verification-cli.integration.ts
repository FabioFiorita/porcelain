import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  appendFile,
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type TestContext } from 'vitest';
import { test } from '../kit/server-test.ts';
import { isRecord, list, record, text } from '../kit/session.ts';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const SERVER_CLI = '.agents/skills/server-verify/scripts/cli';
const WEB_CLI = '.agents/skills/web-verify/scripts/cli';
const STALE = 'server or CLI code changed since start, run start again\n';
const PAIRING_CODE =
  'pcp_0b6f3d1e-2a4c-4e8b-9f10-3c5d7e9a1b2c_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde';
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
  const [, id = ''] = /^instance (\S+)\n/.exec(run.stdout) ?? [];
  const [, evidence = ''] = /\nevidence (\S+)\n/.exec(run.stdout) ?? [];
  const surface = path === WEB_CLI ? 'web' : 'server';
  const file = instanceFile(root, surface, id);
  onTestFinished(async () => {
    if (existsSync(file)) await cli(root, path, 'stop', '--instance', id);
  });
  const instance = record(JSON.parse(await readFile(file, 'utf8')));
  return {
    run,
    id,
    evidence,
    file,
    pid: Number(instance.pid),
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
  onTestFinished(async () => {
    const instances = dirname(instanceFile(copy, 'server', ''));
    for (const id of existsSync(instances) ? await readdir(instances) : [])
      await cli(copy, SERVER_CLI, 'stop', '--instance', id);
    await rm(copy, { recursive: true, force: true });
  });
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

test('a CLI session records numbered, redacted evidence and never shows the instance credential', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished);
  const [credential = ''] = instance.secrets;
  const issued = await cli(
    repositoryRoot,
    SERVER_CLI,
    'request',
    'POST',
    '/pairings',
    '--owner',
    '--instance',
    instance.id,
    'labels:=["CLI device"]',
    `addresses:=["${text(instance.detail.address)}"]`,
  );
  const code = text(
    record(list(record(JSON.parse(issued.stdout.slice(9))).grants)[0]).code,
  );
  const paired = await cli(
    repositoryRoot,
    SERVER_CLI,
    'request',
    'POST',
    '/api/pair',
    '--anonymous',
    '--instance',
    instance.id,
    `code=${code}`,
    'platform=CLI',
  );
  const pairedCredential = text(
    record(JSON.parse(paired.stdout.slice(9))).credential,
  );
  const stopped = await cli(
    repositoryRoot,
    SERVER_CLI,
    'stop',
    '--instance',
    instance.id,
  );
  const evidence = await evidenceOf(instance.evidence);
  const pairing = record(
    JSON.parse(
      await readFile(join(instance.evidence, '003-request.json'), 'utf8'),
    ),
  );
  const steps: unknown[] = Array.isArray(pairing.steps) ? pairing.steps : [];
  const exchange = isRecord(steps[0]) ? steps[0] : {};

  expect(instance.run.code).toBe(0);
  expect(credential).not.toBe('');
  expect(evidence.numbered).toStrictEqual([
    '001-start.json',
    '002-request.json',
    '003-request.json',
    '004-server-stop.json',
    '005-stop.json',
  ]);
  expect(instance.run.stdout).not.toContain(credential);
  expect(issued.stdout).not.toContain(credential);
  expect(paired.stdout).not.toContain(credential);
  expect(stopped.stdout).not.toContain(credential);
  expect(evidence.text).not.toContain(credential);
  expect(evidence.text).not.toContain(code);
  expect(evidence.text).not.toContain(pairedCredential);
  expect(
    exchange.request,
    'redacted evidence keeps the exchange',
  ).toStrictEqual({
    method: 'POST',
    path: '/api/pair',
    headers: { 'content-type': 'application/json' },
    body: { code: '[redacted]', platform: 'CLI' },
  });
  expect(record(exchange.response).status).toBe(200);
  expect(record(record(exchange.response).body).credential).toBe('[redacted]');
  expect(existsSync(instance.file)).toBe(false);
});

test('a CLI command refuses to drive an instance once a server source file changed since start', async ({
  onTestFinished,
}) => {
  const copy = await checkoutCopy(onTestFinished);
  const instance = await started(onTestFinished, { root: copy });
  const before = await cli(copy, SERVER_CLI, 'request', 'GET', '/api/health');
  await appendFile(join(copy, 'apps/server/src/config/limits.ts'), '\n');

  const refused = await cli(copy, SERVER_CLI, 'request', 'GET', '/api/health');
  await cli(copy, SERVER_CLI, 'stop', '--instance', instance.id);
  const evidence = await evidenceOf(instance.evidence);

  expect(before.stdout).toMatch(/^HTTP 200\n/);
  expect(refused.stderr, 'a stale build is refused').toBe(STALE);
  expect(refused.code).toBe(1);
  expect(refused.stdout).toBe('');
  expect(evidence.numbered).toStrictEqual([
    '001-start.json',
    '002-request.json',
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
  await appendFile(
    join(copy, '.agents/skills/server-verify/scripts/core/registry.ts'),
    '\n',
  );

  const refused = await cli(copy, SERVER_CLI, 'request', 'GET', '/api/health');

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
    'request',
    'GET',
    '/api/health',
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
  const own = await cli(copy, SERVER_CLI, 'request', 'GET', '/api/health');

  expect(elsewhere.stderr).toMatch(
    new RegExp(`^no running instance ${instance.id} in this checkout`),
  );
  expect(elsewhere.code).toBe(1);
  expect(stoppedElsewhere.code).toBe(1);
  expect(alive(instance.pid)).toBe(true);
  expect(own.stdout).toMatch(/^HTTP 200\n/);
});

test('stop never signals a process whose command line is not the instance supervisor', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished);
  const stranger = spawn('sleep', ['300'], { stdio: 'ignore' });
  const strangerPid = stranger.pid ?? 0;
  onTestFinished(() => {
    stranger.kill('SIGKILL');
    if (alive(instance.pid)) process.kill(instance.pid, 'SIGTERM');
  });
  const saved = record(JSON.parse(await readFile(instance.file, 'utf8')));
  await writeFile(
    instance.file,
    JSON.stringify({ ...saved, pid: strangerPid }),
  );

  const driven = await cli(
    repositoryRoot,
    SERVER_CLI,
    'request',
    'GET',
    '/api/health',
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
      `^process ${strangerPid} is not this instance's supervisor .*; it was not signalled\n`,
    ),
  );
  expect(alive(strangerPid)).toBe(true);
  expect(alive(instance.pid)).toBe(true);
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
        'request',
        'GET',
        '/api/health',
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
    '002-request.json',
    '003-request.json',
    '004-request.json',
    '005-request.json',
    '006-request.json',
    '007-request.json',
    '008-server-stop.json',
    '009-stop.json',
  ]);
});

test('the web CLI keeps a pairing code typed with fill or shown in a snapshot out of its evidence', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished, { path: WEB_CLI });
  const web = (...args: string[]) =>
    cli(repositoryRoot, WEB_CLI, ...args, '--instance', instance.id);
  await web('open', '/');
  await web('click', '--role', 'button', '--name', 'Commit');

  const filled = await web(
    'fill',
    '--role',
    'textbox',
    '--name',
    'Message',
    `Pairing code ${PAIRING_CODE}`,
  );
  const snapshot = await web('snapshot');
  await web('stop');
  const evidence = await evidenceOf(instance.evidence);

  expect(filled.code).toBe(0);
  expect(filled.stdout).not.toContain(PAIRING_CODE);
  expect(snapshot.stdout, 'the snapshot prints what the page shows').toContain(
    PAIRING_CODE,
  );
  expect(evidence.text).toContain('Pairing code [redacted]');
  expect(evidence.text).not.toContain(PAIRING_CODE);
  expect(evidence.numbered).toStrictEqual([
    '000-start.txt',
    '001-open.txt',
    '002-click.txt',
    '003-fill.txt',
    '004-snapshot.txt',
    '004-snapshot.yml',
  ]);
});

test('concurrent web commands each record their own numbered evidence file', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished, { path: WEB_CLI });

  const runs = await Promise.all(
    Array.from({ length: 4 }, () =>
      cli(repositoryRoot, WEB_CLI, 'console', '--instance', instance.id),
    ),
  );
  await cli(repositoryRoot, WEB_CLI, 'stop', '--instance', instance.id);
  const evidence = await evidenceOf(instance.evidence);

  expect(runs.map((run) => run.code)).toStrictEqual([0, 0, 0, 0]);
  expect(evidence.numbered).toStrictEqual([
    '000-start.txt',
    '001-console.txt',
    '002-console.txt',
    '003-console.txt',
    '004-console.txt',
  ]);
});
