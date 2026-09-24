import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { basename, join } from 'node:path';
import { z } from 'zod';
import { domainPackages } from '../architecture/policy.ts';

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

function disableDirectives(): string[] {
  return roots.flatMap(filesUnder).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        disableDirective.test(line) ? [`${file}:${index + 1}`] : [],
      ),
  );
}

function strayLintConfigs(): string[] {
  return filesUnder('.')
    .filter(
      (path) => path !== lintConfig && strayLintConfig.test(basename(path)),
    )
    .map(
      (path) =>
        `${path}: lint reads one configuration, the root ${lintConfig}, with no ignore files; remove this file.`,
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

const tsconfigSchema = z.object({
  compilerOptions: z.record(z.string(), z.unknown()).optional(),
  include: z.array(z.string()).optional(),
});

const sanctionedRootCompilerOptions: Readonly<Record<string, unknown>> = {
  target: 'ES2024',
  module: 'NodeNext',
  moduleResolution: 'NodeNext',
  lib: ['ES2024'],
  types: ['node'],
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  verbatimModuleSyntax: true,
  allowImportingTsExtensions: true,
  erasableSyntaxOnly: true,
  skipLibCheck: true,
  noEmit: true,
};

const sanctionedDomainTsconfig: Readonly<Record<string, unknown>> = {
  extends: '../../tsconfig.json',
  compilerOptions: { types: [] },
  include: [
    'src/**/*.ts',
    'spec/**/*.ts',
    '../../architecture/platform/domain-globals.d.ts',
  ],
};

const pinnedTsconfigPackages = new Set<string>([...domainPackages, 'kernel']);

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

function strictJson(path: string): unknown {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return parsed;
  } catch (error) {
    throw new Error(
      `${path} is not strict JSON; configuration carries no comments or trailing commas (${error instanceof Error ? error.message : String(error)}).`,
    );
  }
}

function isError(level: unknown): boolean {
  return level === 'error' || (Array.isArray(level) && level[0] === 'error');
}

async function configProblems(): Promise<string[]> {
  const problems: string[] = [];
  const config = lintConfigSchema.safeParse(strictJson('.oxlintrc.json'));
  if (!config.success)
    return [
      `.oxlintrc.json holds plugins, jsPlugins, options, rules and overrides only: ${config.error.message}`,
    ];
  strictJson('.oxfmtrc.json');
  if (
    !isDeepStrictEqual(
      strictJson('.oxlintrc.json'),
      strictJson('architecture/lint-config.json'),
    )
  )
    problems.push(
      '.oxlintrc.json differs from architecture/lint-config.json; the lint configuration is pinned whole, plugins, rules and overrides alike.',
    );
  const { jsPlugins, rules, overrides } = config.data;
  if (!isDeepStrictEqual(jsPlugins, ['./architecture/oxlint-plugin.mjs']))
    problems.push(
      '.oxlintrc.json loads ./architecture/oxlint-plugin.mjs only.',
    );
  const pluginPath = new URL(
    '../architecture/oxlint-plugin.mjs',
    import.meta.url,
  ).href;
  const plugin = pluginSchema.parse(await import(pluginPath));
  for (const name of Object.keys(plugin.default.rules))
    if (!isError(rules[`porcelain/${name}`]))
      problems.push(`.oxlintrc.json sets porcelain/${name} to "error".`);
  for (const [name, level] of Object.entries(rules)) {
    if (!isError(level))
      problems.push(
        `.oxlintrc.json turns ${name} on as "error" or leaves it out.`,
      );
    if (
      name.startsWith('porcelain/') &&
      !(name.slice('porcelain/'.length) in plugin.default.rules)
    )
      problems.push(
        `.oxlintrc.json names ${name}, which the plugin does not define.`,
      );
  }
  if (!isDeepStrictEqual(overrides, sanctionedOverrides))
    problems.push(
      '.oxlintrc.json overrides only the plugin files; a per-file override is a disable directive.',
    );
  const tsconfigs = filesUnder('.').filter((path) =>
    /(?:^|\/)tsconfig[^/]*\.json$/.test(path),
  );
  if (
    !isDeepStrictEqual(
      tsconfigSchema.parse(strictJson('tsconfig.json')).compilerOptions,
      sanctionedRootCompilerOptions,
    )
  )
    problems.push(
      'tsconfig.json compilerOptions differ from the sanctioned block in scripts/server-style.ts; every package inherits them.',
    );
  for (const path of tsconfigs) {
    const raw = strictJson(path);
    const tsconfig = tsconfigSchema.parse(raw);
    const owner = /^(?:packages\/([^/]+)|apps\/(server))\/tsconfig\.json$/.exec(
      path,
    );
    const name = owner?.[1] ?? owner?.[2];
    if (name === undefined) continue;
    for (const pattern of ['src/**/*.ts', 'spec/**/*.ts'])
      if (!tsconfig.include?.includes(pattern))
        problems.push(`${path} includes ${pattern}.`);
    if (
      pinnedTsconfigPackages.has(name) &&
      !isDeepStrictEqual(raw, sanctionedDomainTsconfig)
    )
      problems.push(
        `${path} differs from the sanctioned domain tsconfig in scripts/server-style.ts; a domain compiles with types [], lib ES2024 and the domain globals only.`,
      );
    if (
      typesFreePackages.has(name) &&
      !isDeepStrictEqual(tsconfig.compilerOptions, { types: [] })
    )
      problems.push(
        `${path} sets "types": [] so Node globals do not compile in a domain.`,
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
  const directives = disableDirectives();
  for (const location of directives)
    process.stderr.write(
      `${location}: fix the code instead of disabling a rule; disable directives are not allowed.\n`,
    );
  const problems = [
    ...strayLintConfigs(),
    ...(await configProblems().catch((error: unknown) => [
      error instanceof Error ? error.message : String(error),
    ])),
  ];
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  if (directives.length > 0 || problems.length > 0) process.exitCode = 1;
}
