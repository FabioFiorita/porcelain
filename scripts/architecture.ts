import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  classify,
  domainPackages,
  forbiddenExternal,
  gitCapabilityViolation,
  helpersFolderViolation,
  nestedInRoleFolder,
  requiredServerFiles,
  runtimeNodeViolation,
  targetPackageExports,
  violation,
  type Classification,
} from '../architecture/policy.ts';
import { typeRuleFindings } from '../architecture/type-rules.ts';

const dependencySchema = z.object({
  module: z.string(),
  resolved: z.string(),
  couldNotResolve: z.boolean(),
});

const cruiseReportSchema = z.object({
  modules: z.array(
    z.object({ source: z.string(), dependencies: z.array(dependencySchema) }),
  ),
  summary: z.object({
    totalCruised: z.number(),
    totalDependenciesCruised: z.number(),
    violations: z.array(
      z.object({
        from: z.string(),
        to: z.string(),
        rule: z.object({ name: z.string(), severity: z.string() }),
      }),
    ),
  }),
});
type CruiseReport = z.output<typeof cruiseReportSchema>;

type Finding = { rule: string; from: string; to: string };

const manifestSchema = z.object({
  exports: z.record(z.string(), z.string()).optional(),
});
type Manifest = z.output<typeof manifestSchema>;

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
  'apps/server/src',
  'apps/server/spec',
  ...packageNames.flatMap((name) => [
    `packages/${name}/src`,
    `packages/${name}/spec`,
  ]),
].filter((root) => existsSync(join(repositoryRoot, root)));

const ignoredDirectories = new Set(['node_modules', 'dist', '.vite', '.turbo']);
const ignoredFile = /(?:^\.DS_Store|\.tsbuildinfo)$/;
const codeFile = /\.[cm]?[jt]sx?$/;

function filesUnder(directory: string): string[] {
  if (!existsSync(join(repositoryRoot, directory))) return [];
  return readdirSync(join(repositoryRoot, directory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      return ignoredDirectories.has(entry.name) ? [] : filesUnder(path);
    return entry.isFile() && !ignoredFile.test(entry.name) ? [path] : [];
  });
}

function sourceFiles(directory: string): string[] {
  return filesUnder(directory).filter((path) => codeFile.test(path));
}

const permittedOutsideRoots: readonly RegExp[] = [
  /^(?:packages\/[^/]+|apps\/server)\/(?:package|tsconfig)\.json$/,
  /^packages\/storage\/drizzle\/(?:meta\/)?[^/]+\.(?:sql|json)$/,
  /^packages\/storage\/drizzle\.config\.ts$/,
  /^packages\/storage\/scripts\/[^/]+\.ts$/,
  /^apps\/web\//,
];
const insideRoot = /^(?:packages\/[^/]+|apps\/server)\/(?:src|spec)\//;
const fixtureData = /^packages\/[^/]+\/spec\/fixtures\//;

function placementFindings(): Finding[] {
  const files = [...filesUnder('packages'), ...filesUnder('apps')];
  return files.flatMap((path) => {
    if (insideRoot.test(path)) {
      if (/\.ts$/.test(path) && !/\.[cm]ts$/.test(path)) return [];
      if (fixtureData.test(path) && !codeFile.test(path)) return [];
      return [
        {
          rule: 'code-outside-roots',
          from: path,
          to: 'src/ and spec/ hold .ts files only; fixture data lives in spec/fixtures/',
        },
      ];
    }
    if (permittedOutsideRoots.some((pattern) => pattern.test(path))) return [];
    return [
      {
        rule: 'code-outside-roots',
        from: path,
        to: 'packages/ and apps/ hold package folders only; a package holds package.json, tsconfig.json, src/ and spec/, and storage also drizzle/, drizzle.config.ts and scripts/*.ts',
      },
    ];
  });
}

function isRepositoryPath(resolved: string): boolean {
  return (
    !resolved.split('/').includes('node_modules') &&
    existsSync(join(repositoryRoot, resolved))
  );
}

