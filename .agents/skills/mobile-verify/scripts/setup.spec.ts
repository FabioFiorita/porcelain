import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pairClient } from './setup.ts';

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'porcelain-mobile-setup-spec-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function deviceDriver(
  failOpen: boolean,
  failClose: boolean,
  failPrepare = false,
) {
  const launcher = join(directory, 'driver');
  const calls = join(directory, 'calls.jsonl');
  await writeFile(
    launcher,
    `#!${process.execPath}
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(calls)}, args[0] + '\\n');
if (args[0] === 'prepare' && ${failPrepare}) {
  console.error('COMMAND_FAILED: runner is not ready');
  process.exit(1);
}
if (args[0] === 'open' && ${failOpen}) {
  console.error('COMMAND_FAILED: development client could not open');
  process.exit(1);
}
if (args[0] === 'close' && ${failClose}) {
  console.error('SESSION_NOT_FOUND: no active session');
  process.exit(1);
}
`,
    { mode: 0o700 },
  );
  return {
    driver: {
      launcher,
      config: join(directory, 'config.json'),
      targetArgs: [
        '--session',
        'journey',
        '--platform',
        'ios',
        '--udid',
        'owned',
      ],
      command: launcher,
    },
    commands: async () => (await readFile(calls, 'utf8')).trim().split('\n'),
  };
}

it('reports the failed app open even when closing its unstarted session also fails', async () => {
  const { driver, commands } = await deviceDriver(true, true);

  expect(() =>
    pairClient(driver, 'http://localhost:5183', 'fixture-link', 'setup'),
  ).toThrow('COMMAND_FAILED: development client could not open');
  expect(await commands()).toEqual(['prepare', 'open', 'close']);
});

it('refuses to launch or pair when the runner preparation fails', async () => {
  const { driver, commands } = await deviceDriver(false, false, true);

  expect(() =>
    pairClient(driver, 'http://localhost:5183', 'fixture-link', 'setup'),
  ).toThrow('COMMAND_FAILED: runner is not ready');
  expect(await commands()).toEqual(['prepare', 'close']);
});

it('does not hand over a paired client when its setup session fails to close', async () => {
  const { driver, commands } = await deviceDriver(false, true);

  expect(() =>
    pairClient(driver, 'http://localhost:5183', 'fixture-link', 'setup'),
  ).toThrow('SESSION_NOT_FOUND: no active session');
  expect((await commands()).at(-1)).toBe('close');
});

it('closes the setup session after a successful pairing', async () => {
  const { driver, commands } = await deviceDriver(false, false);

  pairClient(driver, 'http://localhost:5183', 'fixture-link', 'setup');

  expect((await commands()).at(-1)).toBe('close');
});
