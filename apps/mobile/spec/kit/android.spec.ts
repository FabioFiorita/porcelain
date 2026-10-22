import { Schema } from 'effect';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import {
  claimAndroid,
  releaseAndroid,
  resetAndroid,
  emulatorAddress,
} from './android.ts';

let directory: string;
let path: string | undefined;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'porcelain-android-spec-'));
  path = process.env.PATH;
  process.env.PATH = `${directory}${delimiter}${path ?? ''}`;
});
afterEach(async () => {
  process.env.PATH = path;
  await rm(directory, { recursive: true, force: true });
});

async function device(
  initial = '',
  abi = process.arch === 'arm64' ? 'arm64-v8a' : 'x86_64',
) {
  const callsFile = join(directory, 'calls.jsonl');
  const installed = join(directory, 'installed-digest');
  await writeFile(installed, initial);
  await writeFile(
    join(directory, 'adb'),
    `#!${process.execPath}
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const args = process.argv.slice(2);
const installed = ${JSON.stringify(installed)};
appendFileSync(${JSON.stringify(callsFile)}, JSON.stringify(args) + '\\n');
if (args.includes('get-state')) console.log('device');
if (args.includes('sys.boot_completed')) console.log('1');
if (args.includes('ro.product.cpu.abi')) console.log(${JSON.stringify(abi)});
if (args.includes('avd')) console.log('Contributor emulator\\r\\nOK');
if (args.includes('packages') && readFileSync(installed, 'utf8')) console.log('package:com.fabiofiorita.porcelain.dev');
if (args.includes('path')) console.log('package:/data/app/dev/base.apk');
if (args.includes('sha256sum')) console.log(readFileSync(installed, 'utf8') + '  /data/app/dev/base.apk');
if (args.includes('install')) writeFileSync(installed, createHash('sha256').update(readFileSync(args.at(-1))).digest('hex'));
if (args.includes('clear')) console.log('Success');
`,
    { mode: 0o700 },
  );
  return {
    installed,
    calls: async () =>
      (await readFile(callsFile, 'utf8'))
        .trim()
        .split('\n')
        .map((line) =>
          Schema.decodeUnknownSync(Schema.Array(Schema.String))(
            JSON.parse(line),
          ),
        ),
  };
}

it('refuses physical or implicit Android devices before issuing adb commands', async () => {
  await expect(claimAndroid(undefined, 'test')).rejects.toThrow(
    'Select a booted Android emulator',
  );
  await expect(claimAndroid('personal-phone', 'test')).rejects.toThrow(
    'Physical devices are refused',
  );
});

it('claims an explicit booted emulator exclusively and leaves it booted on release', async () => {
  const { calls } = await device();
  const serial = `emulator-${process.pid}`;
  const claimed = await claimAndroid(serial, directory);
  try {
    expect(claimed).toMatchObject({
      udid: serial,
      name: 'Contributor emulator',
      kind: 'android',
      borrowed: true,
    });
    await expect(claimAndroid(serial, 'other-run')).rejects.toThrow(
      'already claimed',
    );
  } finally {
    await releaseAndroid(claimed);
  }
  const reclaimed = await claimAndroid(serial, 'next-run');
  await releaseAndroid(reclaimed);
  expect(
    (await calls()).some(
      (args) => args.includes('kill') || args.includes('clear'),
    ),
  ).toBe(false);
});

it('refuses to clear an app other than Porcelain Dev', async () => {
  await expect(
    resetAndroid('emulator-5580', '/tmp/client.apk', 'com.example.production'),
  ).rejects.toThrow('only resets the development app');
});

it.each(['armeabi-v7a', 'x86', ''])(
  'refuses an emulator with incompatible or unknown ABI %j before installation',
  async (abi) => {
    const { calls } = await device('', abi);
    await expect(
      claimAndroid(`emulator-${process.pid}`, directory),
    ).rejects.toThrow('refusing to reuse or install an APK for another ABI');
    expect(
      (await calls()).some(
        (args) => args.includes('install') || args.includes('clear'),
      ),
    ).toBe(false);
  },
);

it('refuses an emulator of the other supported host ABI', async () => {
  const { calls } = await device(
    '',
    process.arch === 'arm64' ? 'x86_64' : 'arm64-v8a',
  );
  await expect(
    claimAndroid(`emulator-${process.pid}`, directory),
  ).rejects.toThrow('Use an emulator matching the host architecture');
  expect(
    (await calls()).some(
      (args) => args.includes('install') || args.includes('clear'),
    ),
  ).toBe(false);
});

it('checks the actual installed APK when another emulator reuses the same adb serial', async () => {
  const digest =
    '8d811570794dde088edfd1320fa636b72aafd04332f00b022ffaae04d221faef';
  const { installed, calls } = await device(digest);
  const app = join(directory, 'PorcelainDev.apk');
  await writeFile(app, 'current-apk');
  expect(
    await resetAndroid('emulator-5580', app, 'com.fabiofiorita.porcelain.dev'),
  ).toBe(false);
  await writeFile(installed, 'different-emulator-old-apk');
  expect(
    await resetAndroid('emulator-5580', app, 'com.fabiofiorita.porcelain.dev'),
  ).toBe(true);
  expect(await readFile(installed, 'utf8')).toBe(digest);
  expect((await calls()).filter((args) => args.includes('install'))).toEqual([
    ['-s', 'emulator-5580', 'install', '-r', app],
  ]);
});

it('installs a missing development APK and clears only its app data', async () => {
  const { calls } = await device();
  const app = join(directory, 'PorcelainDev.apk');
  await writeFile(app, 'current-apk');
  expect(
    await resetAndroid('emulator-5580', app, 'com.fabiofiorita.porcelain.dev'),
  ).toBe(true);
  expect(await calls()).toEqual([
    [
      '-s',
      'emulator-5580',
      'shell',
      'pm',
      'list',
      'packages',
      'com.fabiofiorita.porcelain.dev',
    ],
    ['-s', 'emulator-5580', 'install', '-r', app],
    [
      '-s',
      'emulator-5580',
      'shell',
      'pm',
      'clear',
      'com.fabiofiorita.porcelain.dev',
    ],
  ]);
});

it('reaches host loopback through the emulator alias without allocating reverse mappings', () => {
  expect(emulatorAddress('http://127.0.0.1:45123')).toBe(
    'http://10.0.2.2:45123',
  );
  expect(emulatorAddress('http://localhost:45124')).toBe(
    'http://10.0.2.2:45124',
  );
  expect(() => emulatorAddress('http://remote.example:45123')).toThrow(
    'only maps a local loopback server',
  );
});
