import { execFile } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, it, vi } from 'vitest';
import { GitActionRunner } from './run-git.ts';

const execute = promisify(execFile);
it('cancels an owned Git process group after its child readiness barrier', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-action-process-'));
  const pidPath = join(root, 'ready');
  const script = join(root, 'descendant.cjs');
  await writeFile(
    script,
    `const { spawn } = require('node:child_process'); const { writeFileSync } = require('node:fs'); const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']); child.on('spawn', () => writeFileSync(${JSON.stringify(pidPath)}, String(child.pid))); setInterval(() => {}, 1000);`,
  );
  const abort = new AbortController();
  try {
    const git = new GitActionRunner(root);
    const result = git.execute(
      ['-c', `alias.fixture=!"${process.execPath}" "${script}"`, 'fixture'],
      abort.signal,
    );
    await expect.poll(async () => readFile(pidPath, 'utf8')).toMatch(/^\d+$/);
    const pid = Number(await readFile(pidPath, 'utf8'));
    abort.abort();
    expect(await result).toMatchObject({
      started: true,
      interrupted: true,
      descendantsStopped: true,
    });
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    abort.abort();
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects inherited repository and index redirection instead of changing another checkout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-action-env-'));
  const checkout = join(root, 'checkout');
  await mkdir(checkout);
  const other = join(root, 'other');
  await mkdir(other);
  await execute('git', ['init', checkout]);
  await execute('git', ['init', other]);
  vi.stubEnv('GIT_DIR', join(other, '.git'));
  vi.stubEnv('GIT_WORK_TREE', other);
  vi.stubEnv('GIT_INDEX_FILE', join(other, '.git/index'));
  vi.stubEnv('GIT_CONFIG_COUNT', '1');
  vi.stubEnv('GIT_CONFIG_KEY_0', 'core.bare');
  vi.stubEnv('GIT_CONFIG_VALUE_0', 'true');
  try {
    const result = await new GitActionRunner(checkout).execute(
      ['rev-parse', '--show-toplevel'],
      AbortSignal.timeout(5000),
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString().trim()).toBe(await realpath(checkout));
  } finally {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  }
});

it('returns all large stdout bytes and the final tail after the Git process exits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-action-output-'));
  const script = join(root, 'output.cjs');
  const payload = `${'0123456789abcdef'.repeat(196_608)}\nfinal-output-tail\n`;
  await writeFile(
    script,
    `const { writeFileSync } = require('node:fs'); writeFileSync(1, '0123456789abcdef'.repeat(196608) + '\\nfinal-output-tail\\n'); writeFileSync(2, 'diagnostic'.repeat(16384));`,
  );
  try {
    const result = await new GitActionRunner(root).execute(
      ['-c', `alias.fixture=!"${process.execPath}" "${script}"`, 'fixture'],
      AbortSignal.timeout(5000),
    );
    expect(result).toMatchObject({
      exitCode: 0,
      interrupted: false,
      descendantsStopped: true,
    });
    expect(result.stdout.equals(Buffer.from(payload))).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('stops an action that outgrows the shared output cap and names the failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-action-cap-'));
  try {
    const binary = join(root, 'git');
    // Five megabytes over one stream, past the four the policy allows.
    await writeFile(
      binary,
      '#!/bin/sh\nexec /usr/bin/head -c 5242880 /dev/zero\n',
    );
    await chmod(binary, 0o700);
    vi.stubEnv('PATH', root);
    const result = await new GitActionRunner(root).execute(
      ['status'],
      new AbortController().signal,
    );
    expect(result.interrupted).toBe(true);
    // The same vocabulary a read uses when it outgrows its buffer.
    expect(result.failure).toBe('output-limit');
  } finally {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  }
});

it('refuses every later command once descendants could not be confirmed stopped', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-action-latch-'));
  const script = join(root, 'escapee.cjs');
  const pidPath = join(root, 'escaped');
  // A descendant that leaves the process group keeps the inherited pipe open,
  // so the group is killed but the output never drains: cleanup is unconfirmed.
  // It records its pid so this test can stop the one process it deliberately
  // let escape; nothing else will, and it would otherwise outlive the run.
  await writeFile(
    script,
    `const { spawn } = require('node:child_process'); const { writeFileSync } = require('node:fs'); const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: ['ignore', 'inherit', 'inherit'] }); writeFileSync(${JSON.stringify(pidPath)}, String(child.pid)); child.unref();`,
  );
  try {
    const git = new GitActionRunner(root);
    await expect(
      git.execute(
        ['-c', `alias.fixture=!"${process.execPath}" "${script}"`, 'fixture'],
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ reason: 'PROCESS_GROUP_UNCONFIRMED' });
    // The latch, not the failure itself, is what the next command must hit.
    await expect(
      git.execute(['status'], new AbortController().signal),
    ).rejects.toMatchObject({ reason: 'PROCESS_GROUP_UNCONFIRMED' });
  } finally {
    const escaped = Number(await readFile(pidPath, 'utf8').catch(() => ''));
    if (escaped) process.kill(escaped, 'SIGKILL');
    await rm(root, { recursive: true, force: true });
  }
}, 20_000);
