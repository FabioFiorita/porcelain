import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { identity } from './development-client.ts';
import { claimPoolFile, releasePoolFile } from './simulator-pool.ts';

const execute = promisify(execFile);
const poolDirectory = '/tmp/porcelain-simulator-pool';

export async function adb(serial: string, ...args: string[]): Promise<string> {
  const { stdout } = await execute('adb', ['-s', serial, ...args], {
    timeout: args[0] === 'install' ? 120_000 : 15_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout.trim();
}

export async function claimAndroid(serial: string | undefined, owner: string) {
  if (serial === undefined || !/^emulator-\d+$/.test(serial))
    throw new Error(
      'Select a booted Android emulator with --serial or androidSerial in .mobile-device-host.json. Physical devices are refused because verification clears app data.',
    );
  if (
    (await adb(serial, 'get-state')) !== 'device' ||
    (await adb(serial, 'shell', 'getprop', 'sys.boot_completed')) !== '1'
  )
    throw new Error(
      `Android emulator ${serial} is not ready. Boot it in Android Studio or T3, then retry with its adb serial.`,
    );
  await mkdir(poolDirectory, { recursive: true, mode: 0o700 });
  const path = join(poolDirectory, `${serial}.claim`);
  const name =
    (await adb(serial, 'emu', 'avd', 'name')).split('\n')[0]?.trim() ?? serial;
  const claim = (() => {
    try {
      return claimPoolFile(path, owner);
    } catch (error) {
      throw new Error(
        `Android emulator ${serial} is already claimed or its claim cannot be acquired. Stop the owning mobile verification instance, or choose another explicitly owned emulator.`,
        { cause: error },
      );
    }
  })();
  return {
    udid: serial,
    name,
    kind: 'android' as const,
    owner,
    ownerProcess: claim.process,
    borrowed: true,
  };
}

export async function releaseAndroid(simulator: {
  udid: string;
  owner: string;
  ownerProcess: { pid: number; birth: string };
}): Promise<void> {
  releasePoolFile(join(poolDirectory, `${simulator.udid}.claim`), {
    owner: simulator.owner,
    process: simulator.ownerProcess,
  });
}

export async function resetAndroid(
  serial: string,
  app: string,
  bundleIdentifier: string,
): Promise<boolean> {
  if (bundleIdentifier !== identity.bundleIdentifier)
    throw new Error('Android verification only resets the development app.');
  const installed = await adb(
    serial,
    'shell',
    'pm',
    'list',
    'packages',
    bundleIdentifier,
  );
  const exists = installed.split('\n').includes(`package:${bundleIdentifier}`);
  let matches = false;
  if (exists) {
    const paths = await adb(serial, 'shell', 'pm', 'path', bundleIdentifier);
    const apk = paths
      .split('\n')
      .find((path) => path.startsWith('package:') && path.endsWith('/base.apk'))
      ?.slice('package:'.length);
    if (apk === undefined)
      throw new Error(
        'Could not locate the installed development APK to verify its native build.',
      );
    const installedDigest = (
      await adb(serial, 'shell', 'run-as', bundleIdentifier, 'sha256sum', apk)
    ).split(/\s+/)[0];
    const digest = createHash('sha256')
      .update(await readFile(app))
      .digest('hex');
    matches = installedDigest === digest;
  }
  const changed = !matches;
  if (changed) await adb(serial, 'install', '-r', app);
  const cleared = await adb(serial, 'shell', 'pm', 'clear', bundleIdentifier);
  if (cleared !== 'Success')
    throw new Error(`Could not clear Android development app data: ${cleared}`);
  return changed;
}

export function emulatorAddress(address: string): string {
  const url = new URL(address);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Android development only maps a local loopback server.');
  url.hostname = '10.0.2.2';
  return url.origin;
}
