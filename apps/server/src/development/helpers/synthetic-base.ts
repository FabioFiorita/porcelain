import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { isDeepStrictEqual, promisify } from 'node:util';
import type { SyntheticShape } from '../profiles.ts';
import {
  claimDirectory,
  pruneAbandoned,
  removeTree,
} from './playground-runs.ts';
import {
  createRandom,
  dependencyNames,
  type FileKind,
  mix,
  nouns,
  type Random,
} from './synthetic-content.ts';
import { importSyntheticHistory } from './synthetic-history.ts';
import { planRepository, type WorkspacePackage } from './synthetic-plan.ts';

/** Bump when generated content changes; cached bases are keyed by it. */
export const generatorVersion = 3;

/** Shape fields that change the cached base; change counts apply per run. */
type BaseKey = Omit<SyntheticShape, 'reviewChanges' | 'agentChanges'>;

export type SyntheticManifest = {
  version: number;
  base: BaseKey;
  files: [path: string, bytes: number, kind: FileKind][];
  packages: WorkspacePackage[];
  lockfile: string;
};

type SyntheticBase = {
  remote: string;
  ballast: string;
  manifest: SyntheticManifest;
};

const baseKey = ({
  reviewChanges: _review,
  agentChanges: _agents,
  ...base
}: SyntheticShape): BaseKey => base;

async function readBase(directory: string, shape: SyntheticShape) {
  try {
    const manifest = JSON.parse(
      await readFile(join(directory, 'manifest.json'), 'utf8'),
    ) as SyntheticManifest;
    if (!isDeepStrictEqual(manifest.base, baseKey(shape))) return undefined;
    return {
      remote: join(directory, 'origin.git'),
      ballast: join(directory, 'ballast.tar'),
      manifest,
    };
  } catch {
    return undefined;
  }
}

const baseDirectory = (cacheRoot: string, name: string) =>
  join(cacheRoot, `${name}-v${generatorVersion}`);

/** Whether a run can reuse a cached base instead of generating one. */
export async function hasSyntheticBase(
  cacheRoot: string,
  name: string,
  shape: SyntheticShape,
) {
  return (await readBase(baseDirectory(cacheRoot, name), shape)) !== undefined;
}

/**
 * Best effort: removes builds whose process was killed, bases swapped out by a
 * newer build and bases of other generator versions. Complete bases of this
 * version and builds with a live owner stay.
 */
async function pruneCache(cacheRoot: string) {
  await pruneAbandoned(cacheRoot, (name) => name.includes('.tmp-'));
  const stale = (name: string) => {
    if (name.includes('.old-')) return true;
    const version = /^[a-z0-9-]+-v(\d+)$/.exec(name)?.[1];
    return version !== undefined && Number(version) !== generatorVersion;
  };
  const names = (await readdir(cacheRoot)).filter(stale);
  await Promise.all(names.map((name) => removeTree(join(cacheRoot, name))));
}

/**
 * Returns a cached base repository for the shape, generating it on first use.
 * Builds happen in a private directory that is renamed into place, so parallel
 * runs either reuse a complete base or publish their own.
 */
