import { Schema } from 'effect';
import { minimatch } from 'minimatch';
import { execFileSync, spawnSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import { runtimeHarnessInput } from './runtime-plan.ts';

const staticTasks = [
  'typecheck',
  'lint:server',
  'lint:web',
  'format:server:check',
  'format:web:check',
  'arch:check',
  'mobile:react-compiler',
  'test:rules',
  'knip',
  'features:check',
  'build:marketing',
];
const suites = {
  static: staticTasks,
  unit: ['test'],
};

type Suite = keyof typeof suites;
type Workspace = {
  folder: string;
  name: string;
  scripts: Record<string, string>;
  dependencies: readonly string[];
};
const workspaceConfig = Schema.Struct({
  packages: Schema.Array(Schema.String),
});
const scriptMap = Schema.optional(Schema.Record(Schema.String, Schema.String));
const manifestConfig = Schema.fromJsonString(
  Schema.Struct({
    name: Schema.String,
    scripts: scriptMap,
    dependencies: scriptMap,
    devDependencies: scriptMap,
    optionalDependencies: scriptMap,
    peerDependencies: scriptMap,
  }),
);

const git = (args: string[], cwd: string) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 ** 2,
  });
const matches = (path: string, patterns: readonly string[]) =>
  patterns.some((pattern) => minimatch(path, pattern, { dot: true }));
const verification = '.agents/skills';
const web = 'apps/web';
const testFile = /\.(?:spec|test|e2e|integration)\.tsx?$/;

