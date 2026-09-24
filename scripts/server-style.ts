import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { domainPackages, type StyleRule } from '../architecture/policy.ts';
import {
  liveRuleNames,
  probeSchema,
  unknownRule,
} from '../architecture/probe.ts';

const mode = process.argv[2];
if (mode !== 'lint' && mode !== 'format')
  throw new Error('Usage: node scripts/server-style.ts lint|format');

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

const roots = [
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
].filter((root) => existsSync(root));

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
      return skippedDirectories.has(entry.name) ? [] : filesUnder(child);
    return entry.isFile() ? [child] : [];
  });
}

function disableDirectives(): Problem[] {
  return roots.flatMap(filesUnder).flatMap((file) =>
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

function codeOutsideLintRoots(): Problem[] {
  const listed = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (listed.error) throw listed.error;
  return listed.stdout
    .split('\n')
    .filter(
      (path) =>
        lintedFile.test(path) &&
        existsSync(path) &&
        !path.startsWith('apps/web/') &&
        !path.startsWith('.claude/') &&
        !roots.some((root) => path === root || path.startsWith(`${root}/`)),
    )
    .map((path) =>
      problem(
        'code-outside-lint-roots',
        `${path}: code lives under a lint root (${roots.join(', ')}); a file outside them escapes lint, the disable-directive scan and the format check.`,
      ),
    );
}

const ciSchema = z.strictObject({
  workflow: z.array(z.string()),
  prePush: z.array(z.string()),
});

function ciProblems(): Problem[] {
  const sanctioned = ciSchema.parse(
    strictJson('architecture/sanctioned/ci.json'),
  );
  const workflow = [
    ...readFileSync('.github/workflows/server.yml', 'utf8').matchAll(
      /^\s*(?:- )?run: (.+)$/gm,
    ),
  ].map((match) => match[1] ?? '');
  const prePush = readFileSync('.githooks/pre-push', 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '');
  return [
    ...(isDeepStrictEqual(workflow, sanctioned.workflow)
      ? []
      : [
          problem(
            'ci-steps',
            '.github/workflows/server.yml runs the steps architecture/sanctioned/ci.json lists, in that order; a gate leaves CI only through the sanctioned list.',
          ),
        ]),
    ...(isDeepStrictEqual(prePush, sanctioned.prePush)
      ? []
      : [
          problem(
            'ci-steps',
            '.githooks/pre-push runs the lines architecture/sanctioned/ci.json lists; a gate leaves the hook only through the sanctioned list.',
          ),
        ]),
  ];
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

const ruleListSchema = z.strictObject({
  porcelain: z.array(z.string()),
  typescript: z.array(z.string()),
  style: z.array(z.string()),
  arch: z.array(z.string()),
});

const probeModuleSchema = z.object({ default: z.unknown() });

const tsconfigSchema = z.object({
  extends: z.string().optional(),
  compilerOptions: z.record(z.string(), z.unknown()).optional(),
  include: z.array(z.string()).optional(),
});

const sanctionedFilesSchema = z.record(z.string(), z.unknown());
const sanctionedScriptsSchema = z.record(
  z.string(),
  z.record(z.string(), z.string()),
);
const manifestScriptsSchema = z.object({
  scripts: z.record(z.string(), z.string()).optional(),
});
const configModuleSchema = z.object({ default: z.unknown() });

const packageFolders = [
  'apps/server',
  ...packageNames.map((name) => join('packages', name)),
];

const tsconfigPackageOptions: ReadonlySet<string> = new Set(['types', 'lib']);

const sanctionedOverrides: readonly unknown[] = [
  {
    files: ['architecture/*.mjs', 'architecture/*.cjs'],
    rules: {
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-return': 'off',
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
  strictJson('.oxfmtrc.json');
  if (
    !isDeepStrictEqual(
      strictJson('.oxlintrc.json'),
      strictJson('architecture/lint-config.json'),
    )
  )
    problems.push(
      problem(
        'lint-config',
        '.oxlintrc.json differs from architecture/lint-config.json; the lint configuration is pinned whole, plugins, rules and overrides alike.',
      ),
    );
  const { jsPlugins, rules, overrides } = config.data;
  if (!isDeepStrictEqual(jsPlugins, ['./architecture/oxlint-plugin.mjs']))
    problems.push(
      problem(
        'lint-config',
        '.oxlintrc.json loads ./architecture/oxlint-plugin.mjs only.',
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
  if (!isDeepStrictEqual(overrides, sanctionedOverrides))
    problems.push(
      problem(
        'lint-config',
        '.oxlintrc.json overrides only the plugin files; a per-file override is a disable directive.',
      ),
    );
  const tsconfigs = filesUnder('.').filter((path) =>
    /(?:^|\/)tsconfig[^/]*\.json$/.test(path),
  );
  const sanctionedTsconfigs = sanctionedFilesSchema.parse(
    strictJson('architecture/sanctioned/tsconfigs.json'),
  );
  for (const path of [
    'tsconfig.json',
    ...packageFolders.map((folder) => join(folder, 'tsconfig.json')),
  ])
    if (!(path in sanctionedTsconfigs))
      problems.push(
        problem(
          'tsconfig',
          `${path} has no sanctioned copy in architecture/sanctioned/tsconfigs.json; every tsconfig a gate compiles with is pinned.`,
        ),
      );
  for (const [path, sanctioned] of Object.entries(sanctionedTsconfigs))
    if (!existsSync(path) || !isDeepStrictEqual(strictJson(path), sanctioned))
      problems.push(
        problem(
          'tsconfig',
          `${path} differs from its sanctioned copy in architecture/sanctioned/tsconfigs.json; the compiler options a gate runs with change only there, where the change is visible.`,
        ),
      );
  for (const path of tsconfigs) {
    const tsconfig = tsconfigSchema.parse(strictJson(path));
    const owner = /^(?:packages\/([^/]+)|apps\/(server))\/tsconfig\.json$/.exec(
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
  problems.push(...scriptProblems());
  problems.push(...ciProblems());
  problems.push(...(await configModuleProblems()));
  problems.push(...(await ruleProblems()));
  return problems;
}

function scriptProblems(): Problem[] {
  const problems: Problem[] = [];
  const sanctioned = sanctionedScriptsSchema.parse(
    strictJson('architecture/sanctioned/scripts.json'),
  );
  for (const folder of packageFolders)
    if (!(join(folder, 'package.json') in sanctioned))
      problems.push(
        problem(
          'package-scripts',
          `${join(folder, 'package.json')} has no sanctioned scripts in architecture/sanctioned/scripts.json; every package runs the type gate.`,
        ),
      );
  for (const [path, scripts] of Object.entries(sanctioned)) {
    const manifest = existsSync(path)
      ? manifestScriptsSchema.parse(strictJson(path))
      : undefined;
    for (const [name, command] of Object.entries(scripts))
      if (manifest?.scripts?.[name] !== command)
        problems.push(
          problem(
            'package-scripts',
            `${path} runs "${command}" as ${name}, as architecture/sanctioned/scripts.json pins it; a gate cannot be switched off from a package script.`,
          ),
        );
  }
  return problems;
}

function pinnedShape(value: unknown, root: string): unknown {
  if (typeof value === 'function') return '<function>';
  if (value === root) return '<root>';
  if (Array.isArray(value))
    return value.map((entry: unknown) => pinnedShape(entry, root));
  if (typeof value === 'object' && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        pinnedShape(entry, root),
      ]),
    );
  return value;
}

async function configModuleProblems(): Promise<Problem[]> {
  const root = resolve('.');
  const pinned = [
    {
      rule: 'vitest-config',
      module: 'vitest.config.ts',
      sanctioned: 'architecture/sanctioned/vitest.json',
      why: 'every project keeps its include, setup files and expect settings, requireAssertions among them, and the run keeps the spec-discipline reporter',
    },
    {
      rule: 'cruiser-config',
      module: 'architecture/dependency-cruiser.cjs',
      sanctioned: 'architecture/sanctioned/dependency-cruiser.json',
      why: 'the forbidden rules keep their names, severity and from/to scope, and the resolution options stay as they are',
    },
  ] as const;
  const problems: Problem[] = [];
  for (const { rule, module, sanctioned, why } of pinned) {
    const loaded = configModuleSchema.parse(
      await import(pathToFileURL(resolve(module)).href),
    );
    if (
      !isDeepStrictEqual(
        pinnedShape(loaded.default, root),
        strictJson(sanctioned),
      )
    )
      problems.push(
        problem(
          rule,
          `${module} differs from ${sanctioned}; ${why}. A change to the gate is made in the sanctioned copy, where it is visible.`,
        ),
      );
  }
  return problems;
}

function sortedNames(names: readonly string[]): string[] {
  return names.toSorted((left, right) => left.localeCompare(right));
}

async function ruleProblems(): Promise<Problem[]> {
  const problems: Problem[] = [];
  const live = await liveRuleNames('.');
  const sanctioned = ruleListSchema.parse(
    strictJson('architecture/rules.json'),
  );
  for (const family of ['porcelain', 'typescript', 'style', 'arch'] as const)
    if (!isDeepStrictEqual(live[family], sortedNames(sanctioned[family])))
      problems.push(
        problem(
          'rule-list',
          `the ${family} rules differ from architecture/rules.json (live: ${live[family].filter((name) => !sanctioned[family].includes(name)).join(', ') || 'none added'}; sanctioned: ${sanctioned[family].filter((name) => !live[family].includes(name)).join(', ') || 'none removed'}); a rule is added or removed in the sanctioned list, where the change is visible.`,
        ),
      );
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

function lint(): number {
  const files = roots
    .flatMap(filesUnder)
    .filter((path) => lintedFile.test(path));
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
  const findings = parsed.data.diagnostics.map((diagnostic) => ({
    ...diagnostic,
    rule: (diagnostic.code ?? '').replace(
      /^porcelain\((.+)\)$/,
      'porcelain/$1',
    ),
    file: diagnostic.filename,
  }));
  for (const finding of findings) {
    const span = finding.labels?.[0]?.span;
    process.stdout.write(
      `${finding.filename}:${span?.line ?? 0}:${span?.column ?? 0}: ${finding.severity} ${finding.code ?? ''}: ${finding.message}\n`,
    );
  }
  process.stdout.write(`${findings.length} findings.\n`);
  if (parsed.data.number_of_files !== files.length) {
    process.stdout.write(
      `lint skipped files: oxlint read ${parsed.data.number_of_files} of the ${files.length} files under the lint roots; nothing may hide a file from lint.\n`,
    );
    return 1;
  }
  return findings.length > 0 ? 1 : 0;
}

if (mode === 'format') {
  const result = spawnSync(
    join('node_modules', '.bin', 'oxfmt'),
    ['--check', ...roots],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} else {
  process.exitCode = lint();
  const problems = [
    ...disableDirectives(),
    ...strayLintConfigs(),
    ...codeOutsideLintRoots(),
    ...(await configProblems().catch((error: unknown) => {
      if (error instanceof StyleProblem) return [error.problem];
      throw error;
    })),
  ];
  for (const { rule, message } of problems)
    process.stderr.write(`error style(${rule}): ${message}\n`);
  if (problems.length > 0) process.exitCode = 1;
}
