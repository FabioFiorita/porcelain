import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allowedTargets,
  classify,
  domainPackages,
  forbiddenExternal,
  gatewayPortOwnership,
  lifecycleOwnership,
  lifecycleTargets,
  legacySupportRoles,
  migrationOwnership,
  violation,
  type Classification,
} from '../architecture/policy.ts';

type Dependency = {
  module: string;
  resolved: string;
  couldNotResolve: boolean;
};

type CruiseReport = {
  modules: { source: string; dependencies: Dependency[] }[];
  summary: {
    totalCruised: number;
    totalDependenciesCruised: number;
    violations: {
      from: string;
      to: string;
      rule: { name: string; severity: string };
    }[];
  };
};

type Finding = { rule: string; from: string; to: string };

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoots = [
  'apps/server/src',
  ...readdirSync(join(repositoryRoot, 'packages'), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== 'client' &&
        existsSync(join(repositoryRoot, 'packages', entry.name, 'src')),
    )
    .map((entry) => `packages/${entry.name}/src`),
];
const legacyFiles = new Set(
  JSON.parse(
    readFileSync(join(repositoryRoot, 'architecture/legacy-source-paths.json'), 'utf8'),
  ) as string[],
);
const legacyExports = JSON.parse(
  readFileSync(join(repositoryRoot, 'architecture/legacy-package-exports.json'), 'utf8'),
) as Record<string, Record<string, string>>;

function sourceFiles(directory: string): string[] {
  return readdirSync(join(repositoryRoot, directory), { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
    })
    .map((path) => relative(repositoryRoot, join(repositoryRoot, path)));
}

function scan(): CruiseReport {
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
  const report = JSON.parse(result.stdout) as CruiseReport;
  const scanned = new Set(report.modules.map((module) => module.source));
  const missing = sourceRoots.flatMap(sourceFiles).filter((file) => !scanned.has(file));
  if (report.summary.totalCruised === 0 || missing.length > 0)
    throw new Error(`Dependency scan omitted source files: ${missing.join(', ')}`);
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
    throw new Error(`Workspace imports did not resolve:\n${unresolved.join('\n')}`);
  return report;
}

function validateMigrationMap(): void {
  for (const [directory, key] of [
    ['apps/server/src/use-cases', 'legacyUseCaseFiles'],
    ['apps/server/src/repositories', 'repositories'],
    ['apps/server/src/repositories/interfaces', 'ports'],
  ] as const) {
    const actual = new Set(
      readdirSync(join(repositoryRoot, directory))
        .filter((name) => name.endsWith('.ts') && !/\.(?:test|spec)\.ts$/.test(name))
        .map((name) => name.slice(0, -3)),
    );
    const planned = domainPackages.flatMap(
      (domain) => migrationOwnership[domain][key],
    );
    const duplicates = planned.filter((name, index) => planned.indexOf(name) !== index);
    const missing = [...actual].filter((name) => !planned.includes(name));
    const stale = planned.filter((name) => !actual.has(name));
    if (duplicates.length || missing.length || stale.length)
      throw new Error(
        `Migration map for ${directory} is incomplete: ` +
          `duplicates=${duplicates.join(', ')}; missing=${missing.join(', ')}; stale=${stale.join(', ')}`,
      );
  }
  const plannedLegacyFiles = new Set(
    domainPackages.flatMap((domain) => migrationOwnership[domain].legacyUseCaseFiles),
  );
  const staleSupportRoles = Object.keys(legacySupportRoles).filter(
    (name) => !plannedLegacyFiles.has(name),
  );
  if (staleSupportRoles.length)
    throw new Error(`Unmapped legacy support roles: ${staleSupportRoles.join(', ')}`);
  const gatewayPorts = [
    ...readdirSync(join(repositoryRoot, 'apps/server/src/filesystem/interfaces')),
    ...readdirSync(join(repositoryRoot, 'apps/server/src/agents/interfaces')),
  ]
    .filter((name) => name.endsWith('.ts'))
    .map((name) => name.slice(0, -3));
  const plannedGatewayPorts = new Set<string>(
    Object.values(gatewayPortOwnership).flat(),
  );
  const unknownGatewayPorts = gatewayPorts.filter(
    (name) => !plannedGatewayPorts.has(name),
  );
  const staleGatewayPorts = [...plannedGatewayPorts].filter(
    (name) => !gatewayPorts.includes(name),
  );
  if (unknownGatewayPorts.length || staleGatewayPorts.length)
    throw new Error(
      `Gateway port map is incomplete: unknown=${unknownGatewayPorts.join(', ')}; stale=${staleGatewayPorts.join(', ')}`,
    );
  const lifecycle = readdirSync(join(repositoryRoot, 'apps/server/src/lifecycle'))
    .filter((name) => name.endsWith('.ts'));
  const missingLifecycle = lifecycle.filter((name) => !(name in lifecycleOwnership));
  if (missingLifecycle.length)
    throw new Error(`Unclassified lifecycle files: ${missingLifecycle.join(', ')}`);
  const missingLifecycleTargets = Object.keys(lifecycleOwnership).filter(
    (name) => !(name in lifecycleTargets),
  );
  if (missingLifecycleTargets.length)
    throw new Error(`Lifecycle targets are missing: ${missingLifecycleTargets.join(', ')}`);
  const staleLegacy = [...legacyFiles].filter(
    (path) => !existsSync(join(repositoryRoot, path)),
  );
  if (staleLegacy.length)
    throw new Error(`Remove deleted paths from architecture/legacy-source-paths.json: ${staleLegacy.join(', ')}`);
}

