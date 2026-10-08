import { Schema } from 'effect';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nativeFingerprint } from './development-client.ts';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import { hostFileName } from './device-host.ts';
import {
  assertPoolOwner,
  claimPoolFile,
  poolClaimAlive,
  poolProcessSchema,
  readPoolClaim,
  removeStalePoolClaim,
  releasePoolFile,
  type PoolClaim,
} from './simulator-pool.ts';
export type DeviceKind = 'iphone' | 'ipad';
export const simulatorSchema = Schema.Struct({
  udid: Schema.String,
  name: Schema.String,
  kind: Schema.Literals(['iphone', 'ipad']),
  owner: Schema.String,
  ownerProcess: poolProcessSchema,
  borrowed: Schema.Boolean,
});
export type Simulator = typeof simulatorSchema.Type;
const poolDirectory = '/tmp/porcelain-simulator-pool';
const poolNames: Record<DeviceKind, readonly string[]> = {
  iphone: ['Porcelain verify iPhone 1', 'Porcelain verify iPhone 2'],
  ipad: ['Porcelain verify iPad'],
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
const runtimesSchema = Schema.Struct({
  runtimes: Schema.Array(
    Schema.Struct({
      identifier: Schema.String,
      version: Schema.String,
      platform: Schema.optional(Schema.String),
      isAvailable: Schema.Boolean,
      supportedDeviceTypes: Schema.Array(
        Schema.Struct({
          identifier: Schema.String,
          name: Schema.String,
          productFamily: Schema.String,
        }),
      ),
    }),
  ),
});
const devicesSchema = Schema.Struct({
  devices: Schema.Record(
    Schema.String,
    Schema.Array(
      Schema.Struct({
        udid: Schema.String,
        name: Schema.String,
        state: Schema.String,
        isAvailable: Schema.Boolean,
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
  const { runtimes } = Schema.decodeUnknownSync(runtimesSchema)(
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
  return Schema.decodeUnknownSync(devicesSchema)(
    JSON.parse(await simctl('list', 'devices', '-j')),
  ).devices;
}
async function bootedSimulators(): Promise<string[]> {
  return Object.values(
    Schema.decodeUnknownSync(devicesSchema)(
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
  limit: number | undefined = 2,
): Promise<string | undefined> {
  return limit === undefined
    ? undefined
    : simulatorLimitProblem(await bootedSimulators(), limit);
}
export async function bootSimulator(
  kind: DeviceKind,
  owner: string,
  requested?: string,
  limit = 2,
): Promise<Simulator> {
  await mkdir(poolDirectory, { recursive: true, mode: 0o700 });
  const lockPath = join(poolDirectory, 'pool.lock');
  let lock: PoolClaim;
  try {
    lock = claimPoolFile(lockPath, owner);
  } catch (error) {
    throw new Error(
      'Another simulator allocation is in progress; retry after it finishes.',
      { cause: error },
    );
  }
  let claimed: { path: string; claim: PoolClaim } | undefined;
  try {
    for (const family of ['iphone', 'ipad'] as const) {
      const { runtime, type } = await deviceFor(family);
      for (const name of poolNames[family]) {
        if (
          !Object.values(await devices())
            .flat()
            .some((device) => device.name === name)
        )
          await simctl('create', name, type.identifier, runtime.identifier);
      }
    }
    const available = Object.values(await devices()).flat();
    const unclaimed = [];
    for (const candidate of available) {
      const path = join(poolDirectory, `${candidate.udid}.claim`);
      const claim = readPoolClaim(path);
      let stopped = false;
      if (
        claim !== undefined &&
        !poolClaimAlive(claim) &&
        candidate.udid !== requested &&
        Object.values(poolNames).flat().includes(candidate.name)
      ) {
        await shutdownSimulator(candidate.udid);
        stopped = true;
      }
      removeStalePoolClaim(path);
      if (readPoolClaim(path) === undefined) {
        unclaimed.push(
          stopped ? { ...candidate, state: 'Shutdown' } : candidate,
        );
      }
    }
    const device =
      requested === undefined
        ? unclaimed.find(
            (candidate) =>
              poolNames[kind].includes(candidate.name) &&
              candidate.isAvailable &&
              candidate.state === 'Shutdown',
          )
        : unclaimed.find(
            (candidate) =>
              candidate.udid === requested && candidate.isAvailable,
          );
    if (device === undefined)
      throw new Error(
        requested === undefined
          ? `All fixed ${kind} simulators are busy; stop an owned run and retry. No device was created as a fallback.`
          : `Simulator ${requested} is unavailable.`,
      );
    const borrowed = requested !== undefined;
    if (borrowed && device.state !== 'Booted')
      throw new Error(
        '--udid accepts only a booted simulator already claimed by the caller.',
      );
    if (!borrowed) {
      const crowded = await localBootProblem(Math.min(limit, 2));
      if (crowded !== undefined) throw new Error(crowded);
    }
    const path = join(poolDirectory, `${device.udid}.claim`);
    const claim = claimPoolFile(path, owner);
    claimed = { path, claim };
    try {
      if (!borrowed) await simctl('boot', device.udid);
      await prepareLanguage(device.udid, borrowed);
      return {
        udid: device.udid,
        name: device.name,
        kind,
        owner,
        ownerProcess: claim.process,
        borrowed,
      };
    } catch (error) {
      if (!borrowed) await shutdownSimulator(device.udid);
      throw error;
    }
  } catch (error) {
    if (claimed !== undefined) releasePoolFile(claimed.path, claimed.claim);
    throw error;
  } finally {
    releasePoolFile(lockPath, lock);
  }
}
async function prepareLanguage(udid: string, borrowed: boolean): Promise<void> {
  await simctl('bootstatus', udid, '-b');
  const languages = await simctl(
    'spawn',
    udid,
    'defaults',
    'read',
    '-g',
    'AppleLanguages',
  ).catch(() => '');
  if (!borrowed && !languages.trimStart().startsWith(`(\n    "${language}"`)) {
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
}
export async function releaseSimulator(simulator: Simulator): Promise<void> {
  const claim = join(poolDirectory, `${simulator.udid}.claim`);
  const expected = { owner: simulator.owner, process: simulator.ownerProcess };
  assertPoolOwner(claim, expected);
  if (!simulator.borrowed) await shutdownSimulator(simulator.udid);
  releasePoolFile(claim, expected);
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
): Promise<boolean> {
  await simctl('terminate', udid, bundleIdentifier).catch(() => '');
  const fingerprint = await nativeFingerprint();
  const marker = join(poolDirectory, `${udid}.build`);
  const previous = await readFile(marker, 'utf8').catch(() => '');
  const installed = await simctl(
    'get_app_container',
    udid,
    bundleIdentifier,
    'app',
  ).catch(() => '');
  const changed = previous !== fingerprint || installed.trim() === '';
  if (changed) {
    await simctl('install', udid, app);
    await writeFile(marker, fingerprint, { mode: 0o600 });
  }
  const container = (
    await simctl('get_app_container', udid, bundleIdentifier, 'data')
  ).trim();
  for (const entry of await readdir(container)) {
    if (entry !== '.com.apple.mobile_container_manager.metadata.plist')
      await rm(join(container, entry), { recursive: true, force: true });
  }
  for (const directory of [
    'Documents',
    'Library/Caches',
    'Library/Preferences',
    'SystemData',
    'tmp',
  ])
    await mkdir(join(container, directory), { recursive: true });
  await simctl('keychain', udid, 'reset');
  return changed;
}
