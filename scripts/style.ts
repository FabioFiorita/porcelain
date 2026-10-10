import { Schema, Result } from 'effect';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { basename, join, relative } from 'node:path';
import {
  domainPackages,
  mobileNativeSourceProblem,
  generatedRouteTree,
  type StyleRule,
} from '../architecture/policy.ts';
import { pinProblems, uiFolder } from '../architecture/shadcn-pins.ts';
import {
  duplicateScope,
  scanDuplicates,
} from '../architecture/duplicate-policy.ts';

const mobileGeneratedTypes = 'apps/mobile/src/config/uniwind-types.d.ts';
const mobileMetroFile = 'apps/mobile/metro.config.cjs';
const mobileBabelFile = 'apps/mobile/babel.config.js';
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
  mobileBabelFile,
  'apps/desktop/src',
  'apps/desktop/spec',
  'apps/desktop/playwright.config.ts',
  'apps/server/src',
  'apps/server/spec',
  ...packages,
  'packages/storage/scripts',
  'architecture',
  'scripts',
  'vitest.config.ts',
  'vitest.integration.config.ts',
  '.agents/skills/server-verify/scripts',
  '.agents/skills/spec',
  '.agents/skills/verify-core',
  '.agents/skills/web-verify/scripts',
  '.agents/skills/desktop-verify/scripts',
  '.agents/skills/mobile-verify/scripts',
].filter((root) => existsSync(root));
const webRoots = [
  'apps/web/src',
  'apps/web/spec',
  'apps/web/vite.config.ts',
  'apps/web/dev-pair.ts',
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
        /^(?:apps\/mobile\/(?:ios|android|\.expo)|repos)$/.test(child)
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
    .filter(
      (path) =>
        existsSync(path) &&
        !path.startsWith('.claude/') &&
        !path.startsWith('repos/'),
    );
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
function mobileNativeSourceOwnership(files: readonly string[]): Problem[] {
  return files.flatMap((path) => {
    const message = mobileNativeSourceProblem(path);
    return message
      ? [
          problem(
            'mobile-native-source-owner',
            `${path}: ${message} This owner is enforced because native implementations must have one rendering boundary.`,
          ),
        ]
      : [];
  });
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
const lintPluginSchema = Schema.Struct({
  default: Schema.Struct({
    rules: Schema.Record(Schema.String, Schema.Unknown),
  }),
});
const lintConfigSchema = Schema.Struct({
  plugins: Schema.Array(Schema.String),
  jsPlugins: Schema.Array(Schema.String),
  options: Schema.Struct({
    typeAware: Schema.Literal(true),
  }),
  rules: Schema.Record(Schema.String, Schema.Unknown),
  overrides: Schema.Array(Schema.Unknown),
});
const tsconfigSchema = Schema.Struct({
  extends: Schema.optional(Schema.String),
  compilerOptions: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown),
  ),
  include: Schema.optional(Schema.Array(Schema.String)),
});
const formatConfigSchema = Schema.Struct({
  ignorePatterns: Schema.optional(Schema.Unknown),
});
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
  const config = Schema.decodeUnknownResult(lintConfigSchema, {
    onExcessProperty: 'error',
  })(strictJson('.oxlintrc.json'));
  if (!Result.isSuccess(config))
    return [
      problem(
        'lint-config',
        `.oxlintrc.json holds plugins, jsPlugins, options, rules and overrides only, because unsupported fields can bypass the shared lint policy: ${config.failure.message}`,
      ),
    ];
  const format = Schema.decodeUnknownResult(formatConfigSchema)(
    strictJson(formatConfig),
  );
  if (!Result.isSuccess(format) || format.success.ignorePatterns !== undefined)
    problems.push(
      problem(
        'format-config',
        `${formatConfig} ignores nothing; every file under the format roots is checked, because a second configuration can exclude code from the root format check.`,
      ),
    );
  const { plugins, jsPlugins, rules } = config.success;
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
  const plugin = Schema.decodeUnknownSync(lintPluginSchema)(
    await import(pluginPath),
  );
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
  const tsconfigs = filesUnder('.').filter((path) =>
    /(?:^|\/)tsconfig[^/]*\.json$/.test(path),
  );
  const rootOptions =
    Schema.decodeUnknownSync(tsconfigSchema)(strictJson('tsconfig.json'))
      .compilerOptions ?? {};
  for (const flag of strictnessFlags)
    if (rootOptions[flag] !== true)
      problems.push(
        problem(
          'tsconfig',
          `tsconfig.json sets ${flag} to true; every package and app compiles with the root's strictness, because loosening compiler scope or strictness lets unsafe code escape typechecking.`,
        ),
      );
  for (const path of tsconfigs) {
    const tsconfig = Schema.decodeUnknownSync(tsconfigSchema)(strictJson(path));
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
  const webTypes = Schema.decodeUnknownSync(tsconfigSchema)(
    strictJson('apps/web/tsconfig.json'),
  ).compilerOptions?.types;
  if (!isDeepStrictEqual(webTypes, ['vite/client']))
    problems.push(
      problem(
        'tsconfig',
        'apps/web/tsconfig.json sets "types": ["vite/client"] so Node globals do not compile in browser code; vite.config.ts gets Node through apps/web/tsconfig.node.json.',
      ),
    );
  return problems;
}
const diagnosticsSchema = Schema.Struct({
  number_of_files: Schema.Finite,
  diagnostics: Schema.Array(
    Schema.Struct({
      message: Schema.String,
      code: Schema.optional(Schema.String),
      severity: Schema.String,
      filename: Schema.String,
      labels: Schema.optional(
        Schema.Array(
          Schema.Struct({
            span: Schema.Struct({
              line: Schema.Finite,
              column: Schema.Finite,
            }),
          }),
        ),
      ),
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
function duplicateFindings(): Finding[] {
  if (target !== 'web') return [];
  const scope = duplicateScope();
  const report = scanDuplicates(process.cwd(), scope);
  const total = report.statistics.total;
  const unit = 'clones';
  process.stdout.write(
    `Duplicate code (${scope.name}): ${total.clones} clones, ${total.duplicatedLines} duplicated lines (limit ${scope.ceiling} ${unit}). ${scope.why}\n`,
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
      message: `${clone.lines} lines here repeat ${at(there?.name ?? '')}:${there?.start ?? 0}; ${scope.name} has ${report.count} ${unit}, above its ceiling of ${scope.ceiling}. ${scope.why} Extract the copy into its owner, because duplicated fixes drift between copies.`,
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
        path !== mobileBabelFile &&
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
  const parsed = Schema.decodeUnknownResult(diagnosticsSchema)(
    JSON.parse(result.stdout || '{}'),
  );
  if (!Result.isSuccess(parsed)) {
    process.stderr.write(result.stdout + result.stderr);
    return 1;
  }
  const linted: Finding[] = parsed.success.diagnostics.map((diagnostic) => ({
    rule: (diagnostic.code ?? '').replace(/^([a-z-]+)\((.+)\)$/, '$1/$2'),
    file: diagnostic.filename,
    line: diagnostic.labels?.[0]?.span.line ?? 0,
    column: diagnostic.labels?.[0]?.span.column ?? 0,
    code: `${diagnostic.severity} ${diagnostic.code ?? ''}`,
    message: diagnostic.message,
  }));
  const reported = [...linted, ...duplicateFindings()];
  for (const finding of reported)
    process.stdout.write(
      `${finding.file}:${finding.line}:${finding.column}: ${finding.code}: ${finding.message}\n`,
    );
  process.stdout.write(`${reported.length} findings.\n`);
  if (parsed.success.number_of_files !== files.length) {
    process.stdout.write(
      `lint skipped files: oxlint read ${parsed.success.number_of_files} of the ${files.length} files under the lint roots; nothing may hide a file from lint.\n`,
    );
    return 1;
  }
  return reported.length > 0 ? 1 : 0;
}
if (mode === 'format') {
  const result = spawnSync(
    join('node_modules', '.bin', 'oxfmt'),
    ['--check', ...roots, `!${mobileGeneratedTypes}`],
    {
      stdio: 'inherit',
    },
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
    ...mobileNativeSourceOwnership(files),
    ...(await configProblems().catch((error: unknown) => {
      if (error instanceof StyleProblem) return [error.problem];
      throw error;
    })),
    ...(target === 'web'
      ? pinProblems('.').map((found) => problem('shadcn-ui-pinned', found))
      : []),
  ];
  for (const { rule, message } of problems)
    process.stderr.write(`error style(${rule}): ${message}\n`);
  if (problems.length > 0) process.exitCode = 1;
}
