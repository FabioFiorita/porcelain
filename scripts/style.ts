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
import { parseSync } from 'oxc-parser';
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
import { compilerFindings } from '../architecture/react-compiler.ts';
import { pinProblems, uiFolder } from '../architecture/shadcn-pins.ts';
import {
  loadJourneys,
  unmappedRoutes,
} from '../.agents/skills/web-verify/scripts/catalogue.ts';
import { manualAuditProblems } from '../architecture/ci-policy.ts';
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
  'apps/server/src',
  'apps/server/spec',
  ...packages,
  'packages/storage/scripts',
  'packages/storage/drizzle.config.ts',
  'architecture',
  'scripts',
  'vitest.config.ts',
  '.agents/skills/server-verify/scripts',
  '.agents/skills/server-verify/feature-map',
  '.agents/skills/server-verify/negative',
  '.agents/skills/web-verify/scripts',
  '.agents/skills/web-verify/feature-map',
  '.agents/skills/desktop-verify/scripts',
].filter((root) => existsSync(root));
const webRoots = ['apps/web/src', 'apps/web/spec', 'apps/web/vite.config.ts'];
const allRoots = [...serverRoots, ...webRoots];
const roots = target === 'web' ? webRoots : serverRoots;

const disableDirective = /(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable|enable)/;
const lintConfig = '.oxlintrc.json';
const lintedFile = /\.[cm]?[jt]sx?$/;
const strayLintConfig =
  /^(?:\.(?:oxlintrc|eslintrc)(?:\..+)?|\.(?:eslint|oxlint)ignore|(?:oxlint|eslint)\.config\.[cm]?[jt]s)$/;
type Problem = { rule: StyleRule; message: string };

function problem(rule: StyleRule, message: string): Problem {
  return { rule, message };
}

const skippedDirectories = new Set([
  'node_modules',
  '.git',
  '.claude',
  'dist',
  '.vite',
  '.turbo',
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
                `${file}:${index + 1}: fix the code instead of disabling a rule; disable directives are not allowed.`,
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
        `${path}: code lives under a lint root (${allRoots.join(', ')}); a file outside them escapes lint, the disable-directive scan and the format check.`,
      ),
    );
}

