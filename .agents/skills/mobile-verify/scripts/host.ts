import { Schema } from 'effect';
import { createServer } from 'node:net';
import {
  hostFileName,
  type RemoteHost,
} from '@porcelain/mobile/kit/device-host';
import { agentDeviceVersion } from '@porcelain/mobile/kit/tools';
import { sandboxProblems } from '../../verify-core/cli.ts';
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
  const versions = new Set([health.version, health.upstream.version]);
  return versions.size === 1 && versions.has(agentDeviceVersion)
    ? []
    : [
        `the agent-device hub runs ${[...versions].join(' and ')} but this checkout pins ${agentDeviceVersion}, and the two refuse each other; install agent-device ${agentDeviceVersion} on the device host and restart its hub`,
      ];
}
export async function hostProblems(
  host: RemoteHost,
  ownDriver: boolean,
): Promise<string[]> {
  const problems = [...sandboxProblems()];
  if (host.ssh === undefined || host.checkout === undefined)
    problems.push(
      'Add ssh (the Mac SSH alias) and checkout (a matching Mac worktree) to the private device-host config; the launcher prepares and releases simulators there.',
    );
  if (!ownDriver) problems.push(...(await hubProblems(host)));
  if ((await freeHostPorts(host, 2)).length < 2)
    problems.push(
      `fewer than two of the ports in ${hostFileName} are free on this machine; the disposable server and Metro each need one`,
    );
  return problems;
}
