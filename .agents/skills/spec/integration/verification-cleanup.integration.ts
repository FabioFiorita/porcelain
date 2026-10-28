import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { expect } from 'vitest';
import { test } from '@porcelain/server/kit/server-test';
import { list, record, text } from '@porcelain/server/kit/session';
import {
  repositoryRoot,
  SERVER_CLI,
  cli,
  instanceFile,
  started,
  evidenceOf,
  checkoutCopy,
  alive,
  running,
  settled,
  sessionFixture,
} from './verification-cli.ts';

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

test.for(['server', 'web', 'desktop', 'mobile'])(
  '%s can read retained evidence and repeat a confirmed stop without starting an instance',
  async (surface, { onTestFinished }) => {
    const copy = await checkoutCopy(onTestFinished);
    const id = 'abc12345';
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

    expect(retained.code, retained.stderr).toBe(0);
    expect(retained.stdout).toContain(evidence);
    expect(repeated.code, repeated.stderr).toBe(0);
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
      expect(refusedEvidence.code, selector).toBe(1);
      expect(refusedEvidence.stdout, selector).toBe('');
      expect(refusedStop.code, selector).toBe(1);
      expect(refusedStop.stdout, selector).not.toMatch(
        /(?:^|\n)(?:already )?stopped /,
      );
    }
    expect(existsSync(join(home, 'instances'))).toBe(false);
    expect(await readdir(evidence)).toStrictEqual(['stop-result.json']);
  },
);

test('web and desktop retained evidence, repeated stop and board options work without an installed browser driver', async ({
  onTestFinished,
}) => {
  const copy = await checkoutCopy(onTestFinished);
  for (const path of ['node_modules', '.agents/skills/node_modules']) {
    const dependencies = join(copy, path);
    const packages = await readdir(dependencies);
    await rm(dependencies);
    await mkdir(dependencies);
    for (const name of packages.filter((name) => name !== 'playwright'))
      await symlink(join(repositoryRoot, path, name), join(dependencies, name));
  }
  expect(existsSync(join(copy, 'node_modules/playwright'))).toBe(false);
  expect(existsSync(join(copy, '.agents/skills/node_modules/playwright'))).toBe(
    false,
  );
  const probe = '.agents/skills/web-verify/scripts/board-options-probe.ts';
  await writeFile(
    join(copy, probe),
    `#!${process.execPath}
import { boardDiffOptions } from './board-options.ts';
boardDiffOptions(['board-diff', '--board', 'sidebar', '--route', '//other.example']);
`,
    { mode: 0o700 },
  );
  const options = await cli(copy, probe);
  expect(options.code).toBe(1);
  expect(options.stderr).toContain(
    '--route must be a path on the running app.',
  );
  const id = 'abc12345';
  for (const surface of ['web', 'desktop']) {
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
