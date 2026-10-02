import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  accessSync,
  constants,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { record, text } from '../../../../apps/server/spec/kit/session.ts';
import { Recorder } from '../../../../apps/server/spec/kit/isolated-server.ts';

export const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

export const registry = join(
  tmpdir(),
  'porcelain-server-cli',
  createHash('sha256').update(repositoryRoot).digest('hex').slice(0, 16),
);

export const STALE_BUILD = 'server code changed since start, run start again';

export type Instance = {
  id: string;
  folder: string;
  address: string;
  credential: string;
  desktopCredential: string;
  manifestPath: string;
  projectId: string;
  worktreeId: string;
  repository: string;
  projectHome: string;
  evidence: string;
  fingerprint: string;
  logFile: string;
  startedAt: string;
  pid: number;
};

export function instanceOf(value: unknown): Instance {
  const entry = record(value);
  return {
    id: text(entry.id),
    folder: text(entry.folder),
    address: text(entry.address),
    credential: text(entry.credential),
    desktopCredential: text(entry.desktopCredential),
    manifestPath: text(entry.manifestPath),
    projectId: text(entry.projectId),
    worktreeId: text(entry.worktreeId),
    repository: text(entry.repository),
    projectHome: text(entry.projectHome),
    evidence: text(entry.evidence),
    fingerprint: text(entry.fingerprint),
    logFile: text(entry.logFile),
    startedAt: text(entry.startedAt),
    pid: Number(entry.pid),
  };
}

export class Refusal extends Error {}

const fingerprintRoots = [
  'apps/server/src',
  'apps/server/spec/kit',
  'apps/server/spec/fakes',
  'packages/storage/drizzle',
  'pnpm-lock.yaml',
];

function packageSources(): string[] {
  return readdirSync(join(repositoryRoot, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join('packages', entry.name, 'src'));
}

export function buildFingerprint(): string {
  const hash = createHash('sha256');
  for (const root of [...fingerprintRoots, ...packageSources()]) {
    const absolute = join(repositoryRoot, root);
    if (!existsSync(absolute)) continue;
    const files = statSync(absolute).isDirectory()
      ? readdirSync(absolute, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile() && !entry.name.endsWith('.spec.ts'))
          .map((entry) => join(entry.parentPath, entry.name))
      : [absolute];
    for (const file of files.sort()) {
      const { size, mtimeMs } = statSync(file);
      hash.update(`${file}\0${size}\0${mtimeMs}\n`);
    }
  }
  return hash.digest('hex');
}

function onPath(name: string): boolean {
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

export function missingTools(): string[] {
  const missing: string[] = [];
  if (process.platform === 'linux' && !onPath('bwrap'))
    missing.push(
      'bwrap is missing: install bubblewrap (sudo apt-get install bubblewrap); the server runs inside its sandbox',
    );
  if (process.platform === 'darwin' && !existsSync('/usr/bin/sandbox-exec'))
    missing.push(
      'sandbox-exec is missing: it ships with macOS at /usr/bin/sandbox-exec; the server runs inside its sandbox',
    );
  if (process.platform !== 'linux' && process.platform !== 'darwin')
    missing.push(
      'the server sandbox needs Linux with bubblewrap or macOS with sandbox-exec',
    );
  if (!onPath('git'))
    missing.push(
      'git is missing: install Git (https://git-scm.com/downloads); the sample repository is a real Git repository',
    );
  return missing;
}

export function isOurs(pid: number, folder: string): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  const command =
    process.platform === 'linux'
      ? readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ')
      : spawnSync('ps', ['-o', 'command=', '-p', String(pid)], {
          encoding: 'utf8',
        }).stdout;
  return command.includes('cli.ts serve') && command.includes(folder);
}

export async function instances(): Promise<
  { instance: Instance; alive: boolean }[]
> {
  if (!existsSync(registry)) return [];
  const found: { instance: Instance; alive: boolean }[] = [];
  for (const name of (await readdir(registry)).sort()) {
    const file = join(registry, name, 'instance.json');
    if (!existsSync(file)) continue;
    const instance = instanceOf(JSON.parse(await readFile(file, 'utf8')));
    found.push({ instance, alive: isOurs(instance.pid, instance.folder) });
  }
  return found;
}

export async function chosen(
  requested: string | undefined,
  { includeStopped = false } = {},
): Promise<Instance> {
  const known = await instances();
  const candidates = known.filter(
    (entry) => entry.alive || (includeStopped && requested !== undefined),
  );
  const listing = known
    .map(
      ({ instance, alive }) =>
        `  ${instance.id}  ${instance.address}  ${alive ? 'running' : 'stopped'}  started ${instance.startedAt}`,
    )
    .join('\n');
  if (requested !== undefined) {
    const match = candidates.find((entry) => entry.instance.id === requested);
    if (match) return match.instance;
    throw new Refusal(
      `no running instance ${requested} in this checkout${listing ? `:\n${listing}` : '; run start'}`,
    );
  }
  const [only, ...others] = candidates;
  if (!only)
    throw new Refusal('no running instance in this checkout; run start');
  if (others.length > 0)
    throw new Refusal(
      `${candidates.length} instances are running in this checkout; name one with --instance <id>:\n${listing}`,
    );
  return only.instance;
}

export function recorderFor(instance: Instance): Recorder {
  const recorder = new Recorder();
  recorder.secret(instance.credential);
  recorder.secret(instance.desktopCredential);
  recorder.phase = 'request';
  return recorder;
}

export async function writeEvidence(
  instance: Pick<Instance, 'evidence'>,
  command: string,
  recorder: Recorder,
  record: Record<string, unknown>,
): Promise<string> {
  await mkdir(instance.evidence, { recursive: true });
  const redacted = recorder.redact(record);
  const serialized = `${JSON.stringify(redacted, null, 2)}\n`;
  const content =
    recorder.leaks(serialized) > 0
      ? `${JSON.stringify({ command, withheld: 'a secret survived redaction, so the record was not written' }, null, 2)}\n`
      : serialized;
  for (;;) {
    const numbers = (await readdir(instance.evidence)).map((name) =>
      Number(/^(\d+)-/.exec(name)?.[1] ?? 0),
    );
    const next = String(Math.max(0, ...numbers) + 1).padStart(3, '0');
    const file = join(instance.evidence, `${next}-${command}.json`);
    try {
      await writeFile(file, content, { flag: 'wx', mode: 0o600 });
      return file;
    } catch (error) {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'EEXIST')
      )
        throw error;
    }
  }
}
