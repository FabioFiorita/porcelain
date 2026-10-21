import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, symlink, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect } from 'vitest';
import { test } from '@porcelain/server/kit/server-test';
import { list, record, text } from '@porcelain/server/kit/session';
import {
  repositoryRoot,
  SERVER_CLI,
  type Run,
  cli,
  started,
  evidenceOf,
  checkoutCopy,
  alive,
} from './verification-cli.ts';

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
