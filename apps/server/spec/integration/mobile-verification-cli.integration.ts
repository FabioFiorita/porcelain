import { execFile, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type TestContext } from 'vitest';
import { list, record, text } from '../kit/session.ts';

const root = resolve(import.meta.dirname, '../../../..');
const cli = join(root, '.agents/skills/mobile-verify/scripts/cli.ts');

async function fixture({ onTestFinished }: TestContext) {
  const scratch = await mkdtemp(join(tmpdir(), 'porcelain-mobile-refresh-'));
  const id = randomBytes(4).toString('hex');
  const home = join(
    tmpdir(),
    'porcelain-verify',
    createHash('sha256').update(root).digest('hex').slice(0, 16),
    'mobile',
  );
  const folder = join(home, 'instances', id);
  const evidence = join(home, 'evidence', id);
  const file = join(folder, 'instance.json');
  const calls = join(scratch, 'calls.jsonl');
  await mkdir(evidence, { recursive: true });
  onTestFinished(async () => {
    await rm(folder, { recursive: true, force: true });
    await rm(evidence, { recursive: true, force: true });
    await rm(scratch, { recursive: true, force: true });
  });
  await writeFile(
    join(scratch, 'agent-device'),
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
appendFileSync(process.env.REFRESH_CALLS, JSON.stringify(process.argv.slice(2)) + '\\n');
process.stdout.write(process.env.REFRESH_STATUS === '0' ? 'reload accepted\\n' : 'reload rejected\\n');
process.exit(Number(process.env.REFRESH_STATUS));
`,
    { mode: 0o700 },
  );
  const supervisor = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { mkdir, writeFile } from 'node:fs/promises';
import { registry, scriptFingerprint } from ${JSON.stringify(pathToFileURL(join(root, '.agents/skills/mobile-verify/scripts/instance.ts')).href)};
import { nativeFingerprint } from ${JSON.stringify(pathToFileURL(join(root, 'apps/mobile/spec/kit/development-client.ts')).href)};
await mkdir(${JSON.stringify(folder)}, { recursive: true });
await writeFile(${JSON.stringify(file)}, JSON.stringify({
  id: ${JSON.stringify(id)}, pid: process.pid, folder: ${JSON.stringify(folder)},
  evidence: ${JSON.stringify(evidence)}, fingerprint: registry.fingerprint(),
  startedAt: new Date().toISOString(), secrets: [],
  detail: { kind: 'iphone', udid: 'refresh-proof-simulator', simulator: 'Refresh proof',
    session: 'refresh-proof-${id}', metro: 'http://localhost:45789', server: 'http://localhost:45790',
    manifest: '', repository: '', native: await nativeFingerprint(), script: 'before-refresh', host: null }
}));
process.stdout.write(JSON.stringify({ script: scriptFingerprint() }) + '\\n');
setInterval(() => {}, 1000);
`,
      cli,
      'serve',
      folder,
    ],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  onTestFinished(async () => {
    if (supervisor.exitCode === null && supervisor.signalCode === null) {
      const exited = once(supervisor, 'exit');
      supervisor.kill('SIGTERM');
      await exited;
    }
  });
  let stderr = '';
  supervisor.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const ready = await new Promise<{ script: string }>((done, fail) => {
    let output = '';
    supervisor.once('error', fail);
    supervisor.once('exit', () => fail(new Error(stderr || 'fixture exited')));
    supervisor.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes('\n')) {
        done({ script: text(record(JSON.parse(output.trim())).script) });
      }
    });
  });
  const run = (status: number) =>
    new Promise<{ code: number; stdout: string; stderr: string }>((done) => {
      execFile(
        process.execPath,
        [cli, 'refresh', '--instance', id],
        {
          cwd: root,
          env: {
            ...process.env,
            PATH: `${scratch}:${process.env.PATH ?? ''}`,
            REFRESH_CALLS: calls,
            REFRESH_STATUS: String(status),
          },
        },
        (error, stdout, errorOutput) =>
          done({
            code: error === null ? 0 : Number(error.code),
            stdout,
            stderr: errorOutput,
          }),
      );
    });
  const commands = async () =>
    (await readFile(calls, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => list(JSON.parse(line)).map(text));
  return { id, file, evidence, script: ready.script, run, commands };
}

function reloadCommand(id: string) {
  return [
    'metro',
    'reload',
    '--metro-host',
    'localhost',
    '--metro-port',
    '45789',
    '--platform',
    'ios',
    '--udid',
    'refresh-proof-simulator',
    '--session',
    `refresh-proof-${id}`,
  ];
}

test('a rejected mobile reload preserves the recorded source and retains its failure', async (context) => {
  const owned = await fixture(context);
  const before = await readFile(owned.file, 'utf8');
  const outcome = await owned.run(7);
  expect(outcome.code).toBe(1);
  expect(outcome.stderr).toBe('reload rejected\n');
  expect(outcome.stdout).toBe('');
  expect(await readFile(owned.file, 'utf8')).toBe(before);
  expect(await owned.commands()).toStrictEqual([reloadCommand(owned.id)]);
  const files = await readdir(owned.evidence);
  expect(files).toHaveLength(1);
  expect(
    await readFile(join(owned.evidence, files[0] ?? ''), 'utf8'),
  ).toContain('reload rejected');
}, 60_000);

test('an explicit mobile refresh records acceptance without certifying loaded JavaScript and remains repeatable', async (context) => {
  const owned = await fixture(context);
  for (const attempt of [1, 2]) {
    const outcome = await owned.run(0);
    expect(outcome.code).toBe(0);
    expect(outcome.stderr).toBe('');
    expect(outcome.stdout).toContain(
      'Metro accepted a reload request; inspect the changed behavior with Maestro.',
    );
    const instance = record(JSON.parse(await readFile(owned.file, 'utf8')));
    expect(text(record(instance.detail).script)).toBe(owned.script);
    expect(await owned.commands()).toHaveLength(attempt);
  }
  expect(await owned.commands()).toStrictEqual([
    reloadCommand(owned.id),
    reloadCommand(owned.id),
  ]);
}, 60_000);
