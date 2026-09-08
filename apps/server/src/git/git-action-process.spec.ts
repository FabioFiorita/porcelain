import { execFile } from 'node:child_process';
import {
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
import { GitActionProcess } from './git-action-process.ts';

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
    const git = new GitActionProcess(root);
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
    const result = await new GitActionProcess(checkout).execute(
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
    const result = await new GitActionProcess(root).execute(
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
