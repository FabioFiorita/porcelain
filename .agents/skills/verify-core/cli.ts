import type { StopResult } from './processes.ts';
import { createHash } from 'node:crypto';
import { accessSync, constants, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { delimiter, join } from 'node:path';

export class Refusal extends Error {}

export class Usage extends Refusal {}

export function onPath(name: string): boolean {
  return (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .some((folder) => {
      try {
        accessSync(join(folder, name), constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
}

export function sandboxProblems(): string[] {
  const problems: string[] = [];
  if (process.platform === 'linux' && !onPath('bwrap'))
    problems.push(
      'bwrap is missing: install bubblewrap (sudo apt-get install bubblewrap); the disposable server runs inside its sandbox',
    );
  if (process.platform === 'darwin' && !existsSync('/usr/bin/sandbox-exec'))
    problems.push(
      'sandbox-exec is missing: it ships with macOS at /usr/bin/sandbox-exec; the disposable server runs inside its sandbox',
    );
  if (process.platform !== 'linux' && process.platform !== 'darwin')
    problems.push(
      'the server sandbox needs Linux with bubblewrap or macOS with sandbox-exec',
    );
  if (!onPath('git'))
    problems.push(
      'git is missing: install Git (https://git-scm.com/downloads); the sample repository is a real Git repository',
    );
  if (!onPath('ps'))
    problems.push(
      'ps is missing: install procps on Linux or restore the macOS system PATH; captured process ownership requires ps',
    );
  return problems;
}

const memoryFloorGiB = 4;
const androidBuildMemoryFloorGiB = 8;

function readMeminfo(): string | undefined {
  if (process.platform !== 'linux') return undefined;
  try {
    return readFileSync('/proc/meminfo', 'utf8');
  } catch {
    return undefined;
  }
}

export function memoryShortage(
  meminfo: string | undefined,
): string | undefined {
  const kib = meminfo && /^MemAvailable:\s+(\d+) kB$/m.exec(meminfo)?.[1];
  if (!kib) return undefined;
  const available = Number(kib) / 1024 ** 2;
  return available < memoryFloorGiB
    ? `only ${available.toFixed(1)} GiB of memory is available and a disposable instance needs ${memoryFloorGiB} GiB free, because starting instances under memory pressure has crashed this machine; stop an instance you own or wait for other runs to finish`
    : undefined;
}

export function memoryProblem(): string | undefined {
  return memoryShortage(readMeminfo());
}

export function androidBuildMemoryShortage(
  meminfo: string | undefined,
): string | undefined {
  const kib = /^MemAvailable:\s+(\d+) kB$/m.exec(meminfo ?? '')?.[1];
  const available = kib === undefined ? undefined : Number(kib) / 1024 ** 2;
  if (available === undefined || !Number.isFinite(available))
    return 'Cannot read MemAvailable from /proc/meminfo; refusing the Android development build because its available-memory budget cannot be checked.';
  return available < androidBuildMemoryFloorGiB
    ? `Only ${available.toFixed(1)} GiB of memory is available; the Android development build needs ${androidBuildMemoryFloorGiB} GiB free for Gradle and bounded native compilers plus headroom. Builds under memory pressure have been killed by the kernel; stop a process you own or wait for other runs to finish.`
    : undefined;
}

export function androidBuildMemoryProblem(): string | undefined {
  return process.platform === 'linux'
    ? androidBuildMemoryShortage(readMeminfo())
    : undefined;
}

export function optionalDrivers(): string[] {
  return ['curl'].map(
    (name) =>
      `${name}: ${onPath(name) ? 'available' : 'missing (optional; Node fetch can drive HTTP)'}`,
  );
}

export function refuseMissing(problems: readonly (string | undefined)[]) {
  const found = problems.filter((problem) => problem !== undefined);
  if (found.length > 0) throw new Refusal(found.join('\n'));
}

export async function worktreePort(worktree: string): Promise<number> {
  const hash = createHash('sha256').update(worktree).digest().readUInt16BE(0);
  const preferred = 20_000 + (hash % 10_000);
  return freePort(preferred).catch(() => freePort());
}

export function freePort(port = 0): Promise<number> {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(port, '127.0.0.1', () => {
      const bound = probe.address();
      probe.close(() =>
        typeof bound === 'object' && bound !== null
          ? done(bound.port)
          : fail(new Error('No free port on 127.0.0.1')),
      );
    });
  });
}

export async function runCli(
  main: (args: readonly string[]) => Promise<string>,
): Promise<void> {
  try {
    process.stdout.write(await main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = error instanceof Usage ? 2 : 1;
  }
}

export function stopOutput(
  result: StopResult & {
    id: string;
    evidence: string;
    alreadyStopped: boolean;
  },
): string {
  if (!result.complete) process.exitCode = 1;
  const status = result.complete
    ? `${result.alreadyStopped ? 'already stopped' : 'stopped'} ${result.id}`
    : `stop incomplete for ${result.id}`;
  return `${result.report.map((line) => `${line}\n`).join('')}${status}\nevidence ${result.evidence}\n`;
}
