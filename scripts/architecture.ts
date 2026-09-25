import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cruise } from 'dependency-cruiser';
import extractDepcruiseOptions from 'dependency-cruiser/config-utl/extract-depcruise-options';
import { z } from 'zod';
import web from '../apps/web/vite.config.ts';
import {
  baselineHistoryProblems,
  readBaseline,
  settleBaseline,
} from '../architecture/baseline.ts';
import {
  allowedContractType,
  archRules,
  classify,
  domainPackages,
  forbiddenExternal,
  gitCapabilityViolation,
  helpersFolderViolation,
  infrastructureLayoutViolation,
  nestedInRoleFolder,
  requiredServerFiles,
  runtimeNodeViolation,
  targetPackageExports,
  violation,
  webLayout,
  webPart,
  shadcnRegistry,
  type ArchRule,
  type Classification,
} from '../architecture/policy.ts';
import { typeRuleFindings } from '../architecture/type-rules.ts';
import { unusedExportFindings } from '../architecture/unused-exports.ts';

const dependencySchema = z.object({
  module: z.string(),
  resolved: z.string(),
  couldNotResolve: z.boolean(),
  dependencyTypes: z.array(z.string()),
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
        rule: z.object({ name: z.enum(archRules), severity: z.string() }),
      }),
    ),
  }),
});
type CruiseReport = z.output<typeof cruiseReportSchema>;

type Finding = { rule: ArchRule; from: string; to: string };

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
const webRoots = ['apps/web/src', 'apps/web/spec'];
const webConfig = 'apps/web/vite.config.ts';
const allRoots = [...sourceRoots, ...webRoots];

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
  /^apps\/web\/(?:package\.json|tsconfig(?:\.node)?\.json|components\.json|index\.html|vite\.config\.ts)$/,
  /^apps\/web\/public\/[^/]+$/,
];
const insideRoot = /^(?:packages\/[^/]+|apps\/server)\/(?:src|spec)\//;
const fixtureData = /^packages\/[^/]+\/spec\/fixtures\//;
const webInside = /^apps\/web\/(?:src|spec)\//;
const webAsset = /^apps\/web\/src\/(?:[^/]+\.css|assets\/[^/]+)$/;

