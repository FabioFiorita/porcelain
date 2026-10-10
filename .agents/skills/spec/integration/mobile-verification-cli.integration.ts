import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, stat, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'vitest';
import { test } from '@porcelain/server/kit/server-test';
import {
  bootSimulator,
  releaseSimulator,
  resetApp,
  isBooted,
  shutdownSimulator,
} from '@porcelain/mobile/kit/simulator';
import {
  developmentClient,
  identity,
} from '@porcelain/mobile/kit/development-client';
const execute = promisify(execFile);

test.runIf(process.platform === 'darwin')(
  'reuses an existing shared simulator and installed build while clearing data, refuses a foreign release, and leaves a borrowed UDID booted',
  async ({ onTestFinished }) => {
    const owner = `test-${randomUUID()}`;
    const simulators = async () =>
      (
        await execute('xcrun', ['simctl', 'list', 'devices', '-j'])
      ).stdout.match(/"udid"/g)?.length;
    const simulatorCount = await simulators();
    const first = await bootSimulator('iphone', owner);
    expect(await simulators()).toBe(simulatorCount);
    expect(['iPhone 17', 'iPhone 18 Pro']).toContain(first.name);
    let active = true;
    onTestFinished(async () => {
      if (active) await releaseSimulator(first);
    });
    const client = await developmentClient();
    expect(client).toBeDefined();
    if (client === undefined)
      throw new Error('The matching development client is required.');
    await resetApp(first.udid, client, identity.bundleIdentifier);
    const container = async (kind: string) =>
      (
        await execute('xcrun', [
          'simctl',
          'get_app_container',
          first.udid,
          identity.bundleIdentifier,
          kind,
        ])
      ).stdout.trim();
    const appPath = await container('app');
    const binary = join(appPath, 'PorcelainDev');
    const before = await stat(binary);
    const marker = join(
      await container('data'),
      'Documents',
      'previous-run.txt',
    );
    await writeFile(marker, 'old state');
    expect(await resetApp(first.udid, client, identity.bundleIdentifier)).toBe(
      false,
    );
    expect(await container('app')).toBe(appPath);
    expect((await stat(binary)).mtimeMs).toBe(before.mtimeMs);
    expect(
      await access(marker).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
    await expect(
      releaseSimulator({ ...first, owner: 'another-run' }),
    ).rejects.toThrow('does not own');
    expect(await isBooted(first.udid)).toBe(true);
    await releaseSimulator(first);
    active = false;
    const second = await bootSimulator('iphone', `${owner}-again`);
    let secondActive = true;
    onTestFinished(async () => {
      if (secondActive) await releaseSimulator(second);
    });
    expect(second.udid).toBe(first.udid);
    expect(await resetApp(second.udid, client, identity.bundleIdentifier)).toBe(
      false,
    );
    const claim = join('/tmp/porcelain-simulator-pool', `${second.udid}.claim`);
    expect(await readFile(claim, 'utf8')).toBe(`${owner}-again`);
    await expect(
      bootSimulator('iphone', 'another-run', second.udid),
    ).rejects.toThrow('unavailable');
    await releaseSimulator(second);
    secondActive = false;
    await execute('xcrun', ['simctl', 'boot', second.udid]);
    onTestFinished(() => shutdownSimulator(second.udid));
    const borrowed = await bootSimulator(
      'iphone',
      `${owner}-borrowed`,
      second.udid,
    );
    let borrowedActive = true;
    onTestFinished(async () => {
      if (borrowedActive) await releaseSimulator(borrowed);
    });
    expect(borrowed.borrowed).toBe(true);
    await releaseSimulator(borrowed);
    borrowedActive = false;
    expect(await isBooted(second.udid)).toBe(true);
  },
  180_000,
);
