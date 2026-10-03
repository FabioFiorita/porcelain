import { execFile, spawn, spawnSync } from 'node:child_process';
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
import { setTimeout as delay } from 'node:timers/promises';
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
const WEB_CASE_MS = 3 * 60_000;
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
    await cli(root, path, 'stop', '--instance', id);
    expect(
      running(dirname(file)),
      'no process of the instance outlives its stop',
    ).toStrictEqual([]);
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
  for (let attempt = 0; attempt < 200 && !done(); attempt += 1)
    await delay(100);
  return done();
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
  await appendFile(join(copy, '.agents/skills/verify-core/registry.ts'), '\n');

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
    new RegExp(`^stopped 1 process left in process group ${instance.pid}\n`),
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

test(
  'the web CLI keeps a pairing code typed with fill or shown in a snapshot out of its output and evidence',
  async ({ onTestFinished }) => {
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
    expect(snapshot.stdout).toContain('Pairing code [redacted]');
    expect(snapshot.stdout).not.toContain(PAIRING_CODE);
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
  },
  WEB_CASE_MS,
);

test(
  'click and press print the changed page even when its URL stays the same, and network accepts static resources',
  async ({ onTestFinished }) => {
    const instance = await started(onTestFinished, { path: WEB_CLI });
    const web = (...args: string[]) =>
      cli(repositoryRoot, WEB_CLI, ...args, '--instance', instance.id);
    await web('open', '/');

    const clicked = await web('click', '--role', 'button', '--name', 'Commit');
    const pressed = await web('press', 'Escape');
    const network = await web('network', '--static');
    await web('stop');
    const evidence = await evidenceOf(instance.evidence);

    expect(clicked.code).toBe(0);
    expect(clicked.stdout).toContain('dialog "Commit changes"');
    expect(clicked.stdout).toContain('textbox "Message"');
    expect(pressed.code).toBe(0);
    expect(pressed.stdout).toContain('button "Commit"');
    expect(pressed.stdout).not.toContain('dialog "Commit changes"');
    expect(network.code).toBe(0);
    expect(network.stdout).toContain('/@vite/client');
    expect(evidence.text).toContain('dialog "Commit changes"');
  },
  WEB_CASE_MS,
);

test(
  'concurrent web commands each record their own numbered evidence file',
  async ({ onTestFinished }) => {
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
  },
  WEB_CASE_MS,
);

function printed(run: Run): unknown {
  const [json = ''] = run.stdout.split('\nrecorded ');
  return JSON.parse(json);
}

function markedPaths(run: Run): string[] {
  return list(record(printed(run)).marks).map((mark) =>
    text(record(mark).path),
  );
}

test(
  'an agent comment sent through the web CLI reaches the server and the page shows it',
  async ({ onTestFinished }) => {
    const instance = await started(onTestFinished, { path: WEB_CLI });
    const web = (...args: string[]) =>
      cli(repositoryRoot, WEB_CLI, ...args, '--instance', instance.id);
    const body = 'Sent through the web CLI as the agent';

    const sent = await web('agent', 'comment', 'README.md', body);
    const threads = list(printed(await web('server', 'comment-threads')));
    const shown = await web('wait', '--text', body);

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
    expect(shown.code, 'the page shows the agent comment').toBe(0);
  },
  WEB_CASE_MS,
);

test(
  'network hold keeps a request away from the server until network release',
  async ({ onTestFinished }) => {
    const instance = await started(onTestFinished, { path: WEB_CLI });
    const web = (...args: string[]) =>
      cli(repositoryRoot, WEB_CLI, ...args, '--instance', instance.id);
    await web('network', 'hold', 'PUT /api/worktrees/:worktreeId/reviewed');
    await web(
      'click',
      '--role',
      'button',
      '--name',
      'Mark README.md as reviewed',
    );

    const whileHeld = markedPaths(await web('server', 'reviewed-files'));
    const released = await web('network', 'release');
    const shown = await web(
      'wait',
      '--role',
      'button',
      '--name',
      'Unmark README.md as unreviewed',
    );
    const afterRelease = markedPaths(await web('server', 'reviewed-files'));

    expect(whileHeld, 'the held mark has not reached the server').toStrictEqual(
      [],
    );
    expect(released.stdout).toMatch(
      /^PUT \/api\/worktrees\/:worktreeId\/reviewed: released 1 held request\n/,
    );
    expect(shown.code).toBe(0);
    expect(afterRelease).toStrictEqual(['README.md']);
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
    expect(code, 'the link is printed for the next step').toMatch(/^pcp_/);
    expect(added, 'the second computer’s credentials').toHaveLength(2);
    expect(evidence.text).toContain('/pair#c=[redacted]&e=');
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
