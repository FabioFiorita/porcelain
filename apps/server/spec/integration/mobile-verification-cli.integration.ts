import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, stat, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import { repositoryRoot } from '../../../../.agents/skills/verify-core/registry.ts';
import {
  bootSimulator,
  releaseSimulator,
  resetApp,
  isBooted,
  shutdownSimulator,
} from '../../../mobile/spec/kit/simulator.ts';
import {
  developmentClient,
  identity,
} from '../../../mobile/spec/kit/development-client.ts';
const execute = promisify(execFile);
const launcher = join(
  repositoryRoot,
  '.agents/skills/mobile-verify/scripts/cli',
);

test.each(['open', 'tap', 'fill', 'snapshot', 'screenshot'])(
  'retires mobile interaction wrapper %s before choosing any instance',
  async (command) => {
    const result = await execute(launcher, [command], {
      cwd: repositoryRoot,
    }).catch((error: unknown) => {
      if (
        !(error instanceof Error) ||
        !('code' in error) ||
        !('stderr' in error)
      )
        throw error;
      return { code: error.code, stderr: error.stderr };
    });
    expect(result).toMatchObject({
      code: 2,
      stderr:
        'Drive the app with the pinned agent-device invocation from the connection card.\n',
    });
  },
);

test.runIf(process.platform === 'darwin')(
  'reuses the fixed simulator and installed build while clearing data, refuses a foreign release, and leaves a borrowed UDID booted',
  async ({ onTestFinished }) => {
    const owner = `test-${randomUUID()}`;
    const first = await bootSimulator('iphone', owner);
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
    expect(second.name).toBe('Porcelain verify iPhone 1');
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
