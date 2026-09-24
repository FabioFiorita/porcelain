import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
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
].filter((root) => existsSync(root));

const disableDirective = /(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable|enable)/;
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
  compilerOptions: z
    .object({ types: z.array(z.string()).optional() })
    .optional(),
  include: z.array(z.string()).optional(),
});

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
  for (const path of tsconfigs) {
    const tsconfig = tsconfigSchema.parse(strictJson(path));
    const owner = /^(?:packages\/([^/]+)|apps\/(server))\/tsconfig\.json$/.exec(
      path,
    );
    const name = owner?.[1] ?? owner?.[2];
    if (name === undefined) continue;
    for (const pattern of ['src/**/*.ts', 'spec/**/*.ts'])
      if (!tsconfig.include?.includes(pattern))
        problems.push(`${path} includes ${pattern}.`);
    if (
      typesFreePackages.has(name) &&
      !isDeepStrictEqual(tsconfig.compilerOptions?.types, [])
    )
      problems.push(
        `${path} sets "types": [] so Node globals do not compile in a domain.`,
      );
  }
  return problems;
}

const executable = join(
  'node_modules',
  '.bin',
  mode === 'lint' ? 'oxlint' : 'oxfmt',
);
const options =
  mode === 'lint'
    ? [
        '--type-aware',
        '--report-unused-disable-directives',
        '--max-warnings',
        '0',
      ]
    : ['--check'];
const result = spawnSync(executable, [...options, ...roots], {
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
if (mode === 'lint') {
  const directives = disableDirectives();
  for (const location of directives)
    process.stderr.write(
      `${location}: fix the code instead of disabling a rule; disable directives are not allowed.\n`,
    );
  const problems = await configProblems().catch((error: unknown) => [
    error instanceof Error ? error.message : String(error),
  ]);
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  if (directives.length > 0 || problems.length > 0) process.exitCode = 1;
}
