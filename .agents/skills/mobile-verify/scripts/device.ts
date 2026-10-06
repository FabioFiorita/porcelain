import { Schema } from 'effect';
import { execFile, spawnSync } from 'node:child_process';
import {
  buildCommand,
  identity,
  nativeFingerprint,
  sharedClientPath,
} from '../../../../apps/mobile/spec/kit/development-client.ts';
import {
  simulatorLimitProblem,
  type DeviceKind,
} from '../../../../apps/mobile/spec/kit/simulator.ts';
import { Refusal, Usage } from '../../verify-core/cli.ts';
import { hubToken, hubUrl, type HostDetail } from './host.ts';
const keyboardSettleMs = 1500;
const leaseBeatMs = 2 * 60 * 1000;
const families: Record<DeviceKind, string> = { iphone: 'iPhone', ipad: 'iPad' };
const devicesSchema = Schema.Struct({
  data: Schema.Struct({
    devices: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        kind: Schema.String,
        booted: Schema.Boolean,
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
  return Schema.decodeUnknownSync(devicesSchema)(JSON.parse(result.stdout)).data
    .devices;
}
function hub(target: Hosted, args: readonly string[]) {
  const result = spawnSync(
    'agent-device',
    [...args, '--session', target.session],
    { cwd: target.cwd, encoding: 'utf8', env: environmentOf(target.host) },
  );
  if (result.error) throw result.error;
  return {
    ok: result.status === 0,
    output: `${result.stdout}${result.stderr}`.trim(),
  };
}
export function connectHub(target: Hosted): void {
  const connected = hub(target, [
    'connect',
    'proxy',
    '--daemon-base-url',
    hubUrl(target.host),
    '--force',
  ]);
  if (!connected.ok)
    throw new Refusal(
      `agent-device could not connect to the hub at ${target.host.hub}: ${connected.output}`,
    );
}
export function disconnectHub(target: Hosted): void {
  hub(target, ['disconnect']);
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
export function remoteBootProblem(
  target: Hosted & { udid: string },
  limit: number | undefined,
): string | undefined {
  if (limit === undefined) return undefined;
  const booted = remoteDevices(target).filter(
    (device) => device.kind === 'simulator' && device.booted,
  );
  return booted.some((device) => device.id === target.udid)
    ? undefined
    : simulatorLimitProblem(
        booted.map((device) => device.name),
        limit,
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
export async function resetRemoteApp(target: Hosted): Promise<void> {
  const client = sharedClientPath(await nativeFingerprint());
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
