import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type TestContext } from 'vitest';
import { test } from '../kit/server-test.ts';
import { list, record, text } from '../kit/session.ts';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const CLI = join(repositoryRoot, '.agents/skills/server-verify/scripts/cli');

type Run = { code: number; stdout: string; stderr: string };

function cli(...args: string[]): Promise<Run> {
  return new Promise((resolveRun) => {
    execFile(CLI, args, { cwd: repositoryRoot }, (error, stdout, stderr) => {
      resolveRun({
        code: error === null ? 0 : Number(error.code ?? 1),
        stdout,
        stderr,
      });
    });
  });
}

async function started(onTestFinished: TestContext['onTestFinished']) {
  const run = await cli('start');
  const [, id = '', address = '', evidence = ''] =
    /^instance (\S+)\nurl (\S+)\nevidence (\S+)\n$/.exec(run.stdout) ?? [];
  const instanceFile = join(
    tmpdir(),
    'porcelain-server-cli',
    createHash('sha256').update(repositoryRoot).digest('hex').slice(0, 16),
    id,
    'instance.json',
  );
  onTestFinished(async () => {
    if (existsSync(instanceFile)) await cli('stop', '--instance', id);
  });
  const instance = record(JSON.parse(await readFile(instanceFile, 'utf8')));
  return {
    run,
    id,
    address,
    evidence,
    instanceFile,
    credential: text(instance.credential),
  };
}

async function evidenceOf(folder: string) {
  const names = (await readdir(folder)).sort();
  const contents = await Promise.all(
    names.map((name) => readFile(join(folder, name), 'utf8')),
  );
  return { names, text: contents.join('\n'), contents };
}

test('a CLI session records numbered, redacted evidence and never shows the instance credential', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished);
  const issued = await cli(
    'request',
    'POST',
    '/pairings',
    '--owner',
    '--instance',
    instance.id,
    'labels:=["CLI device"]',
    `addresses:=["${instance.address}"]`,
  );
  const code = text(
    record(list(record(JSON.parse(issued.stdout.slice(9))).grants)[0]).code,
  );
  const paired = await cli(
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
  const stopped = await cli('stop', '--instance', instance.id);
  const evidence = await evidenceOf(instance.evidence);
  const pairing = record(JSON.parse(evidence.contents[2] ?? '{}'));
  const exchange = record(list(pairing.steps)[0]);

  expect(instance.run.code).toBe(0);
  expect(evidence.names).toStrictEqual([
    '001-start.json',
    '002-request.json',
    '003-request.json',
    '004-server-stop.json',
    '005-stop.json',
  ]);
  expect(instance.run.stdout).not.toContain(instance.credential);
  expect(issued.stdout).not.toContain(instance.credential);
  expect(paired.stdout).not.toContain(instance.credential);
  expect(stopped.stdout).not.toContain(instance.credential);
  expect(evidence.text).not.toContain(instance.credential);
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
  expect(existsSync(instance.instanceFile)).toBe(false);
});

test('a CLI command refuses to drive an instance whose server code changed since start', async ({
  onTestFinished,
}) => {
  const instance = await started(onTestFinished);
  const saved = record(
    JSON.parse(await readFile(instance.instanceFile, 'utf8')),
  );
  await writeFile(
    instance.instanceFile,
    JSON.stringify({ ...saved, fingerprint: 'an earlier build' }),
  );

  const refused = await cli(
    'request',
    'GET',
    '/api/health',
    '--instance',
    instance.id,
  );
  await cli('stop', '--instance', instance.id);
  const evidence = await evidenceOf(instance.evidence);

  expect(refused.code).toBe(1);
  expect(refused.stdout).toBe('');
  expect(refused.stderr, 'a stale build is refused').toBe(
    'server code changed since start, run start again\n',
  );
  expect(evidence.names).toStrictEqual([
    '001-start.json',
    '002-refused.json',
    '003-server-stop.json',
    '004-stop.json',
  ]);
});
