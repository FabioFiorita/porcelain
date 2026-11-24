import { Schema } from 'effect';
import { spawnSync } from 'node:child_process';
import { globSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ceilingsPath = 'architecture/duplicate-ceilings.json';
const ceilingsSchema = Schema.fromJsonString(
  Schema.Struct({
    server: Schema.Natural,
    tooling: Schema.Natural,
  }),
);
type DuplicateComparison = {
  base: string;
  ceilings: Partial<typeof ceilingsSchema.Type>;
};
const decodeCeilings = Schema.decodeUnknownSync(ceilingsSchema);
const ceilings = decodeCeilings(readFileSync(join(root, ceilingsPath), 'utf8'));
const ignoredSpecs = ['**/*.spec.ts', '**/*.spec.tsx'];

function git(from: string, args: readonly string[]) {
  const result = spawnSync('git', args, { cwd: from, encoding: 'utf8' });
  if (result.error) throw result.error;
  return result;
}

export function duplicateComparison(
  from: string,
  requested = process.env.DIFF_BASE,
): DuplicateComparison | undefined {
  const result =
    requested && /^[a-f0-9]{40}$/.test(requested)
      ? git(from, ['rev-parse', '--verify', `${requested}^{commit}`])
      : git(from, ['merge-base', 'HEAD', 'origin/main']);
  if (result.status !== 0) return undefined;
  const base = result.stdout.trim();
  if (!/^[a-f0-9]{40}$/.test(base)) return undefined;
  const legacyPath = 'architecture/duplicate-policy.ts';
  const listed = git(from, [
    'ls-tree',
    '--name-only',
    base,
    '--',
    ceilingsPath,
    legacyPath,
  ]);
  if (listed.status !== 0) throw new Error(listed.stderr);
  const paths = listed.stdout.trim().split('\n');
  if (!paths.includes(ceilingsPath)) {
    if (!paths.includes(legacyPath)) return { base, ceilings: {} };
    const legacy = git(from, ['show', `${base}:${legacyPath}`]);
    if (legacy.status !== 0) throw new Error(legacy.stderr);
    const server =
      /function serverDuplicateScope\(\) \{[\s\S]*?ceiling: (\d+),/.exec(
        legacy.stdout,
      )?.[1];
    return {
      base,
      ceilings: server === undefined ? {} : { server: Number(server) },
    };
  }
  const previous = git(from, ['show', `${base}:${ceilingsPath}`]);
  if (previous.status !== 0) throw new Error(previous.stderr);
  return { base, ceilings: decodeCeilings(previous.stdout) };
}

export function raisedDuplicateCeiling(
  scope: { name: string; ceiling: number },
  comparison: ReturnType<typeof duplicateComparison>,
) {
  const previous = comparison?.ceilings;
  if (!previous || (scope.name !== 'server' && scope.name !== 'tooling'))
    return undefined;
  const limit = previous[scope.name];
  return limit !== undefined && scope.ceiling > limit ? limit : undefined;
}
const sourceLocationSchema = Schema.Struct({
  name: Schema.String,
  start: Schema.Finite,
  end: Schema.Finite,
});
const cloneSchema = Schema.Struct({
  lines: Schema.Finite,
  firstFile: sourceLocationSchema,
  secondFile: sourceLocationSchema,
});
const reportSchema = Schema.Struct({
  duplicates: Schema.Array(cloneSchema),
  statistics: Schema.Struct({
    total: Schema.Struct({
      clones: Schema.Finite,
      duplicatedLines: Schema.Finite,
      percentage: Schema.Finite,
    }),
  }),
});

export function clonesChangedSince(
  from: string,
  base: string,
  clones: readonly (typeof cloneSchema.Type)[],
) {
  const fragments = new Map<
    string,
    readonly { start: number; end: number }[]
  >();
  function changed(source: typeof sourceLocationSchema.Type) {
    const path = relative(from, source.name);
    if (!fragments.has(path)) {
      const tracked = git(from, ['ls-files', '--error-unmatch', '--', path]);
      if (tracked.status !== 0) return true;
      const diff = git(from, [
        'diff',
        '--no-renames',
        '--no-ext-diff',
        '--text',
        '--unified=0',
        base,
        '--',
        path,
      ]);
      if (diff.status !== 0) throw new Error(diff.stderr);
      fragments.set(
        path,
        [
          ...diff.stdout.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm),
        ].map(([, line, length]) => {
          const start = Number(line);
          return { start, end: start + Math.max(0, Number(length ?? 1) - 1) };
        }),
      );
    }
    return fragments
      .get(path)
      ?.some(({ start, end }) => start <= source.end && end >= source.start);
  }
  return clones.filter(
    ({ firstFile, secondFile }) => changed(firstFile) || changed(secondFile),
  );
}
export function duplicateScope() {
  return {
    name: 'client',
    sources: ['apps/web/src', 'apps/mobile/src', 'packages/client/src'],
    metric: 'clones' as const,
    ceiling: 0,
    why: 'Keep shared client logic and specs in one owner so fixes cannot drift between apps.',
  };
}
export function serverDuplicateScope() {
  return {
    name: 'server',
    sources: [
      'apps/server/src',
      ...[
        'access',
        'agents',
        'changes',
        'contracts',
        'effects',
        'files',
        'git',
        'git-actions',
        'kernel',
        'process',
        'projects',
        'reviews',
        'storage',
        'walkthroughs',
      ].map((name) => `packages/${name}/src`),
    ],
    metric: 'clones' as const,
    ceiling: ceilings.server,
    ignored: ignoredSpecs,
    why: 'Share server behavior at its source and keep independent contracts and platform boundaries explicit.',
  };
}
const toolingDuplicateDirectories = [
  'ci',
  'architecture',
  'scripts',
  '.agents/skills/*/scripts',
  '.agents/skills/verify-core',
  'apps/server/spec/kit',
  'apps/web/spec/kit',
  'packages/*/spec/kit',
] as const;

export function toolingDuplicateScope(from: string) {
  return {
    name: 'tooling',
    sources: globSync([...toolingDuplicateDirectories], { cwd: from }).sort(),
    metric: 'clones' as const,
    ceiling: ceilings.tooling,
    ignored: ignoredSpecs,
    formats: 'typescript,tsx,javascript,bash',
    formatNames: 'bash:cli',
    why: 'Keep CI, architecture and verification helpers in one owner so their behavior cannot drift.',
  };
}
export function scanDuplicates(
  from: string,
  scope: {
    sources: readonly string[];
    metric: 'clones' | 'duplicatedLines';
    ceiling: number;
    ignored?: readonly string[];
    formats?: string;
    formatNames?: string;
  },
) {
  const scratch = mkdtempSync(join(tmpdir(), 'porcelain-duplicates-'));
  try {
    const result = spawnSync(
      join(root, 'node_modules/.bin/jscpd'),
      [
        '--format',
        scope.formats ?? 'typescript,tsx',
        ...(scope.formatNames ? ['--formats-names', scope.formatNames] : []),
        '--min-tokens',
        '50',
        '--min-lines',
        '5',
        '--mode',
        'mild',
        '--ignore',
        [
          '**/apps/web/src/components/ui/**',
          '**/routeTree.gen.ts',
          '**/node_modules/**',
          ...(scope.ignored ?? []),
        ].join(','),
        '--absolute',
        '--no-colors',
        '--reporters',
        'json',
        '--output',
        scratch,
        ...scope.sources,
      ],
      { cwd: from, encoding: 'utf8' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`jscpd failed:\n${result.stdout}${result.stderr}`);
    const report = Schema.decodeUnknownSync(reportSchema)(
      JSON.parse(readFileSync(join(scratch, 'jscpd-report.json'), 'utf8')),
    );
    const count = report.statistics.total[scope.metric];
    return {
      ...report,
      count,
      exceeded: count > scope.ceiling,
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