function scan(sources: readonly string[]): CruiseReport {
  const result = spawnSync(
    join(repositoryRoot, 'node_modules/.bin/depcruise'),
    [
      '--config',
      'architecture/dependency-cruiser.cjs',
      '--output-type',
      'json',
      ...sourceRoots,
    ],
    { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || 'Dependency scan failed');
  const report: CruiseReport = cruiseReportSchema.parse(
    JSON.parse(result.stdout),
  );
  const scanned = new Set(report.modules.map((module) => module.source));
  const missing = sources.filter((file) => !scanned.has(file));
  if (report.summary.totalCruised === 0 || missing.length > 0)
    throw new Error(
      `Dependency scan omitted source files: ${missing.join(', ')}`,
    );
  const unresolved = report.modules.flatMap((module) =>
    module.dependencies
      .filter(
        (dependency) =>
          dependency.couldNotResolve &&
          dependency.module.startsWith('@porcelain/'),
      )
      .map((dependency) => `${module.source} -> ${dependency.module}`),
  );
  if (unresolved.length > 0)
    throw new Error(
      `Workspace imports did not resolve:\n${unresolved.join('\n')}`,
    );
  return report;
}

function readManifest(name: string): Manifest | undefined {
  const path = join(repositoryRoot, 'packages', name, 'package.json');
  return existsSync(path)
    ? manifestSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
    : undefined;
}

function packageExportFindings(): Finding[] {
  const result: Finding[] = [];
  for (const sourceRoot of sourceRoots.filter(
    (root) => root.startsWith('packages/') && root.endsWith('/src'),
  )) {
    const name = sourceRoot.split('/')[1] ?? '';
    const planned = targetPackageExports[name] ?? {};
    for (const [key, target] of Object.entries(
      readManifest(name)?.exports ?? {},
    ))
      if (planned[key] !== target)
        result.push({
          rule: 'unclassified-package-export',
          from: `packages/${name}/package.json`,
          to: `${key} -> ${target}`,
        });
  }
  for (const [name, expected] of Object.entries(targetPackageExports)) {
    const manifest = readManifest(name);
    if (!manifest) {
      result.push({
        rule: 'missing-target-package',
        from: `packages/${name}`,
        to: 'package.json',
      });
      continue;
    }
    for (const [entry, target] of Object.entries(expected))
      if (
        manifest.exports?.[entry] !== target ||
        !existsSync(join(repositoryRoot, 'packages', name, target))
      )
        result.push({
          rule: 'missing-target-export',
          from: `packages/${name}`,
          to: `${entry} -> ${target}`,
        });
  }
  return result;
}

const useCaseFile = new RegExp(
  `^(?:${domainPackages.join('|')})/[a-z0-9]+(?:-[a-z0-9]+)*\\.ts$`,
);

function structureFindings(
  sources: readonly string[],
  classified: ReadonlyMap<string, Classification>,
): Finding[] {
  const result: Finding[] = [];
  for (const path of requiredServerFiles)
    if (!existsSync(join(repositoryRoot, path)))
      result.push({
        rule: 'missing-server-structure',
        from: path,
        to: 'required',
      });
  const helpersFolders = new Set<string>();
  for (const path of sources)
    if (helpersFolderViolation(path))
      helpersFolders.add(
        path.slice(0, path.lastIndexOf('/helpers/') + '/helpers'.length),
      );
  for (const folder of helpersFolders)
    result.push({
      rule: 'no-helpers-folder',
      from: folder,
      to: 'name the module after what it does',
    });
  for (const [path, info] of classified) {
    if (/^apps\/server\/src\/http\/routes\/[^/]+\.ts$/.test(path))
      result.push({
        rule: 'flat-http-route',
        from: path,
        to: 'http/routes/<feature>/<operation>.ts',
      });
    if (
      info.role === 'use-case' &&
      !useCaseFile.test(path.slice('apps/server/src/use-cases/'.length))
    )
      result.push({
        rule: 'use-case-file-name',
        from: path,
        to: 'use-cases/<area>/<verb-noun>.ts',
      });
    if (info.role === 'service' && !/-service\.ts$/.test(path))
      result.push({
        rule: 'service-file-name',
        from: path,
        to: '*-service.ts',
      });
  }
  return result;
}

function classifyAll(sources: readonly string[]): {
  classified: Map<string, Classification>;
  findings: Finding[];
} {
  const classified = new Map<string, Classification>();
  const findings: Finding[] = [];
  for (const file of sources) {
    const result = classify(file);
    if (result) classified.set(file, result);
    else if (nestedInRoleFolder(file))
      findings.push({
        rule: 'role-folder-is-flat',
        from: file,
        to: 'services/, models/, rules/, ports/, errors/ and use-cases/<area>/ hold files, never subfolders',
      });
    else
      findings.push({
        rule: 'unclassified-source',
        from: file,
        to: 'a folder that architecture/policy.ts classifies',
      });
  }
  return { classified, findings };
}

function dependencyFindings(
  report: CruiseReport,
  classified: ReadonlyMap<string, Classification>,
): Finding[] {
  const result: Finding[] = report.summary.violations.map((entry) => ({
    rule: entry.rule.name,
    from: entry.from,
    to: entry.to,
  }));
  for (const module of report.modules) {
    const from = classified.get(module.source);
    if (!from) continue;
    for (const dependency of module.dependencies) {
      const to = classified.get(dependency.resolved);
      if (to) {
        const gitRule = gitCapabilityViolation(
          module.source,
          dependency.resolved,
        );
        if (gitRule)
          result.push({
            rule: gitRule,
            from: module.source,
            to: dependency.resolved,
          });
        if (
          from.owner !== to.owner &&
          to.owner !== 'server' &&
          !dependency.module.startsWith(`@porcelain/${to.owner}`)
        )
          result.push({
            rule: 'cross-package-import-must-use-package-name',
            from: module.source,
            to: dependency.resolved,
          });
        const rule = violation(from, to);
        if (rule)
          result.push({ rule, from: module.source, to: dependency.resolved });
      } else if (
        sourceRoots.some((root) => dependency.resolved.startsWith(root))
      ) {
        result.push({
          rule: 'unclassified-import-target',
          from: module.source,
          to: dependency.resolved,
        });
      } else if (isRepositoryPath(dependency.resolved)) {
        result.push({
          rule: 'import-outside-source-roots',
          from: module.source,
          to: dependency.resolved,
        });
      } else if (forbiddenExternal(from.role, dependency.module)) {
        result.push({
          rule: `${from.role}-cannot-import-external`,
          from: module.source,
          to: dependency.module,
        });
      } else if (runtimeNodeViolation(module.source, dependency.module)) {
        result.push({
          rule: 'runtime-node-allow-list',
          from: module.source,
          to: `${dependency.module}: runtime reaches Node only through the files architecture/policy.ts names for it; a new capability is a port with an adapter`,
        });
      }
    }
  }
  return result;
}

try {
  if (process.argv[2] !== 'check')
    throw new Error('Usage: pnpm arch:check [--all]');
  const sources = sourceRoots.flatMap(sourceFiles);
  const report = scan(sources);
  const { classified, findings } = classifyAll(sources);
  const violations = [
    ...findings,
    ...dependencyFindings(report, classified),
    ...packageExportFindings(),
    ...structureFindings(sources, classified),
    ...placementFindings(),
    ...typeRuleFindings(repositoryRoot),
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
    for (const entry of all ? entries : entries.slice(0, 3))
      process.stdout.write(`  ${entry.from} -> ${entry.to}\n`);
    if (!all && entries.length > 3)
      process.stdout.write(`  ... ${entries.length - 3} more (use --all)\n`);
  }
  process.stdout.write(
    `${violations.length} violations; ${classified.size} of ${sources.length} source files classified; ${report.summary.totalDependenciesCruised} dependencies\n`,
  );
  if (violations.length > 0) process.exitCode = 1;
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
