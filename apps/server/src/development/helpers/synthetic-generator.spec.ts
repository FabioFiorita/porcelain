import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readlink,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { promisify } from 'node:util';
import { crc32, inflateSync } from 'node:zlib';
import { createIsolatedGit } from '@porcelain/git/fixtures/isolated-git';
import { describe, expect, it, onTestFinished } from 'vitest';
import { playgroundProfiles, type SyntheticShape } from '../profiles.ts';
import {
  ballastEntries,
  ensureSyntheticBase,
  extractBallast,
  generatorVersion,
  writeArchive,
  writeBallast,
} from './synthetic-base.ts';
import {
  createRandom,
  type FileKind,
  renderBinary,
  renderBlock,
  renderPng,
  renderText,
  type TextKind,
} from './synthetic-content.ts';
import { planRepository } from './synthetic-plan.ts';

const quantile = (values: number[], share: number) =>
  [...values].sort((left, right) => left - right)[
    Math.floor(share * values.length)
  ] as number;

function measure(shape: SyntheticShape) {
  const plan = planRepository(shape);
  const files = plan.files.slice(0, plan.finalFiles);
  const directories = new Set<string>();
  for (const { path } of files)
    for (let at = path.indexOf('/'); at > 0; at = path.indexOf('/', at + 1))
      directories.add(path.slice(0, at));
  const depths = files.map(({ path }) => path.split('/').length - 1);
  const sizes = files.map(({ bytes }) => bytes);
  return {
    plan,
    files,
    directories: directories.size,
    depth: { median: quantile(depths, 0.5), max: Math.max(...depths) },
    size: { median: quantile(sizes, 0.5), p90: quantile(sizes, 0.9) },
    over100k: sizes.filter((bytes) => bytes > 100_000).length,
    over1m: sizes.filter((bytes) => bytes > 1_000_000).length,
    manifests: files.filter(({ path }) => /(^|\/)package\.json$/.test(path))
      .length,
    binaries: files.filter(({ kind }) => kind === 'png' || kind === 'woff2')
      .length,
  };
}

describe('Synthetic repository plans', () => {
  it.each(['app', 'monorepo'] as const)(
    'gives the %s profile the aggregate shape of real repositories',
    (name) => {
      const shape = playgroundProfiles[name].synthetic as SyntheticShape;
      const result = measure(shape);
      expect(result.files).toHaveLength(shape.files);
      expect(new Set(result.files.map(({ path }) => path)).size).toBe(
        shape.files,
      );
      expect(
        Math.abs(result.directories - shape.directories) / shape.directories,
      ).toBeLessThan(0.05);
      expect(result.depth.median).toBeGreaterThanOrEqual(
        Math.floor(shape.medianDepth) - 1,
      );
      expect(result.depth.median).toBeLessThanOrEqual(
        Math.ceil(shape.medianDepth),
      );
      expect(result.depth.max).toBe(shape.maxDepth);
      expect(result.size.median / shape.medianFileBytes).toBeCloseTo(1, 0);
      expect(result.size.p90 / shape.p90FileBytes).toBeCloseTo(1, 0);
      expect(result.over100k).toBeGreaterThanOrEqual(shape.largeFiles);
      expect(result.over1m).toBe(
        shape.multiMegabyteFiles + (shape.lockfileBytes > 1_000_000 ? 1 : 0),
      );
      expect(result.manifests).toBe(shape.packages);
      expect(result.binaries).toBe(shape.binaryFiles);
      // Story paths at the root stay free for the Fieldnotes files.
      expect(
        result.plan.files.filter(({ path }) =>
          /^(README\.md|docs\/|src\/|data\/|tests\/|assets\/)/.test(path),
        ),
      ).toEqual([]);
    },
  );

  it('plans deterministically and keeps churn out of the final tree', () => {
    const shape = playgroundProfiles.app.synthetic as SyntheticShape;
    expect(planRepository(shape)).toEqual(planRepository(shape));
    const { plan } = measure(shape);
    const final = new Set(
      plan.files.slice(0, plan.finalFiles).map(({ path }) => path),
    );
    const transient = plan.files.slice(plan.finalFiles);
    expect(transient.length).toBeGreaterThan(0);
    for (const file of transient) {
      expect(final.has(file.path)).toBe(false);
      expect(file.removed).toBeGreaterThan(file.added);
    }
    const renamed = plan.files.filter((file) => file.renamedFrom);
    expect(renamed.length).toBeGreaterThan(0);
    for (const file of renamed) {
      expect(final.has(file.renamedFrom as string)).toBe(false);
      expect(file.renamed).toBeGreaterThan(file.added);
    }
  });
});

