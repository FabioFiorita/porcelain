import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { isDeepStrictEqual } from 'node:util';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Generator, getConfig } from '@tanstack/router-generator';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import {
  domainPackages,
  generatedRouteTree,
  type StyleRule,
} from '../architecture/policy.ts';
import {
  liveRuleNames,
  probeSchema,
  unknownRule,
} from '../architecture/probe.ts';
import {
  compilerFindings,
  buildCompilerRuns,
} from '../architecture/react-compiler.ts';
import { pinProblems, uiFolder } from '../architecture/shadcn-pins.ts';
import {
  ARCHITECTURE_LINE_BUDGET,
  architectureLines,
} from '../architecture/guardrail-budget.ts';
import { scriptInvokes } from '../architecture/script-policy.ts';
import { unownedProse } from '../architecture/prose-policy.ts';
import { manualAuditProblems } from '../architecture/ci-policy.ts';
import {
  duplicateScope,
  scanDuplicates,
} from '../architecture/duplicate-policy.ts';
import {
  mobileGeneratedTypes,
  mobileMetroFile,
} from '../architecture/theme-policy.ts';

const [mode, target] = process.argv.slice(2);
if (
  (mode !== 'lint' && mode !== 'format') ||
  (target !== 'server' && target !== 'web')
)
  throw new Error('Usage: node scripts/style.ts lint|format server|web');

const packageNames = readdirSync('packages', { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() && existsSync(join('packages', entry.name, 'src')),
  )
  .map((entry) => entry.name);

const packages = packageNames.flatMap((name) => [
  join('packages', name, 'src'),
  join('packages', name, 'spec'),
]);

const serverRoots = [
  'apps/mobile/src',
  'apps/mobile/spec',
  'apps/mobile/app.config.ts',
  mobileMetroFile,
  'apps/desktop/src',
  'apps/desktop/spec',
  'apps/desktop/playwright.config.ts',
  'apps/server/src',
  'apps/server/spec',
  ...packages,
  'packages/storage/scripts',
  'packages/storage/drizzle.config.ts',
  'architecture',
  'scripts',
  'vitest.config.ts',
  '.agents/skills/server-verify/scripts',
  '.agents/skills/verify-core',
  '.agents/skills/web-verify/scripts',
  '.agents/skills/desktop-verify/scripts',
  '.agents/skills/mobile-verify/scripts',
].filter((root) => existsSync(root));
const webRoots = [
  'apps/web/src',
  'apps/web/spec',
  'apps/web/vite.config.ts',
  'apps/web/vitest.config.ts',
  'apps/web/playwright.config.ts',
];
const allRoots = [...serverRoots, ...webRoots];
const roots = target === 'web' ? webRoots : serverRoots;

const disableDirective = /(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable|enable)/;
const lintConfig = '.oxlintrc.json';
const lintedFile = /\.[cm]?[jt]sx?$/;
const strayLintConfig =
  /^(?:\.(?:oxlintrc|eslintrc)(?:\..+)?|\.(?:eslint|oxlint)ignore|(?:oxlint|eslint)\.config\.[cm]?[jt]s)$/;
type Problem = { rule: StyleRule; message: string };

function problem(rule: StyleRule, message: string): Problem {
  if (!/\b(?:because|so)\b\s+\S/.test(message))
    throw new Error(`A lint message explains why: ${message}`);
  return { rule, message };
}

const skippedDirectories = new Set([
  'node_modules',
  '.git',
  '.claude',
  'dist',
  '.vite',
  '.turbo',
  'test-results',
]);

function filesUnder(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory())
      return skippedDirectories.has(entry.name) ||
        /^apps\/mobile\/(?:ios|android|\.expo)$/.test(child)
        ? []
        : filesUnder(child);
    return entry.isFile() ? [child] : [];
  });
}

function disableDirectives(): Problem[] {
  return allRoots.flatMap(filesUnder).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        disableDirective.test(line)
          ? [
              problem(
                'disable-directives',
                `${file}:${index + 1}: fix the code instead of disabling a rule; disable directives are not allowed, because a disable directive hides code from a required check.`,
              ),
            ]
          : [],
      ),
  );
}

function repositoryFiles(): string[] {
  const listed = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (listed.error) throw listed.error;
  return listed.stdout
    .split('\n')
    .filter((path) => existsSync(path) && !path.startsWith('.claude/'));
}

function codeOutsideLintRoots(files: readonly string[]): Problem[] {
  return files
    .filter(
      (path) =>
        lintedFile.test(path) &&
        !allRoots.some((root) => path === root || path.startsWith(`${root}/`)),
    )
    .map((path) =>
      problem(
        'code-outside-lint-roots',
        `${path}: put code under a lint root (${allRoots.join(', ')}), because a file outside them escapes lint, disable-directive scanning and format checks.`,
      ),
    );
}

function proseOutsideSkills(files: readonly string[]): Problem[] {
  return files
    .filter(unownedProse)
    .map((path) =>
      problem(
        'prose-outside-skills',
        `${path}: keep prose in AGENTS.md, the pull request template or .agents/skills/, because architecture narration can drift from the code and executable rulebook; move a workflow into its skill.`,
      ),
    );
}

const pinnedWorkflows = [
  '.github/workflows/server.yml',
  '.github/workflows/web.yml',
  '.github/workflows/probes.yml',
] as const;

