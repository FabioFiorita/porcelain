import { Schema } from 'effect';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cruise,
  type ICruiseResult,
  type IReporterOutput,
} from 'dependency-cruiser';
import extractDepcruiseOptions from 'dependency-cruiser/config-utl/extract-depcruise-options';
import web from '../apps/web/vite.config.ts';
import { typeRuleFindings } from '../architecture/type-rules.ts';
import { knipFindings } from '../architecture/knip.ts';
import {
  mobileMetroFile,
  mobileMetroValid,
  mobileGeneratedTypes,
  mobileGeneratedTypesValid,
  mobileStyleFile,
  mobileStylesValid,
  themeManifestValid,
  themeTokenFile,
  themeTokensValid,
} from '../architecture/theme-policy.ts';
const config = Schema.decodeUnknownSync(
  Schema.Struct({
    forbidden: Schema.Array(
      Schema.Struct({
        name: Schema.String,
        comment: Schema.optional(Schema.String),
      }),
    ),
  }),
)(createRequire(import.meta.url)('../architecture/dependency-cruiser.cjs'));
function report(result: IReporterOutput): ICruiseResult {
  if (typeof result.output === 'string')
    throw new Error('Dependency scan must return its native graph.');
  return result.output;
}
type Finding = { rule: string; from: string; to: string };
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageNames = readdirSync(join(repositoryRoot, 'packages'), {
  withFileTypes: true,
})
  .filter(
    (entry) =>
      entry.isDirectory() &&
      existsSync(join(repositoryRoot, 'packages', entry.name, 'src')),
  )
  .map((entry) => entry.name);
