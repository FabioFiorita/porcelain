import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

export type DeviceKind = 'iphone' | 'ipad';

export type Simulator = { udid: string; name: string; kind: DeviceKind };

const execute = promisify(execFile);
const minimumRuntime = 26;
const families: Record<DeviceKind, string> = { iphone: 'iPhone', ipad: 'iPad' };
const preferred: Record<DeviceKind, readonly string[]> = {
  iphone: ['iPhone 17', 'iPhone 18 Pro'],
  ipad: ['iPad Air 11-inch (M4)', 'iPad (A16)'],
};
const runtimesSchema = z.object({
  runtimes: z.array(
    z.object({
      identifier: z.string(),
      version: z.string(),
      platform: z.string().optional(),
      isAvailable: z.boolean(),
      supportedDeviceTypes: z.array(
        z.object({
          identifier: z.string(),
          name: z.string(),
          productFamily: z.string(),
        }),
      ),
    }),
  ),
});
const devicesSchema = z.object({
  devices: z.record(
    z.string(),
    z.array(
      z.object({
        udid: z.string(),
        name: z.string(),
        state: z.string(),
        isAvailable: z.boolean(),
      }),
    ),
  ),
});

async function simctl(...args: string[]): Promise<string> {
  const { stdout } = await execute('xcrun', ['simctl', ...args], {
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

function versionOf(version: string): number[] {
  return version.split('.').map(Number);
}

function newer(left: string, right: string): number {
  const a = versionOf(left);
  const b = versionOf(right);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (b[index] ?? 0) - (a[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

async function deviceFor(kind: DeviceKind) {
  const { runtimes } = runtimesSchema.parse(
    JSON.parse(await simctl('list', 'runtimes', '-j')),
  );
  const [runtime] = runtimes
    .filter(
      (candidate) =>
        candidate.isAvailable &&
        (candidate.platform ?? 'iOS') === 'iOS' &&
        (versionOf(candidate.version)[0] ?? 0) >= minimumRuntime,
    )
    .toSorted((left, right) => newer(left.version, right.version));
  if (runtime === undefined)
    throw new Error(
      `No iOS ${minimumRuntime} or newer simulator runtime is installed; install one in Xcode > Settings > Components.`,
    );
  const family = runtime.supportedDeviceTypes.filter(
    (type) => type.productFamily === families[kind],
  );
  const type =
    preferred[kind]
      .map((name) => family.find((candidate) => candidate.name === name))
      .find((candidate) => candidate !== undefined) ?? family[0];
  if (type === undefined)
    throw new Error(
      `The iOS ${runtime.version} runtime has no ${families[kind]} simulator type.`,
    );
  return { runtime, type };
}

async function devices() {
  return devicesSchema.parse(JSON.parse(await simctl('list', 'devices', '-j')))
    .devices;
}

export async function bootSimulator(
  kind: DeviceKind,
  label: string,
): Promise<Simulator> {
  const { runtime, type } = await deviceFor(kind);
  const name = `Porcelain ${label} ${type.name}`;
  const idle = (await devices())[runtime.identifier]?.find(
    (device) =>
      device.name === name && device.isAvailable && device.state === 'Shutdown',
  );
  const udid =
    idle?.udid ??
    (await simctl('create', name, type.identifier, runtime.identifier)).trim();
  await simctl('boot', udid);
  await simctl('bootstatus', udid, '-b');
  return { udid, name, kind };
}

export async function isBooted(udid: string): Promise<boolean> {
  return Object.values(await devices())
    .flat()
    .some((device) => device.udid === udid && device.state === 'Booted');
}

export async function shutdownSimulator(udid: string): Promise<void> {
  if (await isBooted(udid)) await simctl('shutdown', udid);
}

export async function resetApp(
  udid: string,
  app: string,
  bundleIdentifier: string,
): Promise<void> {
  await simctl('terminate', udid, bundleIdentifier).catch(() => '');
  await simctl('uninstall', udid, bundleIdentifier).catch(() => '');
  await simctl('keychain', udid, 'reset');
  await simctl('install', udid, app);
}