function workspaces(root: string): Workspace[] {
  const workspace = Schema.decodeUnknownSync(workspaceConfig)(
    parse(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')),
  );
  return [
    'package.json',
    ...globSync(
      workspace.packages.map((path) => `${path}/package.json`),
      { cwd: root },
    ),
  ]
    .sort()
    .map((path) => {
      const manifest = Schema.decodeUnknownSync(manifestConfig)(
        readFileSync(join(root, path), 'utf8'),
      );
      return {
        folder: dirname(path),
        name: manifest.name,
        scripts: manifest.scripts ?? {},
        dependencies: [
          ...Object.keys(manifest.dependencies ?? {}),
          ...Object.keys(manifest.devDependencies ?? {}),
          ...Object.keys(manifest.optionalDependencies ?? {}),
          ...Object.keys(manifest.peerDependencies ?? {}),
        ],
      };
    });
}

function affectsDependents(path: string, workspace: Workspace): boolean {
  if (workspace.folder === verification)
    return (
      matches(path, ['*/scripts/**', 'verify-core/**', 'package.json']) &&
      !testFile.test(path)
    );
  return (
    !testFile.test(path) &&
    !path.startsWith('spec/integration/') &&
    !path.startsWith('spec/e2e/') &&
    (workspace.folder !== web || !path.startsWith('spec/'))
  );
}

export const nodeTaskInputs = {
  'test:rules': [
    'architecture/**',
    'ci/**',
    '.github/workflows/agent-review.yml',
    'scripts/{style,architecture,feature-maps,feature-api-routes,react-compiler}.ts',
    '**/tsconfig*.json',
    'apps/mobile/babel.config.js',
    'apps/server/spec/kit/route-coverage.ts',
    'apps/server/src/{ports,runtime}/**',
    'packages/{access,changes,files,git-actions,projects,reviews}/src/errors/**',
    'packages/{contracts,agents,kernel}/src/**',
    'packages/process/**',
    'packages/storage/spec/kit/{native-database,repository-queries}.ts',
    'packages/storage/scripts/native-migration-history.ts',
    'packages/git/src/shared/errors/**',
    'packages/effects/src/worktree-lease.ts',
    'packages/{changes,projects}/src/models/**',
    'packages/reviews/src/{models,ports,rules,services}/**',
    'packages/client/src/features/{access,projects}/store.ts',
    'packages/client/src/features/{access,git-actions}/store/**',
    'packages/client/src/features/{access,git-actions,live,projects}/ports/**',
    'packages/client/src/features/{access/rules,persistence}/**',
    'packages/client/src/shared/api/**',
  ],
  'mobile:react-compiler': [
    'apps/mobile/src/**',
    'apps/mobile/babel.config.js',
    'scripts/react-compiler.ts',
  ],
} as const;

function rootInput(task: string, path: string): boolean {
  switch (task) {
    case 'test:rules':
      return (
        runtimeHarnessInput(path) ||
        (matches(path, nodeTaskInputs[task]) &&
          (!path.startsWith('packages/') || !testFile.test(path)))
      );
    case 'mobile:react-compiler':
      return matches(path, nodeTaskInputs[task]);
    case 'build:marketing':
      return matches(path, [
        'apps/marketing/**',
        'packages/{client,contracts,theme}/src/**',
        'apps/web/public/icon-512.png',
      ]);
    default:
      return true;
  }
}

function packageInput(
  task: string,
  workspace: Workspace,
  path: string,
): boolean {
  const folder = workspace.folder;
  if (task === 'typecheck' && path === 'tsconfig.json') return true;
  if (task === 'test' && path === 'vitest.config.ts') return true;
  if (
    folder === 'apps/desktop' &&
    task === 'test' &&
    matches(path, [
      'scripts/desktop-*.ts',
      'scripts/collect-desktop-crashes.sh',
    ])
  )
    return true;
  if (folder === verification && path.startsWith('apps/web/spec/kit/'))
    return true;
  return path.startsWith(`${folder}/`);
}

export function checkPlan(
  suite: Suite,
  changed: readonly string[] | undefined,
  root = '.',
) {
  const packages = workspaces(root);
  const all =
    changed === undefined ||
    changed.some((path) =>
      matches(path, [
        '**/package.json',
        'pnpm-{workspace,lock}.yaml',
        'vite.config.ts',
        'ci/check-plan.ts',
        'architecture/duplicate-policy.ts',
        'architecture/duplicate-ceilings.json',
        '.github/workflows/ci.yml',
      ]),
    );
  const affected = new Set<string>();
  for (const workspace of packages) {
    if (workspace.folder === '.') continue;
    const prefix = `${workspace.folder}/`;
    if (
      changed?.some(
        (path) =>
          path.startsWith(prefix) &&
          affectsDependents(path.slice(prefix.length), workspace),
      )
    )
      affected.add(workspace.name);
  }
  for (let size = -1; size !== affected.size;) {
    size = affected.size;
    for (const workspace of packages)
      if (workspace.dependencies.some((name) => affected.has(name)))
        affected.add(workspace.name);
  }

  const sharedContract = changed?.some(
    (path) =>
      path.startsWith('packages/contracts/src/') && !testFile.test(path),
  );
  return suites[suite]
    .map((task) => ({
      task,
      packages: packages
        .filter((workspace) => {
          if (workspace.scripts[task] === undefined) return false;
          if (workspace.folder === '.') {
            if (suite === 'unit') return false;
            return (
              all ||
              sharedContract ||
              (task === 'test:rules' && affected.has('@porcelain/storage')) ||
              changed?.some((path) => rootInput(task, path))
            );
          }
          if (
            all ||
            sharedContract ||
            changed?.some((path) => packageInput(task, workspace, path))
          )
            return true;
          return workspace.dependencies.some((name) => affected.has(name));
        })
        .map(({ folder, name }) => ({
          name,
          id: `${folder === '.' ? '//' : name}#${task}`,
        })),
    }))
    .filter(({ packages }) => packages.length > 0);
}

function comparison(root: string, base: string | undefined, head: string) {
  if (!base) return undefined;
  try {
    return git(
      ['diff', '--no-renames', '--name-only', '-z', base, head, '--'],
      root,
    )
      .split('\0')
      .filter(Boolean);
  } catch {
    process.stderr.write(
      'Could not read the comparison commits. Running the full check plan.\n',
    );
    return undefined;
  }
}

if (import.meta.main) {
  const {
    positionals: [suite],
    values,
  } = parseArgs({
    allowPositionals: true,
    options: {
      ci: { type: 'boolean' },
      list: { type: 'boolean' },
      base: { type: 'string' },
      head: { type: 'string' },
    },
  });
  if (suite !== 'static' && suite !== 'unit')
    throw new Error('Usage: node ci/check-plan.ts static|unit [--ci] [--list]');
  const root = process.cwd();
  const base =
    values.base ??
    (values.ci && process.env.RELEASE_LANE !== 'true'
      ? process.env.DIFF_BASE
      : undefined);
  const head = values.head ?? 'HEAD';
  for (const ref of [base, head]) {
    if (ref !== undefined && ref !== 'HEAD' && !/^[0-9a-f]{40}$/.test(ref))
      throw new Error('Check comparisons require a full commit SHA or HEAD');
  }
  const plan = checkPlan(suite, comparison(root, base, head), root);
  if (values.list) {
    console.log(
      JSON.stringify(
        plan.flatMap(({ packages }) => packages.map(({ id }) => id)).sort(),
        null,
        2,
      ),
    );
  } else {
    for (const { task, packages } of plan) {
      const result = spawnSync(
        'vp',
        [
          'run',
          '--fail-if-no-match',
          '--concurrency-limit',
          suite === 'static' ? '2' : '1',
          ...packages.flatMap(({ name }) => ['--filter', name]),
          task,
        ],
        { stdio: 'inherit' },
      );
      if (result.error) throw result.error;
      if (result.status !== 0) process.exitCode = 1;
    }
  }
}