function proseOutsideSkills(files: readonly string[]): Problem[] {
  return files
    .filter(
      (path) =>
        /\.(?:md|mdx|markdown)$/i.test(path) &&
        path !== 'AGENTS.md' &&
        !path.startsWith('.agents/skills/'),
    )
    .map((path) =>
      problem(
        'prose-outside-skills',
        `${path}: the repository keeps prose only in AGENTS.md and the skills under .agents/skills/; code is the example and lint the rulebook, so move a workflow into its skill and drop architecture narration.`,
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
    'pnpm test:integration --affected',
  ],
  '.github/workflows/web.yml': [
    'pnpm check',
    'pnpm --filter @porcelain/web build',
    'pnpm db:check',
    'node .agents/skills/server-verify/scripts/verify.ts --all',
    'pnpm verify:web --all',
  ],
};

const prePushHook = { 'pre-push': { jobs: [{ run: 'pnpm check' }] } };

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
      const missing = runs.filter((run) => !found.includes(run));
      return missing.length === 0
        ? []
        : [
            problem(
              'ci-steps',
              `${path} runs ${missing.join(', ')}; a gate leaves CI only by changing this check, where the change is visible.`,
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
    ...(isDeepStrictEqual(lefthookConfig(), prePushHook)
      ? []
      : [
          problem(
            'ci-steps',
            'lefthook.yml, merged with any local or extended Lefthook configuration, runs pnpm check before every push, with no skip, only or file filter.',
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
          `${hook} is not the Lefthook pre-push hook in sync with lefthook.yml; without it a push runs none of the pre-push checks and nothing says so. Run pnpm run prepare, which installs the hook and resets core.hooksPath.`,
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
        `${path}: the format check reads one configuration, the root ${formatConfig}, with no ignore files; remove this file.`,
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
        `${path}: lint reads one configuration, the root ${lintConfig}, with no ignore files; remove this file.`,
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
        `${path} is not strict JSON; configuration carries no comments or trailing commas (${error instanceof Error ? error.message : String(error)}).`,
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
        `.oxlintrc.json holds plugins, jsPlugins, options, rules and overrides only: ${config.error.message}`,
      ),
    ];
  const format = formatConfigSchema.safeParse(strictJson(formatConfig));
  if (!format.success || format.data.ignorePatterns !== undefined)
    problems.push(
      problem(
        'format-config',
        `${formatConfig} ignores nothing; every file under the format roots is checked.`,
      ),
    );
  problems.push(...viteProblems());
  const { plugins, jsPlugins, rules, overrides } = config.data;
  if (!isDeepStrictEqual(plugins, ['typescript']))
    problems.push(
      problem('lint-config', '.oxlintrc.json loads the typescript plugin.'),
    );
  for (const name of requiredRules)
    if (!isError(rules[name]))
      problems.push(
        problem(
          'lint-config',
          `.oxlintrc.json keeps ${name} on as "error"; a built-in rule leaves lint only by changing this check, where the change is visible.`,
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
        '.oxlintrc.json loads the Porcelain and shadcn plugins.',
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
          `.oxlintrc.json sets porcelain/${name} to "error".`,
        ),
      );
  for (const [name, level] of Object.entries(rules)) {
    if (!isError(level))
      problems.push(
        problem(
          'lint-config',
          `.oxlintrc.json turns ${name} on as "error" or leaves it out.`,
        ),
      );
    if (
      name.startsWith('porcelain/') &&
      !(name.slice('porcelain/'.length) in plugin.default.rules)
    )
      problems.push(
        problem(
          'lint-config',
          `.oxlintrc.json names ${name}, which the plugin does not define.`,
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
        `.oxlintrc.json holds exactly the sanctioned overrides, each for its reason: ${sanctionedOverrides.map((sanctioned) => sanctioned.reason).join('; ')}. Any other override is a disable directive.`,
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
          `tsconfig.json sets ${flag} to true; every package and app compiles with the root's strictness.`,
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
            `${path} extends ../../tsconfig.json and leaves ${loosened.join(', ') || 'every strictness flag'} to it.`,
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
        problems.push(problem('tsconfig', `${path} includes ${pattern}.`));
    const options = Object.keys(tsconfig.compilerOptions ?? {});
    if (
      tsconfig.extends !== '../../tsconfig.json' ||
      options.some((option) => !tsconfigPackageOptions.has(option))
    )
      problems.push(
        problem(
          'tsconfig',
          `${path} extends ../../tsconfig.json and sets only types and lib; every strictness flag comes from the root.`,
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

function vitePlugins(path: string): string[] | undefined {
  const source = readFileSync(path, 'utf8');
  const program = parseSync(path, source).program;
  for (const statement of program.body) {
    if (statement.type !== 'ExportDefaultDeclaration') continue;
    const call = statement.declaration;
    if (call.type !== 'CallExpression') return undefined;
    const config = call.arguments[0];
    if (config?.type !== 'ObjectExpression') return undefined;
    for (const property of config.properties)
      if (
        property.type === 'Property' &&
        property.key.type === 'Identifier' &&
        property.key.name === 'plugins' &&
        property.value.type === 'ArrayExpression'
      )
        return property.value.elements.map((element) =>
          element === null
            ? ''
            : source
                .slice(element.start, element.end)
                .replace(/\s+/g, '')
                .replace(/,([}\]])/g, '$1'),
        );
  }
  return undefined;
}

const reactCompilerPlugin =
  "babel({presets:[reactCompilerPreset({panicThreshold:'none'})]})";
const routeTreeOptions = {
  target: 'react',
  autoCodeSplitting: true,
  routeTreeFileHeader: [],
  semicolons: true,
} as const;
const routerPlugin =
  "tanstackRouter({target:'react',autoCodeSplitting:true,routeTreeFileHeader:[],semicolons:true})";

function viteProblems(): Problem[] {
  const path = 'apps/web/vite.config.ts';
  const plugins = existsSync(path) ? vitePlugins(path) : undefined;
  return [
    ...(plugins?.includes(reactCompilerPlugin)
      ? []
      : [
          problem(
            'vite-config',
            `${path} runs the React Compiler with panicThreshold none, so the build a user gets is the one the compiler checks.`,
          ),
        ]),
    ...(plugins?.[0] === routerPlugin && plugins[1] === 'react()'
      ? []
      : [
          problem(
            'vite-config',
            `${path} runs ${routerPlugin} first and react() right after it, so the route tree the build uses is the one scripts/style.ts regenerates and compares.`,
          ),
        ]),
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

async function featureMapProblems(): Promise<Problem[]> {
  try {
    return unmappedRoutes(await loadJourneys()).map((found) =>
      problem('web-feature-map', found),
    );
  } catch (error) {
    return [
      problem(
        'web-feature-map',
        error instanceof Error ? error.message : String(error),
      ),
    ];
  }
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
              `${generatedRouteTree} differs from what TanStack Router generates from ${routes}; it is generated, never edited: run the web build or dev server and commit the file it writes.`,
            ),
          ]),
      ...rewritten.map(([file]) =>
        problem(
          'route-tree',
          `${join(routes, file)} is not what TanStack Router keeps it as; let the generator rewrite it through the web build or dev server and commit the result.`,
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
] as const;
const fastTasks = ['typecheck', 'test', ...rootTasks.slice(1)];

const gateScripts: Readonly<Record<string, Readonly<Record<string, string>>>> =
  {
    'package.json': {
      typecheck: 'tsc --noEmit',
      'typecheck:server':
        "tsc --noEmit && pnpm --filter '@porcelain/server...' -r typecheck",
      'lint:server': 'node scripts/style.ts lint server',
      'format:server:check': 'node scripts/style.ts format server',
      'arch:check': 'node scripts/architecture.ts check',
      probes: 'node scripts/probes.ts',
      test: 'vitest run',
      'test:integration': 'turbo run test:integration',
      'test:e2e': 'turbo run test:e2e',
      'db:check': 'pnpm --filter @porcelain/storage db:check',
      prepare: 'lefthook install --reset-hooks-path',
      'lint:web': 'node scripts/style.ts lint web',
      'format:web:check': 'node scripts/style.ts format web',
      'verify:web': 'node .agents/skills/web-verify/scripts/browser.ts',
      check: `turbo run ${fastTasks.join(' ')} --output-logs=errors-only`,
      'test:rules': 'node architecture/rule-tests.mjs',
      'probes:check': 'node scripts/probes.ts --check',
    },
    'apps/web/package.json': {
      typecheck: 'tsc --noEmit && tsc --noEmit -p tsconfig.node.json',
      build: 'tsc --noEmit && tsc --noEmit -p tsconfig.node.json && vite build',
    },
    'packages/storage/package.json': {
      'db:check': 'drizzle-kit check && node scripts/check-migrations.ts',
    },
  };

const turboConfig = {
  $schema: 'https://turborepo.dev/schema.json',
  agentGuidance: false,
  ui: 'stream',
  futureFlags: {
    affectedUsingTaskInputs: true,
    githubActionsRemoteBaseRefFallback: true,
  },
  globalEnv: ['CI'],
  tasks: {
    transit: { dependsOn: ['^transit'] },
    typecheck: {
      dependsOn: ['transit'],
      inputs: ['$TURBO_DEFAULT$', '$TURBO_ROOT$/tsconfig.json'],
    },
    test: {
      dependsOn: ['transit'],
      inputs: ['$TURBO_DEFAULT$', '$TURBO_ROOT$/vitest.config.ts'],
    },
    'test:integration': {
      dependsOn: ['transit'],
      inputs: ['$TURBO_DEFAULT$', '$TURBO_ROOT$/vitest.config.ts'],
    },
    'test:e2e': { dependsOn: ['transit'], cache: false },
    ...Object.fromEntries(rootTasks.map((task) => [`//#${task}`, {}])),
  },
};

function turboProblems(): Problem[] {
  return isDeepStrictEqual(strictJson('turbo.json'), turboConfig)
    ? []
    : [
        problem(
          'turbo-config',
          `turbo.json is the fast gate's wiring and holds exactly ${JSON.stringify(turboConfig)}: each package's typecheck and tests depend on the packages it imports through transit, every repository-wide check is a root task whose inputs are the whole repository, nothing turns a cache or an input off, and --affected follows each task's inputs and falls back to every task when it cannot resolve its base.`,
        ),
      ];
}

function scriptProblems(): Problem[] {
  const manifests = [
    'package.json',
    ...packageFolders.map((folder) => join(folder, 'package.json')),
  ];
  return [
    ...turboProblems(),
    ...manifests.flatMap((path) => {
      const scripts = existsSync(path)
        ? (manifestScriptsSchema.parse(strictJson(path)).scripts ?? {})
        : {};
      const folder = dirname(path);
      const expected = {
        ...(path === 'package.json' || path === 'packages/theme/package.json'
          ? {}
          : {
              typecheck: 'tsc --noEmit',
              test: `vitest run --config ../../vitest.config.ts --project @porcelain/${basename(folder)}`,
            }),
        ...gateScripts[path],
      };
      return Object.entries(expected).flatMap(([name, command]) =>
        scripts[name] === command
          ? []
          : [
              problem(
                'package-scripts',
                `${path} runs "${command}" as ${name}; a gate cannot be switched off from a package script.`,
              ),
            ],
      );
    }),
  ];
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

const browserConfigSchema = z.object({
  default: z.object({
    test: z.object({
      include: z.unknown(),
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
        'vitest.config.ts gives every package a project that requires assertions, allows no .only, fails with no specs and keeps the spec-discipline reporter.',
      ),
    );
  const browser = browserConfigSchema.safeParse(
    await load('.agents/skills/web-verify/scripts/vitest.browser.config.ts'),
  );
  const run = browser.success ? browser.data.default.test : undefined;
  if (
    run === undefined ||
    run.retry !== 0 ||
    !isDeepStrictEqual(run.include, [
      'spec/browser/*.browser.ts',
      'spec/negative/*.browser.ts',
    ]) ||
    run.browser.enabled !== true ||
    run.browser.headless !== true ||
    run.browser.provider.name !== 'playwright' ||
    run.browser.instances.some((instance) => instance.browser !== 'chromium')
  )
    problems.push(
      problem(
        'vitest-config',
        'the browser Vitest config runs every journey and negative once, with no retry, in headless Chromium through the Playwright provider.',
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
        'architecture/dependency-cruiser.cjs keeps its forbidden rules as errors, and the circular-import rule covers the server, web, desktop and every package.',
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

const cloneSchema = z.object({
  duplicates: z.array(
    z.object({
      lines: z.number(),
      firstFile: z.object({ name: z.string(), start: z.number() }),
      secondFile: z.object({ name: z.string(), start: z.number() }),
    }),
  ),
});

function duplicateFindings(): Finding[] {
  const scratch = mkdtempSync(join(tmpdir(), 'porcelain-duplicates-'));
  try {
    const result = spawnSync(
      join('node_modules', '.bin', 'jscpd'),
      [
        '--format',
        'typescript,tsx',
        '--min-tokens',
        '50',
        '--min-lines',
        '5',
        '--mode',
        'mild',
        '--ignore',
        '**/components/ui/**,**/routeTree.gen.ts,**/*.spec.ts',
        '--absolute',
        '--no-colors',
        '--reporters',
        'json',
        '--output',
        scratch,
        'apps/web/src',
      ],
      { encoding: 'utf8' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`jscpd failed:\n${result.stdout}${result.stderr}`);
    const report = cloneSchema.parse(
      JSON.parse(readFileSync(join(scratch, 'jscpd-report.json'), 'utf8')),
    );
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
        message: `${clone.lines} lines here repeat ${at(there?.name ?? '')}:${there?.start ?? 0}; a second copy is extracted into its owner (components/ui, shared/ or the feature), never pasted.`,
      })),
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
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
  const reported = [
    ...linted,
    ...compiled,
    ...(target === 'web' ? duplicateFindings() : []),
  ];
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
  const problems = [
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
    ...(target === 'web' ? await featureMapProblems() : []),
  ];
  for (const { rule, message } of problems)
    process.stderr.write(`error style(${rule}): ${message}\n`);
  if (problems.length > 0) process.exitCode = 1;
}