function workflowDocument(path: string): unknown {
  if (!existsSync(path)) return undefined;
  const document = parseDocument(readFileSync(path, 'utf8'));
  if (document.errors.length > 0) return undefined;
  const parsed: unknown = document.toJS();
  return parsed;
}

const workflowRunsSchema = z.object({
  on: z.record(z.string(), z.unknown()),
  jobs: z.record(
    z.string(),
    z.object({ steps: z.array(z.object({ run: z.string().optional() })) }),
  ),
});

const requiredRuns: Readonly<Record<string, readonly string[]>> = {
  '.github/workflows/server.yml': [
    'pnpm check --affected',
    'sudo apt-get update && sudo apt-get install --yes bubblewrap',
    'sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0',
    'bwrap --ro-bind / / --dev /dev --proc /proc --unshare-pid --unshare-ipc --unshare-net --new-session --die-with-parent -- true',
    'pnpm exec playwright install --with-deps --only-shell chromium',
    'pnpm test:integration --affected --continue',
  ],
  '.github/workflows/web.yml': [
    'pnpm check',
    'pnpm --filter @porcelain/web build',
    'pnpm exec playwright install --with-deps --only-shell chromium',
    'pnpm db:check',
    'pnpm test:integration',
    'pnpm --filter @porcelain/web test:e2e',
  ],
};

const prePushSchema = z.object({
  'pre-push': z
    .object({
      jobs: z.array(
        z.object({ run: z.string(), name: z.string().optional() }).strict(),
      ),
    })
    .strict(),
});
function prePushChecks(): boolean {
  const parsed = prePushSchema.safeParse(lefthookConfig());
  return (
    parsed.success &&
    parsed.data['pre-push'].jobs.some((job) =>
      scriptInvokes(job.run, [['pnpm', 'check']], '.'),
    )
  );
}

function workflowRuns(document: unknown): string[] {
  const parsed = workflowRunsSchema.safeParse(document);
  if (!parsed.success) return [];
  return Object.values(parsed.data.jobs).flatMap((job) =>
    job.steps.flatMap((step) => (step.run === undefined ? [] : [step.run])),
  );
}

function ciProblems(): Problem[] {
  const documents = new Map<string, unknown>(
    pinnedWorkflows.map((path) => [path, workflowDocument(path)]),
  );
  const server = workflowRunsSchema.safeParse(
    documents.get('.github/workflows/server.yml'),
  );
  return [
    ...Object.entries(requiredRuns).flatMap(([path, runs]) => {
      const found = workflowRuns(documents.get(path));
      const missing = runs.filter((run) => {
        const required = run
          .split(' && ')
          .map((command) => command.split(/\s+/));
        return !found.some((command) => scriptInvokes(command, required, '.'));
      });
      return missing.length === 0
        ? []
        : [
            problem(
              'ci-steps',
              `${path} runs ${missing.join(', ')}; a gate leaves CI only by changing this check, where the change is visible, because required checks must run before a change can be shipped.`,
            ),
          ];
    }),
    ...(server.success &&
    'pull_request' in server.data.on &&
    'push' in server.data.on
      ? []
      : [
          problem(
            'ci-steps',
            '.github/workflows/server.yml runs on every pull request and every push to main, so every change meets pnpm check and the integration tests.',
          ),
        ]),
    ...manualAuditProblems(documents).map((message) =>
      problem('manual-audits', message),
    ),
    ...(prePushChecks()
      ? []
      : [
          problem(
            'ci-steps',
            'lefthook.yml, merged with any local or extended Lefthook configuration, runs pnpm check before every push, with no skip, only or file filter, because required checks must run before a change can be shipped.',
          ),
        ]),
  ];
}

function lefthookConfig(): unknown {
  const dumped = spawnSync(
    join('node_modules', '.bin', 'lefthook'),
    ['dump', '--format', 'json'],
    { encoding: 'utf8' },
  );
  if (dumped.error) throw dumped.error;
  if (dumped.status !== 0) return undefined;
  const parsed: unknown = JSON.parse(dumped.stdout);
  return parsed;
}

function hookProblems(): Problem[] {
  if (process.env.CI === 'true') return [];
  const checked = spawnSync(
    join('node_modules', '.bin', 'lefthook'),
    ['check-install'],
    { encoding: 'utf8' },
  );
  if (checked.error) throw checked.error;
  const hooks = spawnSync(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-path', 'hooks'],
    { encoding: 'utf8' },
  );
  if (hooks.error) throw hooks.error;
  const hook = join(hooks.stdout.trim(), 'pre-push');
  const installed =
    checked.status === 0 &&
    hooks.status === 0 &&
    existsSync(hook) &&
    readFileSync(hook, 'utf8').includes('lefthook run "pre-push"');
  return installed
    ? []
    : [
        problem(
          'pre-push-hook',
          `${hook} is not the Lefthook pre-push hook in sync with lefthook.yml; without it a push runs none of the pre-push checks and nothing says so. Run pnpm run prepare, which installs the hook and resets core.hooksPath, because without the installed hook a push skips its required checks.`,
        ),
      ];
}

const formatConfig = '.oxfmtrc.json';
const strayFormatConfig =
  /^(?:\.oxfmtrc(?:\..+)?|\.prettierrc(?:\..+)?|\.prettierignore|prettier\.config\.[cm]?[jt]s)$/;

