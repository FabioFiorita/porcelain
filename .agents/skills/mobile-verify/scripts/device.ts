import { execFile, spawnSync } from 'node:child_process';
import { z } from 'zod';
import {
  buildCommand,
  identity,
  nativeFingerprint,
  sharedClientPath,
} from '../../../../apps/mobile/spec/kit/development-client.ts';
import type { DeviceKind } from '../../../../apps/mobile/spec/kit/simulator.ts';
import { Refusal, Usage } from '../../server-verify/scripts/core/cli.ts';
import { hubToken, hubUrl, type HostDetail } from './host.ts';

const keyboardSettleMs = 1500;
const leaseBeatMs = 2 * 60 * 1000;
const families: Record<DeviceKind, string> = { iphone: 'iPhone', ipad: 'iPad' };
const devicesSchema = z.object({
  data: z.object({
    devices: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.string(),
        booted: z.boolean(),
      }),
    ),
  }),
});

export type Target = {
  udid: string | undefined;
  session: string;
  cwd: string;
  host: HostDetail;
};

type Hosted = Target & { host: NonNullable<HostDetail> };

function environmentOf(host: HostDetail): NodeJS.ProcessEnv {
  return host === null
    ? process.env
    : { ...process.env, AGENT_DEVICE_DAEMON_AUTH_TOKEN: hubToken(host) };
}

function argumentsOf(target: Target, args: readonly string[]): string[] {
  return [
    ...args,
    '--platform',
    target.host === null ? 'ios' : 'apple',
    ...(target.udid === undefined ? [] : ['--udid', target.udid]),
    '--session',
    target.session,
  ];
}

function run(target: Target, args: readonly string[]) {
  const result = spawnSync('agent-device', argumentsOf(target, args), {
    cwd: target.cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: environmentOf(target.host),
  });
  if (result.error) throw result.error;
  return {
    ok: result.status === 0,
    stdout: result.stdout,
    output: `${result.stdout}${result.stderr}`,
  };
}

export function agentDevice(
  target: Target,
  args: readonly string[],
  { allowFailure = false } = {},
): string {
  const result = run(target, args);
  if (!result.ok && !allowFailure)
    throw new Refusal(
      result.output.trim() || `agent-device ${args[0] ?? ''} failed`,
    );
  return result.output;
}

export function fillField(
  target: Target,
  address: string,
  value: string,
): string {
  const filled = agentDevice(target, ['fill', address, value, '--settle']);
  agentDevice(target, ['wait', String(keyboardSettleMs)]);
  return filled;
}

export function selector(values: {
  id?: string | undefined;
  label?: string | undefined;
}): string {
  if (values.id !== undefined) return `id=${JSON.stringify(values.id)}`;
  if (values.label !== undefined)
    return `label=${JSON.stringify(values.label)}`;
  throw new Usage(
    'Address the element with --id <testID> or --label <accessibility label>.',
  );
}

function remoteDevices(target: Hosted) {
  const result = run({ ...target, udid: undefined }, ['devices', '--json']);
  if (!result.ok)
    throw new Refusal(
      `the agent-device hub at ${target.host.hub} did not list its simulators: ${result.output.trim()}`,
    );
  return devicesSchema.parse(JSON.parse(result.stdout)).data.devices;
}

export function connectHub(target: Hosted): void {
  const result = spawnSync(
    'agent-device',
    [
      'connect',
      'proxy',
      '--daemon-base-url',
      hubUrl(target.host),
      '--session',
      target.session,
      '--force',
    ],
    {
      cwd: target.cwd,
      encoding: 'utf8',
      env: environmentOf(target.host),
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Refusal(
      `agent-device could not connect to the hub at ${target.host.hub}: ${`${result.stdout}${result.stderr}`.trim()}`,
    );
}

export function disconnectHub(target: Hosted): void {
  run({ ...target, udid: undefined }, ['disconnect']);
}

export function holdLease(target: Hosted): () => void {
  const beat = setInterval(() => {
    execFile(
      'agent-device',
      argumentsOf(target, ['appstate']),
      { cwd: target.cwd, env: environmentOf(target.host) },
      () => undefined,
    );
  }, leaseBeatMs);
  return () => clearInterval(beat);
}

export function remoteBooted(target: Hosted): boolean {
  return remoteDevices(target).some(
    (device) => device.id === target.udid && device.booted,
  );
}

export function remoteSimulator(
  target: Hosted,
  kind: DeviceKind,
): { udid: string; name: string } {
  const prefix = `Porcelain verify ${families[kind]}`;
  const found = remoteDevices(target).find(
    (device) => device.kind === 'simulator' && device.name.startsWith(prefix),
  );
  if (found === undefined)
    throw new Refusal(
      `The device host has no simulator named “${prefix} …”. On the device host, run .agents/skills/mobile-verify/scripts/cli start --device ${kind} and then stop once: start creates that simulator. Then run start here again.`,
    );
  return { udid: found.id, name: found.name };
}

export function resetRemoteApp(target: Hosted): void {
  const client = sharedClientPath(nativeFingerprint());
  agentDevice(target, ['open', 'com.apple.Preferences']);
  const installed = run(target, [
    'reinstall',
    identity.bundleIdentifier,
    client,
  ]);
  if (!installed.ok)
    throw new Refusal(
      `The device host has no development client built for this checkout's native code at ${client} (${installed.output.trim()}). On the device host, in a checkout of this commit, run ${buildCommand}: it builds the development client and leaves a copy at that path. Then run start here again.`,
    );
  agentDevice(target, ['settings', 'reset-keychain', 'clear']);
}

export function isHosted(target: Target): target is Hosted {
  return target.host !== null;
}
