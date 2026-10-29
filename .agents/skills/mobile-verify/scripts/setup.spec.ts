import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Schema } from 'effect';
import { driver as makeDriver, pairClient } from './setup.ts';

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
  platform = 'ios',
  failPairingLink = false,
) {
  const launcher = join(directory, 'driver');
  const calls = join(directory, 'calls.jsonl');
  await writeFile(
    launcher,
    `#!${process.execPath}
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
if (args[0] === 'fill') {
  console.error('TEXT_INPUT_SYNTHESIS_BUDGET_EXCEEDED');
  process.exit(1);
}
if (args[0] === 'press' && args[1] === 'id="development-pairing-link"' && ${failPairingLink}) {
  console.error('COMMAND_FAILED: development pairing unavailable');
  process.exit(1);
}
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
        platform,
        platform === 'ios' ? '--udid' : '--serial',
        'owned',
      ],
      command: launcher,
    },
    arguments: async () =>
      (await readFile(calls, 'utf8'))
        .trim()
        .split('\n')
        .map(
          Schema.decodeUnknownSync(
            Schema.fromJsonString(Schema.Array(Schema.String)),
          ),
        ),
    commands: async () =>
      (await readFile(calls, 'utf8'))
        .trim()
        .split('\n')
        .map(
          Schema.decodeUnknownSync(
            Schema.fromJsonString(Schema.Array(Schema.String)),
          ),
        )
        .map((args) => args[0]),
  };
}

it('reports the failed app open even when closing its unstarted session also fails', async () => {
  const { driver, commands } = await deviceDriver(true, true);

  expect(() => pairClient(driver, 'http://localhost:5183', 'setup')).toThrow(
    'COMMAND_FAILED: development client could not open',
  );
  expect(await commands()).toEqual(['prepare', 'open', 'close']);
});

it('refuses to launch or pair when the runner preparation fails', async () => {
  const { driver, commands } = await deviceDriver(false, false, true);

  expect(() => pairClient(driver, 'http://localhost:5183', 'setup')).toThrow(
    'COMMAND_FAILED: runner is not ready',
  );
  expect(await commands()).toEqual(['prepare', 'close']);
});

it('does not hand over a paired client when its setup session fails to close', async () => {
  const { driver, commands } = await deviceDriver(false, true);

  expect(() => pairClient(driver, 'http://localhost:5183', 'setup')).toThrow(
    'SESSION_NOT_FOUND: no active session',
  );
  expect((await commands()).at(-1)).toBe('close');
});

it('pairs Android without invoking the Apple runner or iOS alerts and releases setup before handoff', async () => {
  const { driver, commands } = await deviceDriver(
    false,
    false,
    false,
    'android',
  );
  pairClient(driver, 'http://localhost:5183', 'setup');
  expect(await commands()).toEqual([
    'open',
    'open',
    'wait',
    'open',
    'wait',
    'press',
    'press',
    'press',
    'wait',
    'press',
    'wait',
    'close',
  ]);
});

it('hands Android driving to the exact supplied launcher, config and session with its serial', () => {
  const driver = makeDriver(
    directory,
    null,
    'emulator-5580',
    't3-session',
    '/private/t3/host.json',
    '/private/t3/agent-device',
    'android',
  );
  expect(driver.launcher).toBe('/private/t3/agent-device');
  expect(driver.config).toBe('/private/t3/host.json');
  expect(driver.targetArgs).toEqual([
    '--config',
    '/private/t3/host.json',
    '--session',
    't3-session',
    '--platform',
    'android',
    '--serial',
    'emulator-5580',
  ]);
});

it.each(['ios', 'android'])(
  'pairs %s through the development server without synthesizing link text',
  async (platform) => {
    const { driver, arguments: calls } = await deviceDriver(
      false,
      false,
      false,
      platform,
    );
    pairClient(driver, 'http://localhost:5183', 'setup');
    const args = await calls();
    const ready = args.findIndex(
      (call) => call[0] === 'wait' && call[1] === 'label="Add computer"',
    );
    expect(ready).toBeGreaterThan(0);
    expect(ready).toBeLessThan(
      args.findIndex(
        (call) =>
          call[0] === 'open' && call[2]?.startsWith('porcelain.dev://settings'),
      ),
    );
    expect(
      args.map((call) => call.slice(0, call.indexOf('--session'))),
    ).toContainEqual(['press', 'id="development-pairing-link"', '--settle']);
    expect(
      args.map((call) => call.slice(0, call.indexOf('--session'))),
    ).toContainEqual(['wait', 'id="pair-environment" enabled=true', '30000']);
    expect(args.some((call) => call[0] === 'fill' || call[0] === 'type')).toBe(
      false,
    );
    expect(args.at(-1)).toEqual([
      'close',
      '--session',
      'setup',
      '--platform',
      platform,
      platform === 'ios' ? '--udid' : '--serial',
      'owned',
    ]);
  },
);

it('closes setup and reports development pairing failure without submitting or retrying', async () => {
  const { driver, arguments: calls } = await deviceDriver(
    false,
    false,
    false,
    'ios',
    true,
  );
  expect(() => pairClient(driver, 'http://localhost:5183', 'setup')).toThrow(
    'development pairing unavailable',
  );
  const args = await calls();
  expect(
    args.filter(
      (call) =>
        call[0] === 'press' && call[1] === 'id="development-pairing-link"',
    ),
  ).toHaveLength(1);
  expect(
    args.some(
      (call) => call[0] === 'press' && call[1] === 'id="pair-environment"',
    ),
  ).toBe(false);
  expect(args.at(-1)?.[0]).toBe('close');
});