export async function ensureSyntheticBase(options: {
  cacheRoot: string;
  name: string;
  shape: SyntheticShape;
  environment: NodeJS.ProcessEnv;
  signal?: AbortSignal | undefined;
}): Promise<SyntheticBase> {
  const directory = baseDirectory(options.cacheRoot, options.name);
  await mkdir(options.cacheRoot, { recursive: true });
  await pruneCache(options.cacheRoot).catch(() => {});
  const current = await readBase(directory, options.shape);
  if (current) return current;
  const temporary = await mkdtemp(`${directory}.tmp-`);
  try {
    await claimDirectory(temporary);
    await buildBase(temporary, options);
    try {
      await rename(temporary, directory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOTEMPTY' && code !== 'EEXIST') throw error;
      const winner = await readBase(directory, options.shape);
      if (winner) {
        await removeTree(temporary);
        return winner;
      }
      // An outdated base for the same version: swap it out.
      const outdated = join(
        dirname(directory),
        `${directory.slice(dirname(directory).length + 1)}.old-${randomUUID()}`,
      );
      await rename(directory, outdated);
      await rename(temporary, directory);
      await removeTree(outdated);
    }
    // The owner record stays until the build is published, so a killed build is pruned.
    await rm(join(directory, 'owner.json'), { force: true });
    return (await readBase(directory, options.shape)) as SyntheticBase;
  } catch (error) {
    await removeTree(temporary);
    throw error;
  }
}

async function buildBase(
  directory: string,
  options: {
    shape: SyntheticShape;
    environment: NodeJS.ProcessEnv;
    signal?: AbortSignal | undefined;
  },
) {
  const { shape, environment, signal } = options;
  const git = (...args: string[]) =>
    promisify(execFile)('git', args, {
      env: environment,
      maxBuffer: 64 << 20,
      ...(signal ? { signal } : {}),
    });
  const remote = join(directory, 'origin.git');
  await git('init', '--quiet', '--bare', '-b', 'main', remote);
  const plan = planRepository(shape);
  // The story is committed "now"; synthetic history ends an hour earlier.
  const end = Math.floor(Date.now() / 3_600_000) * 3_600 - 3_600;
  await importSyntheticHistory({
    repository: remote,
    environment,
    plan,
    shape,
    end,
    signal,
  });
  const scratch = (
    await git(
      '-C',
      remote,
      'for-each-ref',
      '--format=%(refname)',
      'refs/playground',
    )
  ).stdout
    .split('\n')
    .filter(Boolean);
  await updateRefs(
    remote,
    scratch.map((ref) => `delete ${ref}`),
    environment,
    signal,
  );
  await writeBallast(
    join(directory, 'ballast.tar'),
    plan.packages,
    shape.ignoredFiles,
    shape.seed,
    end,
  );
  const manifest: SyntheticManifest = {
    version: generatorVersion,
    base: baseKey(shape),
    files: plan.files
      .slice(0, plan.finalFiles)
      .map((file) => [file.path, file.bytes, file.kind]),
    packages: plan.packages,
    lockfile: plan.lockfile,
  };
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
}

async function updateRefs(
  repository: string,
  commands: string[],
  environment: NodeJS.ProcessEnv,
  signal: AbortSignal | undefined,
) {
  if (!commands.length) return;
  const child = spawn('git', ['-C', repository, 'update-ref', '--stdin'], {
    env: environment,
    stdio: ['pipe', 'ignore', 'pipe'],
    ...(signal ? { signal } : {}),
  });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    stderr += chunk;
  });
  child.stdin.on('error', () => {});
  child.stdin.end(`${commands.join('\n')}\n`);
  const [code] = (await once(child, 'close')) as [number | null];
  if (code !== 0) throw new Error(`git update-ref failed: ${stderr.trim()}`);
}

function ustarPath(path: string) {
  if (path.length <= 100) return { name: path, prefix: '' };
  for (
    let slash = path.indexOf('/');
    slash >= 0;
    slash = path.indexOf('/', slash + 1)
  )
    if (slash <= 155 && path.length - slash - 1 <= 100)
      return { name: path.slice(slash + 1), prefix: path.slice(0, slash) };
  return undefined;
}

function tarHeader(
  path: string,
  mtime: number,
  options: { size?: number; link?: string; type?: '0' | '2' | 'x' } = {},
) {
  const header = Buffer.alloc(512);
  const { name, prefix } = ustarPath(path) ?? {
    name: path.slice(-100),
    prefix: '',
  };
  const link = options.link ?? '';
  const octal = (value: number, width: number) =>
    `${value.toString(8).padStart(width - 1, '0')}\0`;
  header.write(name, 0, 100, 'latin1');
  header.write(octal(link ? 0o777 : 0o644, 8), 100, 'latin1');
  header.write(octal(0, 8), 108, 'latin1');
  header.write(octal(0, 8), 116, 'latin1');
  header.write(octal(options.size ?? 0, 12), 124, 'latin1');
  header.write(octal(mtime, 12), 136, 'latin1');
  header.write('        ', 148, 'latin1');
  header.write(options.type ?? (link ? '2' : '0'), 156, 'latin1');
  header.write(link.slice(0, 100), 157, 100, 'latin1');
  header.write('ustar\0' + '00', 257, 'latin1');
  header.write(prefix, 345, 155, 'latin1');
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 'latin1');
  return header;
}

