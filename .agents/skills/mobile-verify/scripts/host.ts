import { Schema } from 'effect';
import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import {
  hostFileName,
  type RemoteHost,
} from '@porcelain/mobile/kit/device-host';
import {
  agentDeviceMissing,
  agentDeviceVersion,
} from '@porcelain/mobile/kit/tools';
import {
  buildCommand,
  nativeFingerprint,
} from '@porcelain/mobile/kit/development-client';
import { sandboxProblems } from '../../verify-core/cli.ts';
import { shellCommand } from '../../verify-core/connection.ts';
import { inspectionSchema } from './simulator-host.ts';
const hubLimitMs = 5000;
const healthSchema = Schema.Struct({
  ok: Schema.Boolean,
  version: Schema.optional(Schema.String),
  upstream: Schema.optional(
    Schema.Struct({
      ok: Schema.Boolean,
      version: Schema.optional(Schema.String),
    }),
  ),
});
export function hubToken(host: { tokenVariable: string }): string {
  return process.env[host.tokenVariable] ?? '';
}
export function hubUrl(host: { hub: string }): string {
  return `${host.hub.replace(/\/+$/, '')}/agent-device`;
}
function portIsFree(port: number): Promise<boolean> {
  return new Promise((done) => {
    const probe = createServer();
    probe.once('error', () => done(false));
    probe.listen({ host: '127.0.0.1', port }, () =>
      probe.close(() => done(true)),
    );
  });
}
export async function freeHostPorts(
  host: RemoteHost,
  count: number,
): Promise<number[]> {
  const free: number[] = [];
  for (const port of host.ports) {
    if (free.length === count) break;
    if (await portIsFree(port)) free.push(port);
  }
  return free;
}
async function hubProblems(host: RemoteHost): Promise<string[]> {
  if (hubToken(host) === '')
    return [
      `the environment variable ${host.tokenVariable} named in ${hostFileName} is empty; set it to the token of the agent-device hub at ${host.hub}`,
    ];
  const health = await fetch(`${host.hub}/health`, {
    signal: AbortSignal.timeout(hubLimitMs),
  })
    .then(async (response) =>
      Schema.decodeUnknownSync(healthSchema)(await response.json()),
    )
    .catch(() => undefined);
  if (health === undefined)
    return [
      `the agent-device hub at ${host.hub} does not answer ${host.hub}/health; on the device host run agent-device proxy and make its port reachable from this machine`,
    ];
  if (!health.ok || health.upstream?.ok !== true)
    return [
      `the agent-device hub at ${host.hub} answers, but the device daemon behind it does not; restart the hub on the device host, and keep its daemon alive with AGENT_DEVICE_DAEMON_IDLE_TIMEOUT_MS=0 (references/remote.md)`,
    ];
  const client = agentDeviceVersion();
  if (client === undefined) return [agentDeviceMissing];
  const versions = new Set([health.version, health.upstream.version]);
  return versions.size === 1 && versions.has(client)
    ? []
    : [
        `the agent-device hub runs ${[...versions].join(' and ')} but this machine's synced client runs ${client}, and the two refuse each other; run \`device sync\` from the engineering plugin to move both to the version T3 Code pins`,
      ];
}
export function hostArgs(
  ssh: string,
  checkout: string,
  request: object,
): string[] {
  return [
    '-o',
    'BatchMode=yes',
    ssh,
    `cd ${shellCommand([checkout])} && mise exec -- ${shellCommand(['node', '.agents/skills/mobile-verify/scripts/simulator-host.ts', JSON.stringify(request)])}`,
  ];
}
type Inspection = typeof inspectionSchema.Type | { failure: string };
function inspectHost(ssh: string, checkout: string): Promise<Inspection> {
  return new Promise((done) =>
    execFile(
      'ssh',
      hostArgs(ssh, checkout, { action: 'inspect' }),
      { timeout: 120_000 },
      (error, stdout, stderr) =>
        done(
          error === null
            ? Schema.decodeUnknownSync(inspectionSchema)(
                JSON.parse(stdout.trim().split('\n').at(-1) ?? ''),
              )
            : { failure: stderr.trim() || error.message },
        ),
    ),
  );
}
async function nativeProblem(
  ssh: string,
  checkout: string,
  inspect: typeof inspectHost,
): Promise<string | undefined> {
  const [local, mac] = await Promise.all([
    nativeFingerprint(),
    inspect(ssh, checkout),
  ]);
  const build = `run ${buildCommand} on the Mac in ${checkout} (ssh ${ssh})`;
  if ('failure' in mac)
    return `the Mac checkout ${checkout} could not report its native fingerprint over ssh ${ssh}: ${mac.failure}`;
  if (mac.fingerprint !== local)
    return `the Mac checkout ${checkout} has different native inputs (fingerprint ${mac.fingerprint}) from this checkout (${local}); check out this commit there and run pnpm install, then ${build}`;
  if (!mac.client)
    return `the Mac has no development client for this native fingerprint (${local}); native inputs changed since the last build, so ${build}`;
  return undefined;
}
export async function hostProblems(
  host: RemoteHost,
  ownDriver: boolean,
  inspect = inspectHost,
): Promise<string[]> {
  const problems = [...sandboxProblems()];
  if (host.ssh === undefined || host.checkout === undefined)
    problems.push(
      'Add ssh (the Mac SSH alias) and checkout (a matching Mac worktree) to the private device-host config; the launcher prepares and releases simulators there.',
    );
  else {
    const native = await nativeProblem(host.ssh, host.checkout, inspect);
    if (native !== undefined) problems.push(native);
  }
  if (!ownDriver) problems.push(...(await hubProblems(host)));
  if ((await freeHostPorts(host, 2)).length < 2)
    problems.push(
      `fewer than two of the ports in ${hostFileName} are free on this machine; the disposable server and Metro each need one`,
    );
  return problems;
}
