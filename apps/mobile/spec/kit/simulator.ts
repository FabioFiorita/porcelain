import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import { z } from 'zod';
import { hostFileName } from './device-host.ts';

export type DeviceKind = 'iphone' | 'ipad';

export type Simulator = {
  udid: string;
  name: string;
  kind: DeviceKind;
  runtime: { identifier: string; version: string };
};

const execute = promisify(execFile);
const minimumRuntime = 26;
const language = 'en-US';
const locale = 'en_US';
const settleMs = 500;
const shutdownLimitMs = 60 * 1000;
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
        dataPath: z.string().optional(),
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

async function deviceFor(kind: DeviceKind, runtimeVersion?: string) {
  const { runtimes } = runtimesSchema.parse(
    JSON.parse(await simctl('list', 'runtimes', '-j')),
  );
  const [runtime] = runtimes
    .filter(
      (candidate) =>
        candidate.isAvailable &&
        (candidate.platform ?? 'iOS') === 'iOS' &&
        (versionOf(candidate.version)[0] ?? 0) >= minimumRuntime &&
        (runtimeVersion === undefined || candidate.version === runtimeVersion),
    )
    .toSorted((left, right) => newer(left.version, right.version));
  if (runtime === undefined)
    throw new Error(
      `No ${runtimeVersion === undefined ? `iOS ${minimumRuntime} or newer` : `iOS ${runtimeVersion}`} simulator runtime is installed; install one in Xcode > Settings > Components.`,
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

async function bootedSimulators(): Promise<string[]> {
  return Object.values(
    devicesSchema.parse(
      JSON.parse(await simctl('list', 'devices', 'booted', '-j')),
    ).devices,
  )
    .flat()
    .map((device) => device.name);
}

export function simulatorLimitProblem(
  booted: readonly string[],
  limit: number | undefined,
): string | undefined {
  if (limit === undefined || booted.length < limit) return undefined;
  return `The device host already has ${booted.length} booted simulators (${booted.join(', ')}) and simulatorLimit in ${hostFileName} allows ${limit} at once; each thread stops only its own instance with .agents/skills/mobile-verify/scripts/cli stop, so start again once one has stopped.`;
}

export async function localBootProblem(
  limit: number | undefined,
): Promise<string | undefined> {
  return limit === undefined
    ? undefined
    : simulatorLimitProblem(await bootedSimulators(), limit);
}

async function suppressSystemFollowUps(udid: string): Promise<void> {
  const device = Object.values(await devices())
    .flat()
    .find((candidate) => candidate.udid === udid);
  if (device?.dataPath === undefined)
    throw new Error(`The simulator ${udid} has no data path.`);
  const preferences = join(device.dataPath, 'Library/Preferences');
  await mkdir(preferences, { recursive: true });
  await writeFile(
    join(preferences, 'com.apple.generativeexperiences.corefollowup.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>DateOfLastAppleIntelligenceReadinessCFU</key>
  <date>2020-01-01T00:00:00Z</date>
</dict>
</plist>
`,
  );
  await rm(join(device.dataPath, 'Library/CoreFollowUp'), {
    recursive: true,
    force: true,
  });
}

async function suppressBackgroundServices(udid: string): Promise<void> {
  const folder = join(
    '/private/var/tmp',
    `com.apple.CoreSimulator.SimDevice.${udid}`,
  );
  const path = join(folder, 'disabled.plist');
  const labels = [
    'com.apple.apsd',
    'com.apple.chronod',
    'com.apple.PosterBoard',
    'com.apple.mediaanalysisd',
    'com.apple.mediaanalysisd.service',
    'com.apple.photoanalysisd',
  ];
  const entries = existsSync(path)
    ? z
        .record(z.string(), z.boolean())
        .parse(
          JSON.parse(
            (await execute('plutil', ['-convert', 'json', '-o', '-', path]))
              .stdout,
          ),
        )
    : {};
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const temporary = join(folder, 'porcelain-disabled.plist');
  await writeFile(
    temporary,
    JSON.stringify({
      ...entries,
      ...Object.fromEntries(labels.map((label) => [label, true])),
    }),
    { mode: 0o644 },
  );
  await execute('plutil', ['-convert', 'xml1', temporary]);
  await rename(temporary, path);
  console.info(
    `CI simulator ${udid} disables background services: ${labels.join(', ')}`,
  );
}

export async function bootSimulator(
  kind: DeviceKind,
  label: string,
  runtimeVersion?: string,
): Promise<Simulator> {
  const { runtime, type } = await deviceFor(kind, runtimeVersion);
  const name = `Porcelain ${label} ${type.name}`;
  const idle = (await devices())[runtime.identifier]?.find(
    (device) =>
      device.name === name && device.isAvailable && device.state === 'Shutdown',
  );
  const udid =
    idle?.udid ??
    (await simctl('create', name, type.identifier, runtime.identifier)).trim();
  await suppressSystemFollowUps(udid);
  if (process.env.CI === 'true' && label === 'e2e')
    await suppressBackgroundServices(udid);
  await simctl('boot', udid);
  await simctl('bootstatus', udid, '-b');
  const languages = await simctl(
    'spawn',
    udid,
    'defaults',
    'read',
    '-g',
    'AppleLanguages',
  ).catch(() => '');
  if (!languages.trimStart().startsWith(`(\n    "${language}"`)) {
    await simctl(
      'spawn',
      udid,
      'defaults',
      'write',
      '-g',
      'AppleLanguages',
      '-array',
      language,
    );
    await simctl(
      'spawn',
      udid,
      'defaults',
      'write',
      '-g',
      'AppleLocale',
      locale,
    );
    await shutdownSimulator(udid);
    await simctl('boot', udid);
    await simctl('bootstatus', udid, '-b');
  }
  return {
    udid,
    name,
    kind,
    runtime: { identifier: runtime.identifier, version: runtime.version },
  };
}

async function stateOf(udid: string): Promise<string | undefined> {
  return Object.values(await devices())
    .flat()
    .find((device) => device.udid === udid)?.state;
}

export async function isBooted(udid: string): Promise<boolean> {
  return (await stateOf(udid)) === 'Booted';
}

export async function shutdownSimulator(udid: string): Promise<void> {
  if (await isBooted(udid)) await simctl('shutdown', udid);
  const deadline = Date.now() + shutdownLimitMs;
  for (
    let state = await stateOf(udid);
    state !== 'Shutdown' && state !== undefined;
    state = await stateOf(udid)
  ) {
    if (Date.now() > deadline)
      throw new Error(`The simulator ${udid} is still ${state}.`);
    await sleep(settleMs);
  }
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