function strayFormatConfigs(): Problem[] {
  return filesUnder('.')
    .filter(
      (path) => path !== formatConfig && strayFormatConfig.test(basename(path)),
    )
    .map((path) =>
      problem(
        'format-config',
        `${path}: the format check reads one configuration, the root ${formatConfig}, with no ignore files; remove this file, because a second configuration can exclude code from the root format check.`,
      ),
    );
}

function strayLintConfigs(): Problem[] {
  return filesUnder('.')
    .filter(
      (path) => path !== lintConfig && strayLintConfig.test(basename(path)),
    )
    .map((path) =>
      problem(
        'one-lint-config',
        `${path}: lint reads one configuration, the root ${lintConfig}, with no ignore files; remove this file, because a second configuration can hide code from the root lint policy.`,
      ),
    );
}

const lintConfigSchema = z
  .object({
    plugins: z.array(z.string()),
    jsPlugins: z.array(z.string()),
    options: z.object({ typeAware: z.literal(true) }).strict(),
    rules: z.record(z.string(), z.unknown()),
    overrides: z.array(z.unknown()),
  })
  .strict();

const pluginSchema = z.object({
  default: z.object({ rules: z.record(z.string(), z.unknown()) }),
});

const probeModuleSchema = z.object({ default: z.unknown() });

const tsconfigSchema = z.object({
  extends: z.string().optional(),
  compilerOptions: z.record(z.string(), z.unknown()).optional(),
  include: z.array(z.string()).optional(),
});

const formatConfigSchema = z.object({ ignorePatterns: z.unknown() }).partial();
const manifestScriptsSchema = z.object({
  scripts: z.record(z.string(), z.string()).optional(),
});

const packageFolders = [
  'apps/mobile',
  'apps/desktop',
  'apps/server',
  'apps/web',
  ...packageNames.map((name) => join('packages', name)),
];

const tsconfigPackageOptions: ReadonlySet<string> = new Set(['types', 'lib']);

const strictnessFlags = [
  'strict',
  'noUncheckedIndexedAccess',
  'exactOptionalPropertyTypes',
  'noImplicitOverride',
  'noFallthroughCasesInSwitch',
  'verbatimModuleSyntax',
  'erasableSyntaxOnly',
] as const;

const requiredRules = [
  'no-unused-vars',
  'typescript/consistent-type-imports',
  'typescript/no-deprecated',
  'typescript/no-explicit-any',
  'typescript/no-floating-promises',
  'typescript/no-misused-promises',
  'typescript/no-unnecessary-type-assertion',
  'typescript/no-unsafe-argument',
  'typescript/no-unsafe-assignment',
  'typescript/no-unsafe-call',
  'typescript/no-unsafe-member-access',
  'typescript/no-unsafe-return',
  'typescript/no-unsafe-type-assertion',
  'typescript/only-throw-error',
  'shadcn/no-raw-colors',
  'shadcn/no-restyle',
] as const;

const sanctionedOverrides: readonly { reason: string; override: unknown }[] = [
  {
    reason:
      'the plugin files are plain JavaScript that the typescript rules cannot type',
    override: {
      files: ['architecture/*.mjs', 'architecture/*.cjs'],
      rules: {
        'typescript/no-unsafe-argument': 'off',
        'typescript/no-unsafe-assignment': 'off',
        'typescript/no-unsafe-call': 'off',
        'typescript/no-unsafe-member-access': 'off',
        'typescript/no-unsafe-return': 'off',
      },
    },
  },
  {
    reason:
      "the web copy falls back to the deprecated document.execCommand('copy') because the Clipboard API needs HTTPS or localhost, and Porcelain is opened over plain HTTP on the LAN",
    override: {
      files: ['apps/web/src/shared/workspace/copy.ts'],
      rules: { 'typescript/no-deprecated': 'off' },
    },
  },
];

const typesFreePackages = new Set<string>([
  ...domainPackages,
  'kernel',
  'contracts',
]);

class StyleProblem extends Error {
  readonly problem: Problem;

  constructor(found: Problem) {
    super(found.message);
    this.problem = found;
  }
}

function strictJson(path: string): unknown {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return parsed;
  } catch (error) {
    throw new StyleProblem(
      problem(
        'strict-json',
        `${path} is not strict JSON; configuration carries no comments or trailing commas (${error instanceof Error ? error.message : String(error)}), because comments and permissive parsing can make tools read different configuration.`,
      ),
    );
  }
}

function isError(level: unknown): boolean {
  return level === 'error' || (Array.isArray(level) && level[0] === 'error');
}