function validatePackageExports(): void {
  for (const sourceRoot of sourceRoots.filter((root) => root.startsWith('packages/'))) {
    const name = sourceRoot.split('/')[1] ?? '';
    const manifest = JSON.parse(
      readFileSync(join(repositoryRoot, 'packages', name, 'package.json'), 'utf8'),
    ) as { exports?: Record<string, string> };
    const actual = manifest.exports ?? {};
    const planned: Record<string, string> = Object.fromEntries(
      domainPackages.includes(name as (typeof domainPackages)[number])
        ? [
            ['./services', './src/services/index.ts'],
            ['./errors', './src/errors/index.ts'],
            ['./models', './src/models/index.ts'],
            ['./ports', './src/ports/index.ts'],
          ]
        : name === 'git'
          ? ['discovery', 'inspection', 'history', 'actions'].map((capability) => [
              `./${capability}`,
              `./src/${capability}/index.ts`,
            ])
          : name === 'contracts'
            ? domainPackages.map((domain) => [`./${domain}`, `./src/${domain}/index.ts`])
            : name === 'storage'
              ? [['.', './src/index.ts']]
              : [],
    );
    for (const [key, target] of Object.entries(actual)) {
      if (planned[key] === target || legacyExports[name]?.[key] === target) continue;
      throw new Error(`Unclassified package export: ${name} ${key} -> ${target}`);
    }
    for (const [key, target] of Object.entries(legacyExports[name] ?? {})) {
      if (actual[key] !== target)
        throw new Error(`Update stale legacy export: ${name} ${key} -> ${target}`);
    }
  }
}

function checkedModules(): Map<string, Classification> {
  const classified = new Map<string, Classification>();
  for (const file of sourceRoots.flatMap(sourceFiles)) {
    const result = classify(file, legacyFiles);
    if (!result) throw new Error(`Unclassified server source: ${file}`);
    classified.set(file, result);
  }
  return classified;
}

function findings(
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
        if (
          from.role === 'transport' &&
          dependency.resolved === 'apps/server/src/application.ts'
        )
          result.push({
            rule: 'transport-must-use-feature-controller',
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
        sourceRoots.some((root) => dependency.resolved.startsWith(root)) ||
        dependency.resolved.startsWith('packages/client/src/')
      ) {
        result.push({
          rule: 'unclassified-import-target',
          from: module.source,
          to: dependency.resolved,
        });
      } else if (forbiddenExternal(from.role, dependency.module)) {
        result.push({
          rule: `${from.role}-cannot-import-raw-adapter`,
          from: module.source,
          to: dependency.module,
        });
      }
    }
  }
  return result;
}