function placementFindings(): Finding[] {
  const files = [...filesUnder('packages'), ...filesUnder('apps')];
  return files.flatMap((path) => {
    if (webInside.test(path)) {
      if (/\.tsx?$/.test(path) || webAsset.test(path)) return [];
      return [
        {
          rule: 'code-outside-roots',
          from: path,
          to: 'apps/web/src holds .ts and .tsx files, stylesheets at its root and images in assets/; apps/web/spec holds browser cases',
        },
      ];
    }
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
        to: 'packages/ and apps/ hold package folders only; a package holds package.json, tsconfig.json, src/ and spec/, storage also drizzle/, drizzle.config.ts and scripts/*.ts, and the web also tsconfig.node.json, vite.config.ts, index.html, components.json and public/',
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

const webResolveSchema = z.object({
  resolve: z.object({ alias: z.record(z.string(), z.string()) }),
});

async function webScan(): Promise<CruiseReport> {
  const result = await cruise(
    [...webRoots, webConfig],
    await extractDepcruiseOptions(
      join(repositoryRoot, 'architecture/dependency-cruiser.cjs'),
    ),
    { alias: webResolveSchema.parse(web).resolve.alias },
  );
  return cruiseReportSchema.parse(result.output);
}

async function scan(sources: readonly string[]): Promise<CruiseReport> {
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
  const server: CruiseReport = cruiseReportSchema.parse(
    JSON.parse(result.stdout),
  );
  const webReport = await webScan();
  const report: CruiseReport = {
    modules: [...server.modules, ...webReport.modules],
    summary: {
      totalCruised:
        server.summary.totalCruised + webReport.summary.totalCruised,
      totalDependenciesCruised:
        server.summary.totalDependenciesCruised +
        webReport.summary.totalDependenciesCruised,
      violations: [
        ...server.summary.violations,
        ...webReport.summary.violations,
      ],
    },
  };
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
          /^(?:@porcelain\/|@\/|\.)/.test(dependency.module),
      )
      .map((dependency) => `${module.source} -> ${dependency.module}`),
  );
  if (unresolved.length > 0)
    throw new Error(
      `Workspace and local imports did not resolve:\n${unresolved.join('\n')}`,
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

const runtimeFixture = /(?:^|[/.])(?:mocks?|fixtures?|fakes?)(?:[./-]|$)/i;

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
  for (const path of sources) {
    const layout = infrastructureLayoutViolation(path);
    if (layout)
      result.push({
        rule: layout,
        from: path,
        to: 'a git, agents or process capability holds its classes and index.ts, then commands/, parsers/, dtos/, errors/ and interfaces/ one level deep; git shared/ holds those folders only',
      });
  }
  for (const folder of helpersFolders)
    result.push({
      rule: 'no-helpers-folder',
      from: folder,
      to: 'name the module after what it does',
    });
  for (const path of sources) {
    if (!path.startsWith('apps/web/src/')) continue;
    const stem =
      path
        .split('/')
        .at(-1)
        ?.replace(/\.tsx$/, '') ?? '';
    if (
      path.endsWith('.tsx') &&
      webPart(path) !== 'ui' &&
      shadcnRegistry.has(stem)
    )
      result.push({
        rule: 'web-shadcn-primitive-owner',
        from: path,
        to: `use the shadcn ${stem} from components/ui and its variants; add it through the shadcn CLI when it is missing`,
      });
    if (runtimeFixture.test(path.slice('apps/web/src/'.length)))
      result.push({
        rule: 'web-no-runtime-fixture',
        from: path,
        to: 'the web runs against the real isolated server; mocks, fixtures and fakes have no place in runtime code',
      });
  }
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
    else if (webPart(file) === 'ui')
      findings.push({
        rule: 'web-shadcn-ui-owner',
        from: file,
        to: 'components/ui holds shadcn registry components only, flat and as .tsx; search the registry and add a missing one through the shadcn CLI, and compose product views in features/<domain>/views/',
      });
    else if (nestedInRoleFolder(file))
      findings.push({
        rule: 'role-folder-is-flat',
        from: file,
        to: file.startsWith('apps/web/')
          ? 'queries/, commands/, rules/, adapters/ and views/ hold files, never subfolders'
          : 'services/, models/, rules/, ports/, errors/ and use-cases/<area>/ hold files, never subfolders',
      });
    else
      findings.push({
        rule: 'unclassified-source',
        from: file,
        to: file.startsWith('apps/web/')
          ? webLayout(file)
          : 'a folder that architecture/policy.ts classifies',
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
      if (webAsset.test(dependency.resolved)) continue;
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
        const rule = allowedContractType(
          module.source,
          to,
          dependency.dependencyTypes.includes('type-only'),
        )
          ? undefined
          : violation(from, to);
        if (rule)
          result.push({ rule, from: module.source, to: dependency.resolved });
      } else if (
        allRoots.some((root) => dependency.resolved.startsWith(root))
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
  const sources = [...allRoots.flatMap(sourceFiles), webConfig];
  const report = await scan(sources);
  const { classified, findings } = classifyAll(sources);
  const found = [
    ...findings,
    ...dependencyFindings(report, classified),
    ...packageExportFindings(),
    ...structureFindings(sources, classified),
    ...placementFindings(),
    ...typeRuleFindings(repositoryRoot),
    ...unusedExportFindings(repositoryRoot),
  ];
  const settled = settleBaseline(
    readBaseline(repositoryRoot),
    (rule) => !rule.includes('/'),
    found.map((finding) => ({ ...finding, file: finding.from })),
  );
  const violations: Finding[] = [
    ...settled.reported,
    ...[...settled.problems, ...baselineHistoryProblems(repositoryRoot)].map(
      (problem) => ({
        rule: 'web-baseline' as const,
        from: problem,
        to: 'architecture/web-baseline.json',
      }),
    ),
  ];
  const byRule = new Map<ArchRule, Finding[]>();
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
    `${violations.length} violations; ${settled.held} web findings held by architecture/web-baseline.json; ${classified.size} of ${sources.length} source files classified; ${report.summary.totalDependenciesCruised} dependencies\n`,
  );
  if (violations.length > 0) process.exitCode = 1;
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