const sourceRoots = [
  'apps/desktop/src',
  'apps/desktop/spec',
  'apps/server/src',
  'apps/server/spec',
  '.agents/skills/web-verify/scripts',
  ...packageNames.flatMap((name) => [
    `packages/${name}/src`,
    `packages/${name}/spec`,
  ]),
  '.agents/skills/server-verify/scripts',
  '.agents/skills/verify-core',
  '.agents/skills/desktop-verify/scripts',
  'apps/mobile/spec',
  '.agents/skills/mobile-verify/scripts',
].filter((root) => existsSync(join(repositoryRoot, root)));
const mobileRoots = ['apps/mobile/src'];
const mobileConfig = 'apps/mobile/app.config.ts';
const webRoots = ['apps/web/src', 'apps/web/spec'];
const webConfigs = [
  'apps/web/vite.config.ts',
  'apps/web/vitest.config.ts',
  'apps/web/playwright.config.ts',
];
const allRoots = [...sourceRoots, ...webRoots, ...mobileRoots];
const ignoredDirectories = new Set([
  'node_modules',
  'dist',
  '.vite',
  '.turbo',
  'test-results',
]);
const ignoredFile = /(?:^\.DS_Store|\.tsbuildinfo)$/;
const codeFile = /\.[cm]?[jt]sx?$/;
function filesUnder(directory: string): string[] {
  if (!existsSync(join(repositoryRoot, directory))) return [];
  return readdirSync(join(repositoryRoot, directory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      return ignoredDirectories.has(entry.name) ||
        /^apps\/mobile\/(?:ios|android|\.expo)$/.test(path)
        ? []
        : filesUnder(path);
    return entry.isFile() && !ignoredFile.test(entry.name) ? [path] : [];
  });
}
function sourceFiles(directory: string): string[] {
  return filesUnder(directory).filter((path) => codeFile.test(path));
}
function themeFindings(): Finding[] {
  const findings: Finding[] = [];
  for (const path of filesUnder('packages/theme')) {
    const source = readFileSync(join(repositoryRoot, path), 'utf8');
    const valid =
      path === themeTokenFile
        ? themeTokensValid(source)
        : path === 'packages/theme/package.json' &&
          themeManifestValid(JSON.parse(source));
    if (!valid)
      findings.push({
        rule: 'theme-data-only',
        from: path,
        to: 'the CSS token module and its dependency-free public export manifest',
      });
  }
  if (
    !existsSync(join(repositoryRoot, mobileMetroFile)) ||
    !mobileMetroValid(
      readFileSync(join(repositoryRoot, mobileMetroFile), 'utf8'),
    )
  )
    findings.push({
      rule: 'mobile-style-config',
      from: mobileMetroFile,
      to: 'the documented Uniwind Metro integration and its owned CSS and generated type paths',
    });
  if (
    !existsSync(join(repositoryRoot, mobileGeneratedTypes)) ||
    !mobileGeneratedTypesValid(
      readFileSync(join(repositoryRoot, mobileGeneratedTypes), 'utf8'),
    )
  )
    findings.push({
      rule: 'mobile-style-config',
      from: mobileGeneratedTypes,
      to: 'the exact Uniwind-generated light/dark module augmentation',
    });
  if (
    !existsSync(join(repositoryRoot, mobileStyleFile)) ||
    !mobileStylesValid(
      readFileSync(join(repositoryRoot, mobileStyleFile), 'utf8'),
    )
  )
    findings.push({
      rule: 'mobile-style-config',
      from: mobileStyleFile,
      to: 'the Tailwind, Uniwind and public shared theme imports followed only by native token declarations',
    });
  const styles = allRoots
    .flatMap(filesUnder)
    .filter((path) => path.endsWith('.css'));
  for (const path of styles) {
    const source = readFileSync(join(repositoryRoot, path), 'utf8');
    for (const imported of source.matchAll(
      /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g,
    )) {
      const specifier = imported[1] ?? '';
      if (
        !specifier.startsWith('@porcelain/theme') &&
        !specifier.includes('packages/theme/')
      )
        continue;
      if (
        specifier !== '@porcelain/theme/tokens.css' ||
        !/^apps\/(?:web|mobile)\/src\/[^/]+\.css$/.test(path)
      )
        findings.push({
          rule: 'theme-imports-stylesheets-only',
          from: path,
          to: specifier,
        });
    }
  }
  return findings;
}
const webResolveSchema = Schema.Struct({
  resolve: Schema.Struct({
    alias: Schema.Record(Schema.String, Schema.String),
  }),
});
async function scan(sources: readonly string[]): Promise<ICruiseResult[]> {
  const options = await extractDepcruiseOptions(
    join(repositoryRoot, 'architecture/dependency-cruiser.cjs'),
  );
  const shared = report(
    await cruise([...sourceRoots, ...webRoots, ...webConfigs], options, {
      alias: Schema.decodeUnknownSync(webResolveSchema)(web).resolve.alias,
    }),
  );
  const native = await Promise.all(
    ['ios', 'android'].map(async (platform) =>
      report(
        await cruise([...mobileRoots, mobileConfig, mobileMetroFile], {
          ...options,
          doNotFollow: { path: 'node_modules|^apps/(?:web|server|desktop)/' },
          enhancedResolveOptions: {
            ...options.enhancedResolveOptions,
            extensions: [
              `.${platform}.ts`,
              `.${platform}.tsx`,
              '.ts',
              '.tsx',
              '.js',
              '.json',
            ],
          },
        }),
      ),
    ),
  );
  const reports = [shared, ...native];
  const scanned = new Set(
    reports.flatMap((entry) => entry.modules.map((module) => module.source)),
  );
  const missing = sources.filter((file) => !scanned.has(file));
  if (scanned.size === 0 || missing.length > 0)
    throw new Error(
      `Dependency scan omitted source files: ${missing.join(', ')}`,
    );
  return reports;
}
try {
  if (process.argv[2] !== 'check')
    throw new Error('Usage: pnpm arch:check [--all]');
  const sources = [
    ...allRoots.flatMap(sourceFiles),
    ...webConfigs,
    mobileConfig,
    mobileMetroFile,
  ];
  const reports = await scan(sources);
  const violations: Finding[] = [
    ...reports
      .flatMap((report) => report.summary.violations)
      .map((entry) => ({
        rule: entry.rule.name,
        from: entry.from,
        to: entry.to,
      })),
    ...themeFindings(),
    ...typeRuleFindings(repositoryRoot),
    ...knipFindings(repositoryRoot),
  ];
  const byRule = new Map<string, Finding[]>();
  for (const finding of violations) {
    const group = byRule.get(finding.rule) ?? [];
    group.push(finding);
    byRule.set(finding.rule, group);
  }
  const all = process.argv.includes('--all');
  for (const [rule, entries] of [...byRule].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    process.stdout.write(`${rule}: ${entries.length}\n`);
    const reason = config.forbidden.find(
      (entry) => entry.name === rule,
    )?.comment;
    if (reason) process.stdout.write(`  why: ${reason}\n`);
    for (const entry of all ? entries : entries.slice(0, 3))
      process.stdout.write(`  ${entry.from} -> ${entry.to}\n`);
    if (!all && entries.length > 3)
      process.stdout.write(`  ... ${entries.length - 3} more (use --all)\n`);
  }
  process.stdout.write(
    `${violations.length} violations; ${sources.length} source files scanned; ${reports.reduce((total, report) => total + (report.summary.totalDependenciesCruised ?? 0), 0)} dependencies\n`,
  );
  if (violations.length > 0) process.exitCode = 1;
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