function group(path: string): string | undefined {
  const segments = path.split('/');
  if (segments[0] === 'apps' && segments[1] === 'server')
    return `server/${segments[3] ?? 'root'}`;
  if (segments[0] === 'packages') return `packages/${segments[1]}`;
}

try {
  const mode = process.argv[2];
  if (mode !== 'check' && mode !== 'map' && mode !== 'plan')
    throw new Error('Usage: pnpm arch:check [--all], pnpm arch:map, or pnpm arch:plan');
  validateMigrationMap();
  validatePackageExports();
  if (mode === 'plan') {
    for (const domain of domainPackages) {
      const owner = migrationOwnership[domain];
      process.stdout.write(`${domain}\n`);
      const services = owner.legacyUseCaseFiles.filter(
        (name) => !(name in legacySupportRoles),
      );
      process.stdout.write(`  services: ${services.join(', ') || '(none)'}\n`);
      for (const key of ['repositories', 'ports'] as const)
        process.stdout.write(`  ${key}: ${owner[key].join(', ') || '(none)'}\n`);
    }
    process.stdout.write('\nGateway ports:\n');
    for (const [owner, names] of Object.entries(gatewayPortOwnership))
      process.stdout.write(`  ${owner}: ${names.join(', ')}\n`);
    process.stdout.write('\nLegacy use-cases/ files assigned to other roles:\n');
    for (const [file, role] of Object.entries(legacySupportRoles))
      process.stdout.write(`  ${file}.ts -> ${role}\n`);
    process.stdout.write('\nCurrent lifecycle files:\n');
    for (const [file, target] of Object.entries(lifecycleTargets))
      process.stdout.write(`  ${file} -> ${target}\n`);
    process.stdout.write('\nAllowed role imports:\n');
    for (const [role, targets] of Object.entries(allowedTargets))
      process.stdout.write(`  ${role} -> ${[...targets].join(', ')}\n`);
    process.stdout.write(
      '\nAdditional rules: domain packages cannot depend on each other or transport contracts; ' +
        'packages cannot import server code; cross-package imports use public entries only; ' +
        'new paths and exports need classification.\n',
    );
    process.exit(0);
  }
  const report = scan();
  const classified = checkedModules();
  if (mode === 'map') {
    process.stdout.write('Planned domain packages:\n');
    for (const domain of domainPackages) {
      const owner = migrationOwnership[domain];
      const serviceCount = owner.legacyUseCaseFiles.filter(
        (name) => !(name in legacySupportRoles),
      ).length;
      const supportCount = owner.legacyUseCaseFiles.length - serviceCount;
      process.stdout.write(
        `  ${domain}: ${serviceCount} ${serviceCount === 1 ? 'service' : 'services'}, ${supportCount} support ${supportCount === 1 ? 'file' : 'files'}, ${owner.repositories.length} ${owner.repositories.length === 1 ? 'repository' : 'repositories'}\n`,
      );
    }
    process.stdout.write('\nCurrent cross-module imports:\n');
    const edges = new Map<string, number>();
    for (const module of report.modules) {
      const from = group(module.source);
      if (!from) continue;
      for (const dependency of module.dependencies) {
        const to = group(dependency.resolved);
        if (!to || to === from) continue;
        const edge = `${from} -> ${to}`;
        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
    }
    for (const [edge, count] of [...edges].sort((a, b) => a[0].localeCompare(b[0])))
      process.stdout.write(`${edge} (${count})\n`);
  } else {
    const violations = findings(report, classified);
    const byRule = new Map<string, Finding[]>();
    for (const finding of violations) {
      const group = byRule.get(finding.rule) ?? [];
      group.push(finding);
      byRule.set(finding.rule, group);
    }
    for (const [rule, entries] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
      process.stdout.write(`${rule}: ${entries.length}\n`);
      for (const entry of process.argv.includes('--all') ? entries : entries.slice(0, 3))
        process.stdout.write(`  ${entry.from} -> ${entry.to}\n`);
      if (!process.argv.includes('--all') && entries.length > 3)
        process.stdout.write(`  ... ${entries.length - 3} more (use --all)\n`);
    }
    process.stdout.write(
      `${violations.length} violations; ${classified.size} source files; ${report.summary.totalDependenciesCruised} dependencies\n`,
    );
    if (violations.length > 0) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