async function configProblems(): Promise<Problem[]> {
  const problems: Problem[] = [];
  const config = lintConfigSchema.safeParse(strictJson('.oxlintrc.json'));
  if (!config.success)
    return [
      problem(
        'lint-config',
        `.oxlintrc.json holds plugins, jsPlugins, options, rules and overrides only, because unsupported fields can bypass the shared lint policy: ${config.error.message}`,
      ),
    ];
  const format = formatConfigSchema.safeParse(strictJson(formatConfig));
  if (!format.success || format.data.ignorePatterns !== undefined)
    problems.push(
      problem(
        'format-config',
        `${formatConfig} ignores nothing; every file under the format roots is checked, because a second configuration can exclude code from the root format check.`,
      ),
    );
  problems.push(...(await viteProblems()));
  const { plugins, jsPlugins, rules, overrides } = config.data;
  if (!isDeepStrictEqual(plugins, ['typescript']))
    problems.push(
      problem(
        'lint-config',
        '.oxlintrc.json loads the typescript plugin, because disabling a configured rule leaves its mistakes unchecked.',
      ),
    );
  for (const name of requiredRules)
    if (!isError(rules[name]))
      problems.push(
        problem(
          'lint-config',
          `.oxlintrc.json keeps ${name} on as "error"; a built-in rule leaves lint only by changing this check, where the change is visible, because disabling a configured rule leaves its mistakes unchecked.`,
        ),
      );
  if (
    !isDeepStrictEqual(jsPlugins, [
      './architecture/oxlint-plugin.mjs',
      '@shadcn/lint',
    ])
  )
    problems.push(
      problem(
        'lint-config',
        '.oxlintrc.json loads the Porcelain and shadcn plugins, because disabling a configured rule leaves its mistakes unchecked.',
      ),
    );
  const pluginPath = new URL(
    '../architecture/oxlint-plugin.mjs',
    import.meta.url,
  ).href;
  const plugin = pluginSchema.parse(await import(pluginPath));
  for (const name of Object.keys(plugin.default.rules))
    if (!isError(rules[`porcelain/${name}`]))
      problems.push(
        problem(
          'lint-config',
          `.oxlintrc.json sets porcelain/${name} to "error", because disabling a configured rule leaves its mistakes unchecked.`,
        ),
      );
  for (const [name, level] of Object.entries(rules)) {
    if (!isError(level))
      problems.push(
        problem(
          'lint-config',
          `.oxlintrc.json turns ${name} on as "error" or leaves it out, because disabling a configured rule leaves its mistakes unchecked.`,
        ),
      );
    if (
      name.startsWith('porcelain/') &&
      !(name.slice('porcelain/'.length) in plugin.default.rules)
    )
      problems.push(
        problem(
          'lint-config',
          `.oxlintrc.json names ${name}, which the plugin does not define, because disabling a configured rule leaves its mistakes unchecked.`,
        ),
      );
  }
  if (
    !isDeepStrictEqual(
      overrides,
      sanctionedOverrides.map((sanctioned) => sanctioned.override),
    )
  )
    problems.push(
      problem(
        'lint-config',
        `.oxlintrc.json holds exactly the sanctioned overrides, each for its reason: ${sanctionedOverrides.map((sanctioned) => sanctioned.reason).join('; ')}. Any other override is a disable directive, because disabling a configured rule leaves its mistakes unchecked.`,
      ),
    );
  const tsconfigs = filesUnder('.').filter((path) =>
    /(?:^|\/)tsconfig[^/]*\.json$/.test(path),
  );
  const rootOptions =
    tsconfigSchema.parse(strictJson('tsconfig.json')).compilerOptions ?? {};
  for (const flag of strictnessFlags)
    if (rootOptions[flag] !== true)
      problems.push(
        problem(
          'tsconfig',
          `tsconfig.json sets ${flag} to true; every package and app compiles with the root's strictness, because loosening compiler scope or strictness lets unsafe code escape typechecking.`,
        ),
      );
  for (const path of tsconfigs) {
    const tsconfig = tsconfigSchema.parse(strictJson(path));
    if (path !== 'tsconfig.json') {
      const loosened = strictnessFlags.filter(
        (flag) => flag in (tsconfig.compilerOptions ?? {}),
      );
      if (tsconfig.extends !== '../../tsconfig.json' || loosened.length > 0)
        problems.push(
          problem(
            'tsconfig',
            `${path} extends ../../tsconfig.json and leaves ${loosened.join(', ') || 'every strictness flag'} to it, because loosening compiler scope or strictness lets unsafe code escape typechecking.`,
          ),
        );
    }
    const owner =
      /^(?:packages\/([^/]+)|apps\/(server|desktop))\/tsconfig\.json$/.exec(
        path,
      );
    const name = owner?.[1] ?? owner?.[2];
    if (name === undefined) continue;
    for (const pattern of ['src/**/*.ts', 'spec/**/*.ts'])
      if (!tsconfig.include?.includes(pattern))
        problems.push(
          problem(
            'tsconfig',
            `${path} includes ${pattern}, because loosening compiler scope or strictness lets unsafe code escape typechecking.`,
          ),
        );
    const options = Object.keys(tsconfig.compilerOptions ?? {});
    if (
      tsconfig.extends !== '../../tsconfig.json' ||
      options.some((option) => !tsconfigPackageOptions.has(option))
    )
      problems.push(
        problem(
          'tsconfig',
          `${path} extends ../../tsconfig.json and sets only types and lib; every strictness flag comes from the root, because loosening compiler scope or strictness lets unsafe code escape typechecking.`,
        ),
      );
    if (
      typesFreePackages.has(name) &&
      !isDeepStrictEqual(tsconfig.compilerOptions, { types: [] })
    )
      problems.push(
        problem(
          'tsconfig',
          `${path} sets "types": [] so Node globals do not compile in a domain.`,
        ),
      );
  }
  const webTypes = tsconfigSchema.parse(strictJson('apps/web/tsconfig.json'))
    .compilerOptions?.types;
  if (!isDeepStrictEqual(webTypes, ['vite/client']))
    problems.push(
      problem(
        'tsconfig',
        'apps/web/tsconfig.json sets "types": ["vite/client"] so Node globals do not compile in browser code; vite.config.ts gets Node through apps/web/tsconfig.node.json.',
      ),
    );
  problems.push(...scriptProblems());
  problems.push(...ciProblems());
  problems.push(...hookProblems());
  problems.push(...(await configModuleProblems()));
  problems.push(...(await ruleProblems()));
  return problems;
}