describe('Generator version', () => {
  it('changes generated history and ballast only together with generatorVersion', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-golden-'));
    onTestFinished(() => rm(root, { recursive: true, force: true }));
    const bin = await createIsolatedGit(root);
    const environment = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !/^(GIT_|SSH_)/.test(key),
        ),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      PATH: `${bin}:${process.env.PATH}`,
    };
    // No images: their bytes depend on the zlib build, not on this generator.
    const shape: SyntheticShape = {
      ...(playgroundProfiles.app.synthetic as SyntheticShape),
      files: 80,
      directories: 30,
      packages: 4,
      binaryFiles: 0,
      multiMegabyteFiles: 0,
      largeFiles: 1,
      lockfileBytes: 30_000,
      commits: 60,
      largeCommits: 1,
      lockfileUpdates: 2,
      remoteBranches: 3,
      ignoredFiles: 300,
    };
    const base = await ensureSyntheticBase({
      cacheRoot: join(root, 'cache'),
      name: 'golden',
      shape,
      environment,
    });
    const { stdout: history } = await promisify(execFile)(
      'git',
      [
        '-C',
        base.remote,
        'log',
        '--all',
        '--topo-order',
        '--format=%T %P %an %s',
      ],
      { env: environment },
    );
    const digest = createHash('sha256')
      .update(history.replaceAll(/ [0-9a-f]{40}/g, ' parent'))
      .update(JSON.stringify(base.manifest.files))
      .update(
        JSON.stringify([
          ...ballastEntries(base.manifest, shape.ignoredFiles, shape.seed),
        ]),
      )
      .digest('hex')
      .slice(0, 16);
    // A new digest means generated content changed: bump generatorVersion with it.
    expect({ generatorVersion, digest }).toEqual({
      generatorVersion: 3,
      digest: '94c0442226266e60',
    });
  });
});

