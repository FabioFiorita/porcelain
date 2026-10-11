import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { expect, inject, test } from 'vitest';
import { record, text } from '@porcelain/server/kit/session';

test('a development server ignores terminal input and closes normally', async ({
  onTestFinished,
}) => {
  const child = spawn(
    process.execPath,
    ['apps/server/spec/kit/sandbox.ts', '--server', inject('serverBuild')],
    {
      cwd: resolve(import.meta.dirname, '../../../..'),
      env: { ...process.env, PORCELAIN_TEST_CLOCK: undefined },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  const closed = once(child, 'close');
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  onTestFinished(async () => {
    child.kill('SIGTERM');
    await closed;
  });
  const lines = createInterface({ input: child.stdout });
  const ready = new Promise<string>((resolveReady, rejectReady) => {
    lines.on('line', (line) => {
      if (!line.startsWith('{')) return;
      const notice = record(JSON.parse(line));
      if (notice.manifest) resolveReady(text(notice.address));
    });
    child.once('error', rejectReady);
    child.once('close', () =>
      rejectReady(
        new Error(`Development server exited before ready: ${stderr}`),
      ),
    );
  });
  const address = await ready;
  await new Promise<void>((resolveWrite, rejectWrite) =>
    child.stdin.write('\nnot a clock command\n', (error) =>
      error ? rejectWrite(error) : resolveWrite(),
    ),
  );
  const health = await fetch(`${address}/api/health`)
    .then(async (response) => ({
      status: response.status,
      environmentId: text(record(await response.json()).environmentId),
    }))
    .catch(() => undefined);
  child.kill('SIGTERM');
  expect(await closed, stderr).toEqual([0, null]);
  expect(health).toMatchObject({ status: 200 });
  expect(health?.environmentId).not.toBe('');
  lines.close();
});
