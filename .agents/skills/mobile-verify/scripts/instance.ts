import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { Recorder } from '../../../../apps/server/spec/kit/isolated-server.ts';
import {
  buildCommand,
  nativeFingerprint,
  repositoryRoot,
} from '../../../../apps/mobile/spec/kit/development-client.ts';

export class Refusal extends Error {}

export const home = join(
  tmpdir(),
  'porcelain-mobile-verify',
  createHash('sha256').update(repositoryRoot).digest('hex').slice(0, 12),
);
export const instances = join(home, 'instances');

export const instanceSchema = z.object({
  id: z.string(),
  pid: z.number(),
  kind: z.enum(['iphone', 'ipad']),
  udid: z.string(),
  simulator: z.string(),
  session: z.string(),
  metro: z.string(),
  server: z.string(),
  manifest: z.string(),
  repository: z.string(),
  evidence: z.string(),
  secrets: z.array(z.string()),
  fingerprints: z.object({
    server: z.string(),
    native: z.string(),
    script: z.string(),
  }),
  startedAt: z.string(),
  lastCommandAt: z.number(),
  commands: z.number(),
});

export type Instance = z.output<typeof instanceSchema>;

const serverRoots = [
  'apps/server/src',
  'apps/server/spec/kit',
  'packages/storage/drizzle',
];
const scriptRoots = [
  'apps/mobile/src',
  'packages/client/src',
  'packages/theme',
];
const skipped = new Set(['node_modules', 'dist', '.turbo']);
const pairingFragment = /([#&?]c=)[^&\s"']+/g;

function filesOf(path: string): string[] {
  const absolute = join(repositoryRoot, path);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [path];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    skipped.has(entry.name) ? [] : filesOf(join(path, entry.name)),
  );
}

function hashOf(roots: readonly string[]): string {
  const hash = createHash('sha256');
  for (const file of roots.flatMap(filesOf).toSorted()) {
    const { size, mtimeMs } = statSync(join(repositoryRoot, file));
    hash.update(`${file}\0${size}\0${mtimeMs}\n`);
  }
  return hash.digest('hex');
}

function serverPackages(): string[] {
  return readdirSync(join(repositoryRoot, 'packages'), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== 'client' &&
        entry.name !== 'theme',
    )
    .map((entry) => join('packages', entry.name, 'src'));
}

export function fingerprints(): Instance['fingerprints'] {
  return {
    server: hashOf([...serverRoots, ...serverPackages()]),
    native: nativeFingerprint(),
    script: hashOf(scriptRoots),
  };
}

export function staleness(instance: Instance): string | undefined {
  const now = fingerprints();
  if (now.native !== instance.fingerprints.native)
    return `Native code changed since instance ${instance.id} started; a JavaScript change refreshes through Metro, but this one needs a native rebuild. Run stop, ${buildCommand}, then start again.`;
  if (now.server !== instance.fingerprints.server)
    return `Server code changed since instance ${instance.id} started; run stop and start again so the evidence shows the server you changed.`;
  return undefined;
}

export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function instanceFile(id: string): string {
  return join(instances, `${id}.json`);
}

export function saveInstance(instance: Instance): void {
  mkdirSync(instances, { recursive: true, mode: 0o700 });
  writeFileSync(
    instanceFile(instance.id),
    `${JSON.stringify(instance, null, 2)}\n`,
    { mode: 0o600 },
  );
}

export function liveInstances(): Instance[] {
  if (!existsSync(instances)) return [];
  return readdirSync(instances)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => {
      const parsed = instanceSchema.safeParse(
        JSON.parse(readFileSync(join(instances, file), 'utf8')),
      );
      return parsed.success && alive(parsed.data.pid) ? [parsed.data] : [];
    });
}

export function chosen(id: string | undefined): Instance {
  const live = liveInstances();
  const listing = live
    .map(
      (instance) =>
        `  ${instance.id}  ${instance.kind}  ${instance.simulator}  started ${instance.startedAt}`,
    )
    .join('\n');
  if (id !== undefined) {
    const named = live.find((instance) => instance.id === id);
    if (named === undefined)
      throw new Refusal(
        `No live instance is named ${id}${listing ? `; live:\n${listing}` : '; run start'}`,
      );
    return named;
  }
  const [only, ...others] = live;
  if (only === undefined)
    throw new Refusal('No live instance in this checkout; run start first.');
  if (others.length > 0)
    throw new Refusal(
      `${live.length} instances are live in this checkout; name one with --instance <id>:\n${listing}`,
    );
  return only;
}

export function scrubber(secrets: readonly string[]): (text: string) => string {
  const recorder = new Recorder();
  for (const secret of secrets) recorder.secret(secret);
  return (text) => {
    recorder.harvestText(text);
    return recorder
      .scrub(text)
      .replace(
        pairingFragment,
        (_match, prefix: string) => `${prefix}[redacted]`,
      );
  };
}

export function nextFile(
  instance: Instance,
  name: string,
  extension: string,
): string {
  return join(
    instance.evidence,
    `${String(instance.commands + 1).padStart(3, '0')}-${name}.${extension}`,
  );
}

export function record(
  instance: Instance,
  name: string,
  args: readonly string[],
  output: string,
): string {
  const scrub = scrubber(instance.secrets);
  const file = nextFile(instance, name, 'txt');
  writeFileSync(file, scrub(`$ cli ${args.join(' ')}\n\n${output}`), {
    mode: 0o600,
  });
  saveInstance({
    ...instance,
    commands: instance.commands + 1,
    lastCommandAt: Date.now(),
  });
  return file;
}