describe('Synthetic content', () => {
  it('renders valid PNG images for binary files', () => {
    const image = renderPng(3, 1, 3_000);
    expect(image.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    const chunks: { type: string; data: Buffer }[] = [];
    for (let at = 8; at < image.length; ) {
      const length = image.readUInt32BE(at);
      const type = image.toString('latin1', at + 4, at + 8);
      const data = image.subarray(at + 8, at + 8 + length);
      expect(image.readUInt32BE(at + 8 + length)).toBe(
        crc32(image.subarray(at + 4, at + 8 + length)),
      );
      chunks.push({ type, data });
      at += length + 12;
    }
    expect(chunks.map(({ type }) => type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    const side = chunks[0]?.data.readUInt32BE(0) as number;
    expect(inflateSync(chunks[1]?.data as Buffer)).toHaveLength(
      side * (side * 3 + 1),
    );
    expect(renderPng(3, 2, 3_000)).not.toEqual(image);
    const font = renderBinary(
      { path: 'fonts/inter.woff2', kind: 'woff2', bytes: 101, seed: 1 },
      0,
    );
    expect(font.subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(font).toHaveLength(101);
    expect(() =>
      renderText({ path: 'logo.png', kind: 'png', bytes: 10, seed: 1 }, 0),
    ).toThrow('Binary content');
  });

  it('revises text in small, reviewable steps', () => {
    const subject = {
      path: 'packages/billing/src/invoice-table.ts',
      kind: 'ts' as const,
      bytes: 6_000,
      seed: 42,
    };
    const first = renderText(subject, 3);
    expect(renderText(subject, 3)).toBe(first);
    const lines = new Set(first.split('\n'));
    const next = renderText(subject, 4).split('\n');
    expect(
      next.filter((line) => lines.has(line)).length / next.length,
    ).toBeGreaterThan(0.5);
    expect(next.join('\n')).not.toBe(first);
    expect(Math.abs(first.length - subject.bytes) / subject.bytes).toBeLessThan(
      0.3,
    );
    for (const [path, kind] of [
      ['packages/ui/package.json', 'package'],
      ['packages/ui/tsconfig.json', 'tsconfig'],
      ['tsconfig.base.json', 'tsconfig'],
      ['packages/ui/fixtures/data.json', 'json'],
    ] as const)
      expect(() =>
        JSON.parse(renderText({ path, kind, bytes: 2_000, seed: 5 }, 7)),
      ).not.toThrow();
    expect(
      renderText(
        { path: 'pnpm-workspace.yaml', kind: 'yaml', bytes: 10, seed: 1 },
        0,
      ),
    ).toContain("'packages/*'");
    expect(
      renderText(
        { path: 'apps/web/.gitignore', kind: 'ignore', bytes: 10, seed: 1 },
        0,
      ),
    ).toContain('dist/');
  });
});

describe('Synthetic text kinds', () => {
  it.each([
    'ts',
    'tsx',
    'test',
    'js',
    'md',
    'css',
    'yaml',
    'workflow',
    'sql',
    'snap',
    'svg',
    'graphql',
    'sh',
    'html',
    'lock',
  ] satisfies FileKind[])(
    'renders %s files with revisions and fresh blocks',
    (kind) => {
      const subject = {
        path: `packages/ui/src/report-${kind}.file`,
        kind,
        bytes: 3_000,
        seed: 11,
      };
      const initial = renderText(subject, 0);
      expect(initial.length).toBeGreaterThan(500);
      expect(renderText(subject, 12)).not.toBe(initial);
      expect(
        renderBlock(kind as TextKind, createRandom(1), subject.path),
      ).not.toBe('');
    },
  );

  it('keeps generated configuration parseable when edited', () => {
    expect(() =>
      JSON.parse(
        `[${renderBlock('package', createRandom(2), 'package.json')}]`,
      ),
    ).not.toThrow();
    expect(renderBlock('ignore', createRandom(2), '.gitignore')).toMatch(
      /\/\n$/,
    );
  });
});

describe('Dependency ballast', () => {
  it('unpacks long pnpm paths and relative symlinks with the native tar', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'porcelain-ballast-'));
    onTestFinished(() => rm(directory, { recursive: true, force: true }));
    const root = `packages/${'shared-'.repeat(12)}design-system`;
    const packages = [
      { root, name: 'design-system', ignoresBuildOutput: true },
    ];
    const archive = join(directory, 'ballast.tar');
    await writeBallast(archive, packages, 3_000, 4, 1_700_000_000);
    const worktree = join(directory, 'worktree');
    await mkdir(join(worktree, root), { recursive: true });
    await extractBallast(archive, worktree);
    const entries = [...ballastEntries({ packages }, 3_000, 4)];
    const longest = entries.reduce((left, right) =>
      right.path.length > left.path.length ? right : left,
    );
    expect(longest.path.length).toBeGreaterThan(100);
    expect(
      (await lstat(join(worktree, longest.path))).isFile() ||
        (await lstat(join(worktree, longest.path))).isSymbolicLink(),
    ).toBe(true);
    const links = entries.filter((entry) => entry.link);
    expect(links.some((entry) => entry.path.startsWith(root))).toBe(true);
    for (const link of links) {
      expect(await readlink(join(worktree, link.path))).toBe(link.link);
      expect((await stat(join(worktree, link.path))).isDirectory()).toBe(true);
    }
    const count = async (path: string): Promise<number> => {
      let total = 0;
      for (const entry of await readdir(path, { withFileTypes: true }))
        total += entry.isDirectory() ? await count(join(path, entry.name)) : 1;
      return total;
    };
    expect(await count(worktree)).toBe(3_000);
    await expect(
      extractBallast(join(directory, 'missing.tar'), worktree),
    ).rejects.toThrow('Could not unpack dependency ballast');
  });

  it('keeps every monorepo dependency link intact, including targets beyond ustar limits', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'porcelain-links-'));
    onTestFinished(() => rm(directory, { recursive: true, force: true }));
    const shape = playgroundProfiles.monorepo.synthetic as SyntheticShape;
    const { packages } = planRepository(shape);
    const entries = [
      ...ballastEntries({ packages }, shape.ignoredFiles, shape.seed),
    ];
    expect(entries).toHaveLength(shape.ignoredFiles);
    const installed = new Set(
      entries.map(({ path }) => path.split('/').slice(0, 5).join('/')),
    );
    const links = entries.filter((entry) => entry.link);
    for (const { path, link } of links) {
      const target = posix.join(posix.dirname(path), link as string);
      expect(
        installed.has(target) ||
          installed.has(target.split('/').slice(0, 5).join('/')),
      ).toBe(true);
    }
    const long = {
      path: `node_modules/${'deeply-nested/'.repeat(20)}tool`,
      link: `../${'x'.repeat(120)}`,
    };
    expect(links.some((entry) => (entry.link?.length ?? 0) > 100)).toBe(true);
    const archive = join(directory, 'links.tar');
    await writeArchive(archive, [...links, long], 1_700_000_000);
    await mkdir(join(directory, 'worktree'));
    await extractBallast(archive, join(directory, 'worktree'));
    for (const entry of [...links, long])
      expect(await readlink(join(directory, 'worktree', entry.path))).toBe(
        entry.link,
      );
  });

  it('lays out exactly the requested ignored files like a pnpm install', () => {
    const packages = [
      { root: 'apps/web', name: 'web', ignoresBuildOutput: true },
      { root: 'packages/ui', name: 'ui', ignoresBuildOutput: true },
      { root: 'tools/cli', name: 'cli', ignoresBuildOutput: false },
    ];
    const entries = [...ballastEntries({ packages }, 5_000, 9)];
    expect(entries).toHaveLength(5_000);
    expect(new Set(entries.map(({ path }) => path)).size).toBe(5_000);
    const stores = new Set(
      entries
        .filter(({ path }) => path.startsWith('node_modules/.pnpm/'))
        .map(({ path }) => path.split('/').slice(0, 5).join('/')),
    );
    for (const entry of entries) {
      expect(entry.path).toMatch(
        /^(node_modules\/|apps\/web\/(node_modules|dist)\/|packages\/ui\/(node_modules|dist)\/|tools\/cli\/node_modules\/)/,
      );
      if (entry.link) {
        const target = posix.normalize(
          posix.join(posix.dirname(entry.path), entry.link),
        );
        expect(target).toMatch(/^node_modules\/\.pnpm\//);
        expect(
          [...stores].some((store) =>
            target.startsWith(store.replace(/\/[^/]+$/, '')),
          ),
        ).toBe(true);
      }
    }
    expect(entries.some(({ path }) => path.startsWith('tools/cli/dist/'))).toBe(
      false,
    );
    expect(
      entries.find(({ path }) => path.endsWith('/package.json'))?.content,
    ).toMatch(/"version":"1\.0\.0"/);
    expect([...ballastEntries({ packages }, 0, 9)]).toEqual([]);
  });
});