const padded = (data: Buffer) => {
  const block = Buffer.alloc(Math.ceil(data.length / 512) * 512);
  data.copy(block);
  return block;
};

/** POSIX pax record: the length prefix counts the whole record, itself included. */
function paxRecord(key: string, value: string) {
  const body = ` ${key}=${value}\n`;
  let length = body.length + String(body.length).length;
  if (String(length).length > String(body.length).length) length += 1;
  return `${length}${body}`;
}

/** One archive entry; paths and link targets beyond ustar limits use pax records. */
function tarEntry(entry: BallastEntry, mtime: number) {
  const records = [
    ustarPath(entry.path) ? '' : paxRecord('path', entry.path),
    (entry.link?.length ?? 0) > 100
      ? paxRecord('linkpath', entry.link ?? '')
      : '',
  ].join('');
  const content = entry.content
    ? Buffer.from(entry.content, 'latin1')
    : undefined;
  const blocks: Buffer[] = [];
  if (records) {
    const data = Buffer.from(records, 'latin1');
    blocks.push(
      tarHeader('PaxHeader', mtime, { size: data.length, type: 'x' }),
      padded(data),
    );
  }
  blocks.push(
    tarHeader(entry.path, mtime, {
      size: content?.length ?? 0,
      ...(entry.link ? { link: entry.link } : {}),
    }),
  );
  if (content) blocks.push(padded(content));
  return blocks;
}

type BallastEntry = { path: string; link?: string; content?: string };

function split(total: number, parts: number, random: Random) {
  if (parts <= 0) return [];
  const weights = Array.from({ length: parts }, () =>
    Math.exp(random.normal()),
  );
  const sum = weights.reduce((left, right) => left + right, 0);
  const counts = weights.map((weight) => Math.floor((weight / sum) * total));
  let left = total - counts.reduce((a, b) => a + b, 0);
  for (let index = 0; left > 0; index = (index + 1) % parts, left -= 1)
    counts[index] = (counts[index] ?? 0) + 1;
  return counts;
}

/**
 * Dependency installs and build output, laid out like pnpm: a content store
 * under node_modules/.pnpm, top-level and per-package symlinks, and dist folders
 * that only the nested package .gitignore files cover.
 */