const routeTreeOptions = {
  target: 'react',
  autoCodeSplitting: true,
  routeTreeFileHeader: [],
  semicolons: true,
} as const;
async function viteProblems(): Promise<Problem[]> {
  const path = 'apps/web/vite.config.ts';
  const config: unknown = await import(pathToFileURL(resolve(path)).href);
  return (await buildCompilerRuns(config))
    ? []
    : [
        problem(
          'vite-config',
          `${path} must compile the fixture through the configured build plugin, because checking source alone cannot prove the shipped build uses the React Compiler.`,
        ),
      ];
}

function filesOf(root: string): Map<string, string> {
  return new Map(
    filesUnder(root).map((file) => [
      relative(root, file),
      readFileSync(file, 'utf8'),
    ]),
  );
}

async function routeTreeProblems(): Promise<Problem[]> {
  const web = 'apps/web';
  const routes = join(web, 'src', 'routes');
  const scratch = mkdtempSync(join(tmpdir(), 'porcelain-route-tree-'));
  try {
    cpSync(routes, join(scratch, 'src', 'routes'), { recursive: true });
    const config = getConfig(
      {
        ...routeTreeOptions,
        routeTreeFileHeader: [...routeTreeOptions.routeTreeFileHeader],
        tmpDir: join(scratch, 'tmp'),
        disableLogging: true,
      },
      scratch,
    );
    await new Generator({ config, root: scratch }).run();
    const generated = join(scratch, 'src', 'routeTree.gen.ts');
    const committed = existsSync(generatedRouteTree)
      ? readFileSync(generatedRouteTree, 'utf8')
      : undefined;
    const rewritten = [...filesOf(join(scratch, 'src', 'routes'))].filter(
      ([file, text]) => {
        const path = join(routes, file);
        return !existsSync(path) || readFileSync(path, 'utf8') !== text;
      },
    );
    return [
      ...(committed === readFileSync(generated, 'utf8')
        ? []
        : [
            problem(
              'route-tree',
              `${generatedRouteTree} differs from what TanStack Router generates from ${routes}; it is generated, never edited: run the web build or dev server and commit the file it writes, because editing generated routes disconnects the declared routes from the shipped router.`,
            ),
          ]),
      ...rewritten.map(([file]) =>
        problem(
          'route-tree',
          `${join(routes, file)} is not what TanStack Router keeps it as; let the generator rewrite it through the web build or dev server and commit the result, because editing generated routes disconnects the declared routes from the shipped router.`,
        ),
      ),
    ];
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const rootTasks = [
  'typecheck',
  'lint:server',
  'lint:web',
  'format:server:check',
  'format:web:check',
  'arch:check',
  'test:rules',
  'probes:check',
  'features:check',
] as const;
const fastTasks = ['typecheck', 'test', ...rootTasks.slice(1)];

type Invocation = readonly [string, ...string[]];
const rootCommands: Readonly<Record<string, readonly Invocation[]>> = {
  typecheck: [['tsc', '--noEmit']],
  'typecheck:server': [
    ['tsc', '--noEmit'],
    ['pnpm', '--filter', '@porcelain/server...', '-r', 'typecheck'],
  ],
  'lint:server': [['node', 'scripts/style.ts', 'lint', 'server']],
  'lint:web': [['node', 'scripts/style.ts', 'lint', 'web']],
  'format:server:check': [['node', 'scripts/style.ts', 'format', 'server']],
  'format:web:check': [['node', 'scripts/style.ts', 'format', 'web']],
  'arch:check': [['node', 'scripts/architecture.ts', 'check']],
  probes: [['node', 'scripts/probes.ts']],
  'probes:check': [['node', 'scripts/probes.ts', '--check']],
  'features:check': [['node', 'scripts/feature-maps.ts']],
  'test:rules': [['node', 'architecture/rule-tests.mjs']],
  test: [
    [
      'vitest',
      'run',
      ...[
        'client-integration',
        'server-integration',
        'server-perf',
        'mobile-e2e*',
      ].flatMap((name) => ['--project', `!@porcelain/${name}`]),
    ],
  ],
  'test:integration': [['turbo', 'run', 'test:integration']],
  'test:e2e': [['turbo', 'run', 'test:e2e']],
  'db:check': [['pnpm', '--filter', '@porcelain/storage', 'db:check']],
  prepare: [['lefthook', 'install']],
  check: [['turbo', 'run', ...fastTasks]],
};

function scriptProblems(): Problem[] {
  const manifests = [
    'package.json',
    ...packageFolders.map((folder) => join(folder, 'package.json')),
  ];
  const integration = (name: string): readonly Invocation[] => [
    [
      'vitest',
      'run',
      '--config',
      '../../vitest.config.ts',
      '--project',
      `@porcelain/${name}`,
    ],
  ];
  return manifests.flatMap((path) => {
    const scripts = existsSync(path)
      ? (manifestScriptsSchema.parse(strictJson(path)).scripts ?? {})
      : {};
    const folder = dirname(path);
    let expected: Readonly<Record<string, readonly Invocation[]>> = {};
    if (path === 'package.json') expected = rootCommands;
    else if (path !== 'packages/theme/package.json') {
      expected = {
        typecheck: [['tsc', '--noEmit']],
        test: integration(basename(folder)),
      };
      if (folder === 'apps/web')
        expected = {
          ...expected,
          typecheck: [
            ['tsc', '--noEmit'],
            ['tsc', '--noEmit', '-p', 'tsconfig.node.json'],
          ],
          build: [
            ['tsc', '--noEmit'],
            ['tsc', '--noEmit', '-p', 'tsconfig.node.json'],
            ['vite', 'build'],
          ],
          'test:integration': [
            ['vitest', 'run', '--config', 'vitest.config.ts'],
          ],
          'test:e2e': [['playwright', 'test']],
        };
      if (folder === 'apps/desktop')
        expected = { ...expected, 'test:e2e': [['playwright', 'test']] };
      if (folder === 'apps/mobile')
        expected = {
          ...expected,
          'test:e2e': [
            ...integration('mobile-e2e'),
            ...integration('mobile-e2e-tablet'),
          ],
        };
      if (folder === 'apps/server')
        expected = {
          ...expected,
          'test:integration': integration('server-integration'),
          'test:perf': integration('server-perf'),
        };
      if (folder === 'packages/client')
        expected = {
          ...expected,
          typecheck: [
            ['tsc', '--noEmit'],
            ['tsc', '--noEmit', '-p', 'tsconfig.spec.json'],
          ],
          'test:integration': integration('client-integration'),
        };
      if (folder === 'packages/storage')
        expected = {
          ...expected,
          'db:check': [
            ['drizzle-kit', 'check'],
            ['node', 'scripts/check-migrations.ts'],
          ],
        };
    }
    return Object.entries(expected).flatMap(([name, invocations]) =>
      scriptInvokes(scripts[name] ?? '', invocations, folder)
        ? []
        : [
            problem(
              'package-scripts',
              `${path} ${name} must invoke ${invocations.map((command) => command.join(' ')).join(' and ')}, because a successful no-op leaves its gate unchecked.`,
            ),
          ],
    );
  });
}

const vitestConfigSchema = z.object({
  default: z.object({
    test: z.object({
      allowOnly: z.unknown(),
      passWithNoTests: z.unknown(),
      reporters: z.array(z.unknown()),
      projects: z.array(
        z.object({
          test: z.object({
            name: z.unknown(),
            expect: z.object({ requireAssertions: z.unknown() }).partial(),
          }),
        }),
      ),
    }),
  }),
});

const playwrightConfigSchema = z.object({
  default: z.object({
    retries: z.unknown(),
    forbidOnly: z.unknown(),
    use: z.object({
      browserName: z.unknown(),
      headless: z.unknown(),
      trace: z.unknown(),
    }),
  }),
});

const desktopPlaywrightConfigSchema = z.object({
  default: z.object({
    retries: z.unknown(),
    forbidOnly: z.unknown(),
  }),
});

const browserConfigSchema = z.object({
  default: z.object({
    test: z.object({
      allowOnly: z.unknown(),
      passWithNoTests: z.unknown(),
      projects: z.never().optional(),
      include: z.array(z.string()),
      retry: z.unknown(),
      browser: z.object({
        enabled: z.unknown(),
        headless: z.unknown(),
        provider: z.object({ name: z.unknown() }),
        instances: z.array(z.object({ browser: z.unknown() })),
      }),
    }),
  }),
});

const cruiserConfigSchema = z.object({
  default: z.object({
    forbidden: z.array(
      z.object({
        name: z.string(),
        severity: z.unknown(),
        from: z.unknown(),
        to: z.unknown(),
      }),
    ),
  }),
});

const cruiserRules = [
  'no-circular-source-imports',
  'web-routes-import-feature-index',
  'web-features-import-feature-index',
  'web-shared-imports-no-owner',
  'web-nothing-imports-routes',
  'mobile-routes-import-feature-index',
  'mobile-features-import-feature-index',
  'mobile-shared-imports-no-owner',
  'mobile-nothing-imports-routes',
] as const;

const reportsSpecDiscipline = (reporter: unknown): boolean =>
  typeof reporter === 'object' &&
  reporter !== null &&
  'onTestRunEnd' in reporter &&
  typeof reporter.onTestRunEnd === 'function';

function desktopDiscoversTests(): boolean {
  const result = spawnSync(
    resolve('node_modules/.bin/playwright'),
    ['test', '--list', '--reporter=json'],
    { cwd: 'apps/desktop', encoding: 'utf8' },
  );
  if (result.status !== 0) return false;
  const listed = z
    .object({
      config: z.object({ rootDir: z.string() }),
      suites: z.array(z.object({ file: z.string() })),
    })
    .safeParse(JSON.parse(result.stdout));
  if (!listed.success) return false;
  const discovered = new Set(
    listed.data.suites.map((suite) =>
      resolve(listed.data.config.rootDir, suite.file),
    ),
  );
  const expected = filesUnder('apps/desktop/spec/e2e').filter((path) =>
    path.endsWith('.e2e.ts'),
  );
  return (
    expected.length > 0 &&
    expected.every((path) => discovered.has(resolve(path))) &&
    discovered.size === expected.length
  );
}

async function configModuleProblems(): Promise<Problem[]> {
  const problems: Problem[] = [];
  const load = async (path: string): Promise<unknown> =>
    import(pathToFileURL(resolve(path)).href);
  const vitest = vitestConfigSchema.safeParse(await load('vitest.config.ts'));
  const projects = vitest.success ? vitest.data.default.test.projects : [];
  const named = new Set(projects.map((project) => project.test.name));
  if (
    !vitest.success ||
    vitest.data.default.test.allowOnly !== false ||
    vitest.data.default.test.passWithNoTests !== false ||
    !vitest.data.default.test.reporters.some(reportsSpecDiscipline) ||
    projects.some(
      (project) => project.test.expect.requireAssertions !== true,
    ) ||
    packageFolders.some(
      (folder) =>
        folder !== 'packages/theme' &&
        !named.has(`@porcelain/${basename(folder)}`),
    )
  )
    problems.push(
      problem(
        'vitest-config',
        'vitest.config.ts gives every package a project that requires assertions, allows no .only, fails with no specs and keeps the spec-discipline reporter, because each declared unit and integration test must be discovered and assert its promise.',
      ),
    );
  const browser = browserConfigSchema.safeParse(
    await load('apps/web/vitest.config.ts'),
  );
  const integration = browser.success ? browser.data.default.test : undefined;
  if (
    integration === undefined ||
    integration.allowOnly !== false ||
    integration.passWithNoTests !== false ||
    !isDeepStrictEqual(integration.include, ['spec/integration/*.test.tsx']) ||
    integration.retry !== 0 ||
    integration.browser.enabled !== true ||
    integration.browser.headless !== true ||
    integration.browser.provider.name !== 'playwright' ||
    integration.browser.instances.length === 0 ||
    integration.browser.instances.some(
      (instance) => instance.browser !== 'chromium',
    )
  )
    problems.push(
      problem(
        'vitest-config',
        'apps/web/vitest.config.ts runs every integration test in spec/integration exactly once, in one project whose files Vitest schedules, with no retry and no .only, in headless Chromium through the Playwright provider, because each declared unit and integration test must be discovered and assert its promise.',
      ),
    );
  const e2e = playwrightConfigSchema.safeParse(
    await load('apps/web/playwright.config.ts'),
  );
  const flows = e2e.success ? e2e.data.default : undefined;
  if (
    flows === undefined ||
    flows.retries !== 0 ||
    flows.forbidOnly !== true ||
    flows.use.browserName !== 'chromium' ||
    flows.use.headless !== true ||
    flows.use.trace !== 'retain-on-failure'
  )
    problems.push(
      problem(
        'playwright-config',
        'apps/web/playwright.config.ts runs every e2e test once in headless Chromium with a failure trace, because retries and .only can hide regressions.',
      ),
    );
  const desktop = desktopPlaywrightConfigSchema.safeParse(
    await load('apps/desktop/playwright.config.ts'),
  );
  const native = desktop.success ? desktop.data.default : undefined;
  if (
    native === undefined ||
    !desktopDiscoversTests() ||
    native.retries !== 0 ||
    native.forbidOnly !== true
  )
    problems.push(
      problem(
        'playwright-config',
        'apps/desktop/playwright.config.ts discovers every desktop e2e test once with no retry and no .only, so misplaced suites cannot silently escape the runner.',
      ),
    );
  const cruiser = cruiserConfigSchema.safeParse(
    await load('architecture/dependency-cruiser.cjs'),
  );
  const forbidden = cruiser.success ? cruiser.data.default.forbidden : [];
  const circular = forbidden.find(
    (rule) => rule.name === 'no-circular-source-imports',
  );
  if (
    cruiserRules.some(
      (name) =>
        forbidden.find((rule) => rule.name === name)?.severity !== 'error',
    ) ||
    !isDeepStrictEqual(circular?.from, {
      path: '^(apps/server/src/|apps/web/src/|apps/desktop/src/|apps/mobile/src/|packages/)',
    }) ||
    !isDeepStrictEqual(circular?.to, { circular: true })
  )
    problems.push(
      problem(
        'cruiser-config',
        'architecture/dependency-cruiser.cjs keeps its forbidden rules as errors, and the circular-import rule covers the server, web, desktop and every package, because a narrowed or disabled dependency rule misses ownership violations.',
      ),
    );
  return problems;
}

async function ruleProblems(): Promise<Problem[]> {
  const problems: Problem[] = [];
  const live = await liveRuleNames('.');
  const probeFolder = join('architecture', 'probes');
  for (const file of readdirSync(probeFolder).filter((name) =>
    name.endsWith('.ts'),
  )) {
    const loaded = probeModuleSchema.parse(
      await import(pathToFileURL(join(probeFolder, file)).href),
    );
    const probe = probeSchema.safeParse(loaded.default);
    const dishonest = probe.success
      ? unknownRule(probe.data, live)
      : probe.error.issues.map((issue) => issue.message).join('; ');
    if (dishonest !== undefined)
      problems.push(
        problem(
          'probe-shape',
          `${probeFolder}/${file}: ${dishonest}; a probe names the exact rule its gate prints, so its verdict cannot lie.`,
        ),
      );
  }
  return problems;
}

const diagnosticsSchema = z.object({
  number_of_files: z.number(),
  diagnostics: z.array(
    z.object({
      message: z.string(),
      code: z.string().optional(),
      severity: z.string(),
      filename: z.string(),
      labels: z
        .array(
          z.object({
            span: z.object({ line: z.number(), column: z.number() }),
          }),
        )
        .optional(),
    }),
  ),
});

type Finding = {
  rule: string;
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
};

function webSources(): string[] {
  return filesUnder('apps/web/src').filter(
    (path) =>
      /\.tsx?$/.test(path) && !path.startsWith('apps/web/src/components/ui/'),
  );
}

function duplicateFindings(): Finding[] {
  const scope = duplicateScope(
    target === 'web' ? 'web' : 'repository',
    packageNames,
  );
  const report = scanDuplicates(process.cwd(), scope);
  const total = report.statistics.total;
  const unit =
    scope.metric === 'duplicatedLines' ? 'duplicated lines' : 'clones';
  process.stdout.write(
    `Duplicate code (${scope.name}): ${total.clones} clones, ${total.duplicatedLines} duplicated lines (limit ${scope.ceiling} ${unit}; the ceiling only moves down). ${scope.why}\n`,
  );
  if (!report.exceeded) return [];
  const at = (name: string) => relative('.', name);
  return report.duplicates.flatMap((clone) =>
    [
      [clone.firstFile, clone.secondFile],
      [clone.secondFile, clone.firstFile],
    ].map(([here, there]) => ({
      rule: 'style/duplicate-code',
      file: at(here?.name ?? ''),
      line: here?.start ?? 0,
      column: 0,
      code: 'error style(duplicate-code)',
      message: `${clone.lines} lines here repeat ${at(there?.name ?? '')}:${there?.start ?? 0}; ${scope.name} has ${report.count} ${unit}, above its ceiling of ${scope.ceiling}, which only moves down. ${scope.why} Extract the copy into its owner, because duplicated fixes drift between copies.`,
    })),
  );
}

async function lint(): Promise<number> {
  const files = roots
    .flatMap(filesUnder)
    .filter(
      (path) =>
        lintedFile.test(path) &&
        path !== generatedRouteTree &&
        path !== mobileGeneratedTypes &&
        path !== mobileMetroFile &&
        !path.startsWith(`${uiFolder}/`),
    );
  const result = spawnSync(
    join('node_modules', '.bin', 'oxlint'),
    [
      '--config',
      lintConfig,
      '--no-ignore',
      '--type-aware',
      '--report-unused-disable-directives',
      '--format',
      'json',
      ...files,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  const parsed = diagnosticsSchema.safeParse(JSON.parse(result.stdout || '{}'));
  if (!parsed.success) {
    process.stderr.write(result.stdout + result.stderr);
    return 1;
  }
  const linted: Finding[] = parsed.data.diagnostics.map((diagnostic) => ({
    rule: (diagnostic.code ?? '').replace(/^([a-z-]+)\((.+)\)$/, '$1/$2'),
    file: diagnostic.filename,
    line: diagnostic.labels?.[0]?.span.line ?? 0,
    column: diagnostic.labels?.[0]?.span.column ?? 0,
    code: `${diagnostic.severity} ${diagnostic.code ?? ''}`,
    message: diagnostic.message,
  }));
  const compiled: Finding[] =
    target === 'web'
      ? (await compilerFindings(webSources())).map((finding) => ({
          rule: 'style/react-compiler',
          file: finding.file,
          line: finding.line,
          column: 0,
          code: 'error style(react-compiler)',
          message: finding.message,
        }))
      : [];
  const reported = [...linted, ...compiled, ...duplicateFindings()];
  for (const finding of reported)
    process.stdout.write(
      `${finding.file}:${finding.line}:${finding.column}: ${finding.code}: ${finding.message}\n`,
    );
  process.stdout.write(`${reported.length} findings.\n`);
  if (parsed.data.number_of_files !== files.length) {
    process.stdout.write(
      `lint skipped files: oxlint read ${parsed.data.number_of_files} of the ${files.length} files under the lint roots; nothing may hide a file from lint.\n`,
    );
    return 1;
  }
  return reported.length > 0 ? 1 : 0;
}

if (mode === 'format') {
  const result = spawnSync(
    join('node_modules', '.bin', 'oxfmt'),
    ['--check', ...roots, `!${mobileGeneratedTypes}`],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} else {
  process.exitCode = await lint();
  const files = repositoryFiles();
  const architectureSources = files
    .filter((path) => path.startsWith('architecture/'))
    .map((path) => readFileSync(path, 'utf8'));
  const lineCount = architectureLines(architectureSources);
  const problems = [
    ...(lineCount > ARCHITECTURE_LINE_BUDGET
      ? [
          problem(
            'architecture-budget',
            `architecture/ has ${lineCount} lines against its ${ARCHITECTURE_LINE_BUDGET} line budget, because guardrails must stay small enough to review; cut a redundant rule before adding another.`,
          ),
        ]
      : []),
    ...disableDirectives(),
    ...strayLintConfigs(),
    ...strayFormatConfigs(),
    ...codeOutsideLintRoots(files),
    ...proseOutsideSkills(files),
    ...(await configProblems().catch((error: unknown) => {
      if (error instanceof StyleProblem) return [error.problem];
      throw error;
    })),
    ...(target === 'web' ? await routeTreeProblems() : []),
    ...(target === 'web'
      ? pinProblems('.').map((found) => problem('shadcn-ui-pinned', found))
      : []),
  ];
  for (const { rule, message } of problems)
    process.stderr.write(`error style(${rule}): ${message}\n`);
  if (problems.length > 0) process.exitCode = 1;
}
