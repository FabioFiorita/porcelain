import type { StopResult } from './processes.ts';
import { accessSync, constants, existsSync } from 'node:fs';
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

export function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
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
