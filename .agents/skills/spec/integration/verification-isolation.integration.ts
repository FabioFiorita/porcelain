import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { test } from '@porcelain/server/kit/server-test';
import { record } from '@porcelain/server/kit/session';
import {
  repositoryRoot,
  SERVER_CLI,
  STALE,
  cli,
  started,
  evidenceOf,
  checkoutCopy,
  alive,
} from './verification-cli.ts';

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
