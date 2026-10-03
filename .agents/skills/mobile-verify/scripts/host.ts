import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import {
  onPath,
  Refusal,
  sandboxProblems,
} from '../../server-verify/scripts/core/cli.ts';
import { repositoryRoot } from '../../server-verify/scripts/core/registry.ts';

export const hostFileName = '.mobile-device-host.json';
const hubLimitMs = 5000;
const hostSchema = z.object({
  hub: z.url({ protocol: /^https?$/ }),
  tokenVariable: z.string().regex(/^[A-Z_][A-Z0-9_]*$/),
  ports: z.array(z.number().int().min(1024).max(65535)).min(2),
});
export const hostDetail = z
  .object({ hub: z.string(), tokenVariable: z.string() })
  .nullable();

export type DeviceHost = z.output<typeof hostSchema>;
export type HostDetail = z.output<typeof hostDetail>;

export function mainCheckoutHostFile(): string {
  let commonDirectory: string;
  try {
    commonDirectory = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd: repositoryRoot, encoding: 'utf8', stdio: 'pipe' },
    ).trim();
  } catch {
    throw new Refusal(
      `${repositoryRoot} is not a git checkout; the mobile CLI runs inside a git checkout of Porcelain, whose main checkout holds ${hostFileName}.`,
    );
  }
  return join(dirname(commonDirectory), hostFileName);
}

export function deviceHost(): DeviceHost | undefined {
  const hostFile = mainCheckoutHostFile();
  if (!existsSync(hostFile)) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(hostFile, 'utf8'));
  } catch (error) {
    throw new Refusal(
      `${hostFile} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const parsed = hostSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new Refusal(
    [
      `${hostFile} describes the remote device host and needs:`,
      '  "hub": the agent-device hub URL as this machine reaches it, such as "http://127.0.0.1:4310"',
      '  "tokenVariable": the name of the environment variable that holds the hub token, such as "AGENT_DEVICE_DAEMON_AUTH_TOKEN"',
      '  "ports": at least two ports from 1024 up that the simulator reaches on this machine at http://localhost:<port>',
      ...parsed.error.issues.map(
        (issue) =>
          `wrong: ${issue.path.join('.') || 'the file'}: ${issue.message}`,
      ),
    ].join('\n'),
  );
}

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
  host: DeviceHost,
  count: number,
): Promise<number[]> {
  const free: number[] = [];
  for (const port of host.ports) {
    if (free.length === count) break;
    if (await portIsFree(port)) free.push(port);
  }
  return free;
}

export async function hostProblems(host: DeviceHost): Promise<string[]> {
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
