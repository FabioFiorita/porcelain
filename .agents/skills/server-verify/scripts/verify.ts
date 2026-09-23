import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type RecordValue = Record<string, unknown>;
type Exchange = {
  request: {
    method: string;
    path: string;
    body?: unknown;
    authorization: string;
  };
  response: { status: number; body: unknown };
};
type Assertion = {
  name: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
};
type Case = { name: string; exchanges: Exchange[]; assertions: Assertion[] };
type Ready = { manifest: string; address: string; repository: string };
type Manifest = { address: string; repository: string; credentialFile: string };

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const feature = process.argv[2];
if (
  !['projects.rename', 'projects.remove'].includes(feature ?? '') ||
  process.argv.length !== 3
) {
  process.stderr.write(
    'Usage: node .agents/skills/server-verify/scripts/verify.ts projects.rename|projects.remove\n',
  );
  process.exit(2);
}

const evidenceDirectory = await mkdtemp(
  join(tmpdir(), 'porcelain-server-verify-'),
);
const evidencePath = join(evidenceDirectory, 'evidence.json');
const child = spawn(process.execPath, ['scripts/dev-server.ts'], {
  cwd: repositoryRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stdout = '';
let stderr = '';
let credential = '';
let errorMessage: string | undefined;
let ready: Ready | undefined;
const cases: Case[] = [];
const exited = new Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
}>((resolveExit) => {
  child.once('close', (code, signal) => resolveExit({ code, signal }));
});

function object(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function check(
  testCase: Case,
  name: string,
  expected: unknown,
  actual: unknown,
): void {
  testCase.assertions.push({
    name,
    passed: isDeepStrictEqual(actual, expected),
    expected,
    actual,
  });
}

function scrub(value: string): string {
  return credential ? value.replaceAll(credential, '[redacted]') : value;
}

function jsonOrText(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

async function exchange(
  address: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<Exchange> {
  const response = await fetch(new URL(path, address), {
    method,
    headers: {
      authorization: `Bearer ${credential}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });
  const raw = await response.text();
  return {
    request: {
      method,
      path,
      ...(body === undefined ? {} : { body }),
      authorization: 'Bearer [redacted]',
    },
    response: { status: response.status, body: jsonOrText(raw) },
  };
}

function inventoryOf(entry: Exchange): RecordValue {
  const body = entry.response.body;
  if (
    entry.response.status !== 200 ||
    !object(body) ||
    !Array.isArray(body.projects)
  )
    throw new Error(`Could not read inventory: HTTP ${entry.response.status}`);
  return body;
}

function projectsOf(inventory: RecordValue): RecordValue[] {
  const projects = inventory.projects;
  if (!Array.isArray(projects) || !projects.every(object))
    throw new Error('Inventory contained invalid project data');
  return projects;
}

async function verifyInvalidInput(
  address: string,
  name: string,
  projectId: string,
  submittedName: string,
): Promise<void> {
  const testCase: Case = { name, exchanges: [], assertions: [] };
  cases.push(testCase);
  const beforeRead = await exchange(address, 'GET', '/api/inventory');
  testCase.exchanges.push(beforeRead);
  const before = inventoryOf(beforeRead);
  const rejected = await exchange(
    address,
    'PATCH',
    `/api/projects/${projectId}`,
    {
      name: submittedName,
    },
  );
  testCase.exchanges.push(rejected);
  const afterRead = await exchange(address, 'GET', '/api/inventory');
  testCase.exchanges.push(afterRead);
  const after = inventoryOf(afterRead);
  check(testCase, 'invalid input status', 400, rejected.response.status);
  check(
    testCase,
    'invalid input error body',
    { statusCode: 400, error: 'Bad Request', message: 'Invalid request' },
    rejected.response.body,
  );
  check(testCase, 'invalid input leaves inventory unchanged', before, after);
}

async function verifyRename(address: string): Promise<void> {
  const success: Case = {
    name: 'existing project',
    exchanges: [],
    assertions: [],
  };
  cases.push(success);
  const beforeRead = await exchange(address, 'GET', '/api/inventory');
  success.exchanges.push(beforeRead);
  const before = inventoryOf(beforeRead);
  const projects = projectsOf(before);
  check(success, 'fixture has one registered project', 1, projects.length);
  const project = projects[0];
  if (!project || typeof project.id !== 'string')
    throw new Error('Fixture did not provide a project ID');

  const renamed = await exchange(
    address,
    'PATCH',
    `/api/projects/${project.id}`,
    {
      name: '  New name  ',
    },
  );
  success.exchanges.push(renamed);
  const afterRead = await exchange(address, 'GET', '/api/inventory');
  success.exchanges.push(afterRead);
  const after = inventoryOf(afterRead);
  const renamedProject = projectsOf(after).find(
    (entry) => entry.id === project.id,
  );
  check(success, 'rename status', 200, renamed.response.status);
  check(
    success,
    'rename response',
    { id: project.id, name: 'New name' },
    renamed.response.body,
  );
  check(
    success,
    'renamed project remains in inventory',
    true,
    renamedProject !== undefined,
  );
  check(
    success,
    'inventory changes only the project name',
    {
      ...before,
      projects: projects.map((entry) =>
        entry.id === project.id ? { ...entry, name: 'New name' } : entry,
      ),
    },
    after,
  );

  const missing: Case = {
    name: 'unknown project',
    exchanges: [],
    assertions: [],
  };
  cases.push(missing);
  const missingBeforeRead = await exchange(address, 'GET', '/api/inventory');
  missing.exchanges.push(missingBeforeRead);
  const missingBefore = inventoryOf(missingBeforeRead);
  let unknownId = randomUUID();
  while (projectsOf(missingBefore).some((entry) => entry.id === unknownId))
    unknownId = randomUUID();
  const rejected = await exchange(
    address,
    'PATCH',
    `/api/projects/${unknownId}`,
    {
      name: 'Ghost',
    },
  );
  missing.exchanges.push(rejected);
  const missingAfterRead = await exchange(address, 'GET', '/api/inventory');
  missing.exchanges.push(missingAfterRead);
  const missingAfter = inventoryOf(missingAfterRead);
  check(missing, 'unknown project status', 404, rejected.response.status);
  check(
    missing,
    'unknown project error body',
    { statusCode: 404, error: 'Not Found', message: 'Project not found' },
    rejected.response.body,
  );
  check(
    missing,
    'unknown project leaves inventory unchanged',
    missingBefore,
    missingAfter,
  );

  await verifyInvalidInput(address, 'empty name', project.id, '');
  await verifyInvalidInput(address, 'whitespace-only name', project.id, '   ');
  await verifyInvalidInput(
    address,
    'name over 100 characters',
    project.id,
    'x'.repeat(101),
  );
  await verifyInvalidInput(
    address,
    'control character in name',
    project.id,
    'Line\nbreak',
  );
  await verifyInvalidInput(
    address,
    'invalid project ID',
    'not-a-uuid',
    'Valid name',
  );
}

async function verifyRemove(address: string): Promise<void> {
  const beforeRead = await exchange(address, 'GET', '/api/inventory');
  const before = inventoryOf(beforeRead);
  const projects = projectsOf(before);
  const project = projects[0];
  if (projects.length !== 1 || !project || typeof project.id !== 'string')
    throw new Error('Fixture did not provide one project ID');

  const invalid: Case = {
    name: 'invalid project ID',
    exchanges: [beforeRead],
    assertions: [],
  };
  cases.push(invalid);
  const invalidResponse = await exchange(
    address,
    'DELETE',
    '/api/projects/not-a-uuid',
  );
  const invalidAfterRead = await exchange(address, 'GET', '/api/inventory');
  invalid.exchanges.push(invalidResponse, invalidAfterRead);
  check(invalid, 'invalid ID status', 400, invalidResponse.response.status);
  check(
    invalid,
    'invalid ID leaves inventory unchanged',
    before,
    inventoryOf(invalidAfterRead),
  );

  let unknownId = randomUUID();
  while (projects.some((entry) => entry.id === unknownId))
    unknownId = randomUUID();
  const unknown: Case = {
    name: 'unknown project',
    exchanges: [],
    assertions: [],
  };
  cases.push(unknown);
  const unknownResponse = await exchange(
    address,
    'DELETE',
    `/api/projects/${unknownId}`,
  );
  const unknownAfterRead = await exchange(address, 'GET', '/api/inventory');
  unknown.exchanges.push(unknownResponse, unknownAfterRead);
  check(
    unknown,
    'unknown project status',
    200,
    unknownResponse.response.status,
  );
  check(
    unknown,
    'unknown project response',
    { deleted: false },
    unknownResponse.response.body,
  );
  check(
    unknown,
    'unknown project leaves inventory unchanged',
    before,
    inventoryOf(unknownAfterRead),
  );

  const removed: Case = {
    name: 'existing project',
    exchanges: [],
    assertions: [],
  };
  cases.push(removed);
  const removedResponse = await exchange(
    address,
    'DELETE',
    `/api/projects/${project.id}`,
  );
  const removedAfterRead = await exchange(address, 'GET', '/api/inventory');
  removed.exchanges.push(removedResponse, removedAfterRead);
  check(removed, 'remove status', 200, removedResponse.response.status);
  check(
    removed,
    'remove response',
    { deleted: true },
    removedResponse.response.body,
  );
  check(
    removed,
    'project is absent from inventory',
    [],
    projectsOf(inventoryOf(removedAfterRead)),
  );

  const repeated: Case = {
    name: 'already removed project',
    exchanges: [],
    assertions: [],
  };
  cases.push(repeated);
  const repeatedResponse = await exchange(
    address,
    'DELETE',
    `/api/projects/${project.id}`,
  );
  const repeatedAfterRead = await exchange(address, 'GET', '/api/inventory');
  repeated.exchanges.push(repeatedResponse, repeatedAfterRead);
  check(
    repeated,
    'repeated remove status',
    200,
    repeatedResponse.response.status,
  );
  check(
    repeated,
    'repeated remove response',
    { deleted: false },
    repeatedResponse.response.body,
  );
  check(
    repeated,
    'inventory remains empty',
    [],
    projectsOf(inventoryOf(repeatedAfterRead)),
  );
}

async function waitForReady(): Promise<Ready> {
  return new Promise((resolveReady, rejectReady) => {
    let pending = '';
    const timeout = setTimeout(
      () =>
        rejectReady(
          new Error('Isolated server did not become ready within 30 seconds'),
        ),
      30_000,
    );
    const onExit = (code: number | null) => {
      clearTimeout(timeout);
      child.off('error', onError);
      rejectReady(
        new Error(`Isolated server exited before ready: ${code ?? 'signal'}`),
      );
    };
    const onError = (error: Error) => {
      clearTimeout(timeout);
      child.off('close', onExit);
      rejectReady(error);
    };
    child.once('close', onExit);
    child.once('error', onError);
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;
      pending += text;
      for (
        let newline = pending.indexOf('\n');
        newline !== -1;
        newline = pending.indexOf('\n')
      ) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        try {
          const value: unknown = JSON.parse(line);
          if (
            object(value) &&
            typeof value.manifest === 'string' &&
            typeof value.address === 'string' &&
            typeof value.repository === 'string'
          ) {
            clearTimeout(timeout);
            child.off('close', onExit);
            child.off('error', onError);
            resolveReady(value as Ready);
          }
        } catch {
          continue;
        }
      }
    });
  });
}

child.stderr.on('data', (chunk: Buffer) => {
  stderr += chunk.toString('utf8');
});
const stop = () => child.kill('SIGTERM');
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  ready = await waitForReady();
  const manifest = JSON.parse(
    await readFile(ready.manifest, 'utf8'),
  ) as Manifest;
  const secret = JSON.parse(
    await readFile(manifest.credentialFile, 'utf8'),
  ) as { credential?: string };
  if (
    !secret.credential ||
    manifest.address !== ready.address ||
    manifest.repository !== ready.repository
  )
    throw new Error('Isolated server session manifest is incomplete');
  credential = secret.credential;
  if (feature === 'projects.rename') await verifyRename(manifest.address);
  else await verifyRemove(manifest.address);
} catch (error) {
  errorMessage = error instanceof Error ? error.message : String(error);
} finally {
  stop();
  let shutdownTimer: NodeJS.Timeout | undefined;
  const closed = await Promise.race([
    exited.then((result) => ({ closed: true as const, result })),
    new Promise<{ closed: false }>((resolveTimeout) => {
      shutdownTimer = setTimeout(
        () => resolveTimeout({ closed: false }),
        10_000,
      );
    }),
  ]);
  if (shutdownTimer) clearTimeout(shutdownTimer);
  if (!closed.closed) {
    child.kill('SIGKILL');
    await exited;
    errorMessage ??= 'Isolated server did not stop within 10 seconds';
  }
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
}

const assertions = cases.flatMap((entry) => entry.assertions);
const passed =
  errorMessage === undefined &&
  assertions.length > 0 &&
  assertions.every((entry) => entry.passed);
const evidence = {
  feature,
  capturedAt: new Date().toISOString(),
  passed,
  ...(errorMessage === undefined ? {} : { error: errorMessage }),
  assertionCount: assertions.length,
  passedAssertions: assertions.filter((entry) => entry.passed).length,
  cases,
  session: ready
    ? { address: ready.address, repository: ready.repository }
    : null,
  logs: { stdout: scrub(stdout), stderr: scrub(stderr) },
};
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
  mode: 0o600,
});
process.stdout.write(
  `${passed ? 'PASS' : 'FAIL'} ${feature}: ${evidence.passedAssertions}/${evidence.assertionCount} assertions; evidence: ${evidencePath}\n`,
);
if (errorMessage) process.stderr.write(`${errorMessage}\n`);
if (!passed) process.exitCode = 1;
