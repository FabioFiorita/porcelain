import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
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
import { afterAll, expect, type TestContext } from 'vitest';
import { list, record, text } from '@porcelain/server/kit/session';

const sourceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
export const SERVER_CLI = '.agents/skills/server-verify/scripts/cli';
export const WEB_CLI = '.agents/skills/web-verify/scripts/cli';
export const WEB_CASE_MS = 3 * 60_000;
export const STALE =
  'server or CLI code changed since start, run start again\n';
const copiedAway = new Set([
  'node_modules',
  '.git',
  '.claude',
  '.turbo',
  'dist',
  'test-results',
]);

export type Run = { code: number; stdout: string; stderr: string };
type Finished = TestContext['onTestFinished'];

export function cli(
  root: string,
  path: string,
  ...args: string[]
): Promise<Run> {
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

export function instanceFile(
  root: string,
  surface: string,
  id: string,
): string {
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

export async function started(
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

export async function evidenceOf(folder: string) {
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

export async function checkoutCopy(onTestFinished: Finished): Promise<string> {
  const copy = await mkdtemp(join(tmpdir(), 'porcelain-checkout-'));
  onTestFinished(() => rm(copy, { recursive: true, force: true }));
  const linked: string[] = [];
  await cp(sourceRoot, copy, {
    recursive: true,
    filter: (source) => {
      if (!copiedAway.has(basename(source))) return true;
      if (basename(source) === 'node_modules')
        linked.push(relative(sourceRoot, source));
      return false;
    },
  });
  for (const path of linked)
    await symlink(join(sourceRoot, path), join(copy, path));
  return copy;
}

export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function running(fragment: string): string[] {
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

export async function settled(done: () => boolean): Promise<boolean> {
  try {
    await expect.poll(done, { timeout: 20_000 }).toBe(true);
    return true;
  } catch {
    return false;
  }
}

export async function sessionFixture(onTestFinished: Finished) {
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

export function printed(run: Run): unknown {
  const [json = ''] = run.stdout.split('\nrecorded ');
  return JSON.parse(json);
}

export const repositoryRoot = await checkoutCopy((cleanup) => {
  afterAll(cleanup);
});
for (const args of [
  ['init', '--quiet'],
  [
    '-c',
    'user.name=Porcelain Test',
    '-c',
    'user.email=test@example.invalid',
    '-c',
    'commit.gpgsign=false',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '--quiet',
    '--allow-empty',
    '-m',
    'Verification fixture',
  ],
]) {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
}
