import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { repositoryRoot } from './development-client.ts';

export const hostFileName = '.mobile-device-host.json';
const hubFields = ['hub', 'tokenVariable', 'ports'] as const;
const fileSchema = z.object({
  hub: z.url({ protocol: /^https?$/ }).optional(),
  tokenVariable: z
    .string()
    .regex(/^[A-Z_][A-Z0-9_]*$/)
    .optional(),
  ports: z.array(z.number().int().min(1024).max(65535)).min(2).optional(),
  simulatorLimit: z.number().int().positive().optional(),
});

export type RemoteHost = {
  hub: string;
  tokenVariable: string;
  ports: number[];
};
export type DeviceHost = {
  remote: RemoteHost | undefined;
  simulatorLimit: number | undefined;
};

export function mainCheckoutHostFile(): string {
  let commonDirectory: string;
  try {
    commonDirectory = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd: repositoryRoot, encoding: 'utf8', stdio: 'pipe' },
    ).trim();
  } catch {
    throw new Error(
      `${repositoryRoot} is not a git checkout; the mobile tools run inside a git checkout of Porcelain, whose main checkout holds ${hostFileName}.`,
    );
  }
  return join(dirname(commonDirectory), hostFileName);
}

function fileProblem(hostFile: string, wrong: readonly string[]): Error {
  return new Error(
    [
      `${hostFile} describes this machine's simulators; every field is optional:`,
      '  "simulatorLimit": the most simulators the device host may have booted at once, a positive integer; without it there is no limit',
      "and, to drive a Mac's simulators from another machine, all three of:",
      '  "hub": the agent-device hub URL as this machine reaches it, such as "http://127.0.0.1:4310"',
      '  "tokenVariable": the name of the environment variable that holds the hub token, such as "AGENT_DEVICE_DAEMON_AUTH_TOKEN"',
      '  "ports": at least two ports from 1024 up that the simulator reaches on this machine at http://localhost:<port>',
      ...wrong.map((line) => `wrong: ${line}`),
    ].join('\n'),
  );
}

export function deviceHost(): DeviceHost {
  const hostFile = mainCheckoutHostFile();
  if (!existsSync(hostFile))
    return { remote: undefined, simulatorLimit: undefined };
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(hostFile, 'utf8'));
  } catch (error) {
    throw new Error(
      `${hostFile} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const parsed = fileSchema.safeParse(value);
  if (!parsed.success)
    throw fileProblem(
      hostFile,
      parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || 'the file'}: ${issue.message}`,
      ),
    );
  const { hub, tokenVariable, ports, simulatorLimit } = parsed.data;
  if (hub !== undefined && tokenVariable !== undefined && ports !== undefined)
    return { remote: { hub, tokenVariable, ports }, simulatorLimit };
  const present = hubFields.filter((field) => parsed.data[field] !== undefined);
  if (present.length > 0)
    throw fileProblem(hostFile, [
      `it has ${present.join(' and ')} but not ${hubFields.filter((field) => !present.includes(field)).join(' and ')}; give all three to drive a remote device host, or none to drive this Mac's simulators`,
    ]);
  return { remote: undefined, simulatorLimit };
}