export function* ballastEntries(
  plan: { packages: WorkspacePackage[] },
  total: number,
  seed: number,
): Generator<BallastEntry> {
  const random = createRandom(mix(seed, 11));
  const built = plan.packages.filter((entry) => entry.ignoresBuildOutput);
  const distBudget = built.length ? Math.floor(total * 0.08) : 0;
  const linkBudget = Math.min(
    Math.floor(total * 0.04),
    plan.packages.length * 4,
  );
  const rootBudget = total - distBudget - linkBudget;
  // About 64 files and 10 files per directory per package, as in real installs.
  const dependencyCount = Math.max(1, Math.ceil(rootBudget / 64));
  const dependencies: { name: string; store: string }[] = [];
  const names = new Set<string>();
  for (let index = 0; index < dependencyCount; index += 1) {
    let name = '';
    while (!name || names.has(name))
      name =
        index < dependencyNames.length
          ? (dependencyNames[index] as string)
          : random.chance(0.3)
            ? `@${random.pick(nouns)}/${random.pick(dependencyNames)}-${random.pick(nouns)}${names.size}`
            : `${random.pick(dependencyNames)}-${random.pick(nouns)}${names.size}`;
    names.add(name);
    const version = `${random.int(9)}.${random.int(30)}.${random.int(20)}`;
    dependencies.push({
      name,
      store: `node_modules/.pnpm/${name.replace('/', '+')}@${version}/node_modules/${name}`,
    });
  }
  const topLevel = Math.min(dependencyCount, Math.floor(rootBudget * 0.03));
  for (const dependency of dependencies.slice(0, topLevel)) {
    const path = `node_modules/${dependency.name}`;
    yield { path, link: posix.relative(posix.dirname(path), dependency.store) };
  }
  // Every package gets its package.json, so links never dangle.
  const installed = rootBudget - topLevel;
  const perDependency = split(
    Math.max(0, installed - dependencyCount),
    dependencyCount,
    random,
  ).map((count) => count + (installed >= dependencyCount ? 1 : 0));
  const folders = ['dist', 'dist/esm', 'dist/cjs'];
  const files = ['README.md', 'LICENSE', 'index.js', 'index.d.ts'];
  for (const [index, dependency] of dependencies.entries())
    for (let file = 0; file < (perDependency[index] ?? 0); file += 1)
      yield file === 0
        ? {
            path: `${dependency.store}/package.json`,
            content: `{"name":"${dependency.name}","version":"1.0.0","main":"index.js"}\n`,
          }
        : {
            path:
              file <= files.length
                ? `${dependency.store}/${files[file - 1]}`
                : `${dependency.store}/${folders[file % folders.length]}/${random.pick(nouns)}-${file}.${random.pick(['js', 'd.ts', 'js.map', 'mjs'])}`,
          };
  const links = split(linkBudget, plan.packages.length, random);
  for (const [index, entry] of plan.packages.entries())
    for (let link = 0; link < (links[index] ?? 0); link += 1) {
      const dependency = dependencies[
        link % dependencies.length
      ] as (typeof dependencies)[number];
      const path = `${entry.root}/node_modules/${dependency.name}${link < dependencies.length ? '' : `-${link}`}`;
      yield {
        path,
        link: posix.relative(posix.dirname(path), dependency.store),
      };
    }
  const outputs = split(distBudget, built.length, random);
  for (const [index, entry] of built.entries())
    for (let file = 0; file < (outputs[index] ?? 0); file += 1)
      yield {
        path: `${entry.root}/${random.pick(folders)}/${random.pick(nouns)}-${file}.${random.pick(['js', 'd.ts', 'js.map'])}`,
      };
}

function* tarChunks(entries: Iterable<BallastEntry>, mtime: number) {
  let chunks: Buffer[] = [];
  let size = 0;
  for (const entry of entries) {
    for (const block of tarEntry(entry, mtime)) {
      chunks.push(block);
      size += block.length;
    }
    if (size >= 1 << 20) {
      yield Buffer.concat(chunks, size);
      chunks = [];
      size = 0;
    }
  }
  chunks.push(Buffer.alloc(1024));
  yield Buffer.concat(chunks);
}

/** Writes entries as an archive the native tar on Linux and macOS unpacks. */
export async function writeArchive(
  path: string,
  entries: Iterable<BallastEntry>,
  mtime: number,
) {
  await pipeline(
    Readable.from(tarChunks(entries, mtime)),
    createWriteStream(path),
  );
}

/** Writes the ballast once per cached base. */
export async function writeBallast(
  path: string,
  packages: WorkspacePackage[],
  total: number,
  seed: number,
  mtime: number,
) {
  await writeArchive(path, ballastEntries({ packages }, total, seed), mtime);
}

/** Unpacks the cached dependency ballast into a worktree with the native tar. */
export async function extractBallast(
  archive: string,
  worktree: string,
  signal?: AbortSignal,
) {
  const child = spawn('tar', ['-xf', archive, '-C', worktree], {
    stdio: ['ignore', 'ignore', 'pipe'],
    ...(signal ? { signal } : {}),
  });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    if (stderr.length < 2_000) stderr += chunk;
  });
  const [code] = (await once(child, 'close')) as [number | null];
  if (code !== 0)
    throw new Error(
      `Could not unpack dependency ballast: ${stderr.slice(0, 2_000).trim()}`,
    );
}
