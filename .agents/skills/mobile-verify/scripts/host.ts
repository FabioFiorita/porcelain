import { createServer } from 'node:net';
import { z } from 'zod';
import {
  hostFileName,
  type RemoteHost,
} from '../../../../apps/mobile/spec/kit/device-host.ts';
import { onPath, sandboxProblems } from '../../verify-core/cli.ts';

const hubLimitMs = 5000;
export const hostDetail = z
  .object({ hub: z.string(), tokenVariable: z.string() })
  .nullable();

export type HostDetail = z.output<typeof hostDetail>;

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

export async function hostProblems(host: RemoteHost): Promise<string[]> {
  const problems = [...sandboxProblems()];
  if (!onPath('agent-device'))
    problems.push(
      'agent-device is missing: install it with npm install --global agent-device',
    );
  if (hubToken(host) === '')
    problems.push(
      `the environment variable ${host.tokenVariable} named in ${hostFileName} is empty; set it to the token of the agent-device hub at ${host.hub}`,
    );
  const health = await fetch(`${hubUrl(host)}/health`, {
    signal: AbortSignal.timeout(hubLimitMs),
  })
    .then((response) => response.status)
    .catch(() => 0);
  if (health !== 200)
    problems.push(
      `the agent-device hub at ${host.hub} does not answer ${hubUrl(host)}/health; on the device host run agent-device proxy and make its port reachable from this machine`,
    );
  if ((await freeHostPorts(host, 2)).length < 2)
    problems.push(
      `fewer than two of the ports in ${hostFileName} are free on this machine; the disposable server and Metro each need one`,
    );
  return problems;
}
