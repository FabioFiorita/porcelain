import { builtinModules } from 'node:module';

export const domainPackages = [
  'projects',
  'changes',
  'reviews',
  'files',
  'git-actions',
  'access',
] as const;

export type Domain = (typeof domainPackages)[number];

export const domainParts = [
  'services',
  'rules',
  'models',
  'ports',
  'errors',
] as const;

export const gitCapabilities = [
  'discovery',
  'inspection',
  'history',
  'actions',
] as const;

export const targetPackageExports: Record<string, Record<string, string>> = {
  ...Object.fromEntries(
    domainPackages.map((name) => [
      name,
      Object.fromEntries(
        domainParts.map((part) => [`./${part}`, `./src/${part}/index.ts`]),
      ),
    ]),
  ),
  git: Object.fromEntries(
    gitCapabilities.map((capability) => [
      `./${capability}`,
      `./src/${capability}/index.ts`,
    ]),
  ),
  contracts: {
    './shared': './src/shared/index.ts',
    ...Object.fromEntries(
      domainPackages.map((name) => [`./${name}`, `./src/${name}/index.ts`]),
    ),
  },
  storage: {
    '.': './src/index.ts',
    ...Object.fromEntries(
      domainPackages
        .filter((name) => name !== 'files')
        .map((name) => [`./${name}`, `./src/repositories/${name}/index.ts`]),
    ),
  },
  agents: {
    './commit-planning': './src/commit-planning/index.ts',
    './models': './src/models/index.ts',
  },
  kernel: {
    './models': './src/models/index.ts',
    './ports': './src/ports/index.ts',
    './fakes': './spec/fakes/index.ts',
  },
};

export const requiredServerFiles: readonly string[] = [
  'apps/server/src/bootstrap/main.ts',
  'apps/server/src/bootstrap/compose-server.ts',
  ...domainPackages.map(
    (name) => `apps/server/src/bootstrap/compose-${name}.ts`,
  ),
  'apps/server/src/http/scopes/public.ts',
  'apps/server/src/http/scopes/paired.ts',
  'apps/server/src/http/scopes/owner.ts',
  'apps/server/src/http/status-policy.ts',
  'apps/server/src/runtime/lanes.ts',
  'apps/server/src/runtime/shared-reads.ts',
  'apps/server/src/runtime/launch-limit.ts',
  'apps/server/src/runtime/lane-keys.ts',
  'apps/server/src/runtime/operation-context.ts',
  'apps/server/src/ports/event-publisher.ts',
];

export type Role =
  | 'transport'
  | 'status-policy'
  | 'use-case'
  | 'installer'
  | 'installer-api'
  | 'domain-api'
  | 'service'
  | 'rule-api'
  | 'rule'
  | 'model-api'
  | 'model'
  | 'port-api'
  | 'port'
  | 'error-api'
  | 'error'
  | 'repository-api'
  | 'repository'
  | 'gateway-api'
  | 'gateway'
  | 'runtime'
  | 'server-port'
  | 'bootstrap'
  | 'contract'
  | 'config'
  | 'kernel'
  | 'fake'
  | 'test';

export type Classification = { role: Role; owner: string };

const domainSet = new Set<string>(domainPackages);
const gitCapabilitySet = new Set<string>(gitCapabilities);
const domainApiRoles = new Set<Role>([
  'domain-api',
  'rule-api',
  'model-api',
  'port-api',
  'error-api',
]);

const gitCapabilityDependencies: Record<string, ReadonlySet<string>> = {
  discovery: new Set(['shared']),
  inspection: new Set(['discovery', 'shared']),
  history: new Set(['discovery', 'inspection', 'shared']),
  actions: new Set(['discovery', 'inspection', 'history', 'shared']),
  shared: new Set(),
};

export function gitCapabilityViolation(
  source: string,
  target: string,
): string | undefined {
  const prefix = 'packages/git/src/';
  if (!source.startsWith(prefix) || !target.startsWith(prefix)) return;
  const from = source.slice(prefix.length).split('/')[0] ?? '';
  const to = target.slice(prefix.length).split('/')[0] ?? '';
  if (from === to) return;
  if (!gitCapabilityDependencies[from]?.has(to))
    return 'git-capability-dependency-order';
  if (gitCapabilitySet.has(to) && target !== `${prefix}${to}/index.ts`)
    return 'git-capability-public-api-only';
  return;
}

export function helpersFolderViolation(path: string): string | undefined {
  return /^(?:packages\/git\/src|apps\/server\/src)\/(?:.*\/)?helpers\//.test(
    path,
  )
    ? 'no-helpers-folder'
    : undefined;
}

function classified(role: Role, owner: string): Classification {
  return { role, owner };
}

const partRoles: Record<(typeof domainParts)[number], [Role, Role]> = {
  services: ['service', 'domain-api'],
  rules: ['rule', 'rule-api'],
  models: ['model', 'model-api'],
  ports: ['port', 'port-api'],
  errors: ['error', 'error-api'],
};

function classifyDomain(name: string, inside: string) {
  for (const part of domainParts) {
    const [role, api] = partRoles[part];
    if (inside === `${part}/index.ts`) return classified(api, name);
    if (inside.startsWith(`${part}/`)) return classified(role, name);
  }
  return;
}

function classifyPackage(name: string, inside: string) {
  if (/\.(?:test|spec)\.ts$/.test(inside)) return classified('test', name);
  if (domainSet.has(name)) return classifyDomain(name, inside);
  const section = inside.split('/')[0] ?? '';
  if (name === 'git') {
    if (gitCapabilitySet.has(section))
      return classified(
        inside === `${section}/index.ts` ? 'gateway-api' : 'gateway',
        name,
      );
    if (section === 'shared') return classified('gateway', name);
    return;
  }
  if (name === 'agents') {
    if (['commit-planning', 'models', 'providers'].includes(section))
      return classified(
        inside === `${section}/index.ts` ? 'gateway-api' : 'gateway',
        name,
      );
    return;
  }
  if (name === 'storage') {
    if (
      inside === 'index.ts' ||
      /^repositories\/[^/]+\/index\.ts$/.test(inside)
    )
      return classified('repository-api', name);
    if (inside.startsWith('repositories/') || inside.startsWith('db/'))
      return classified('repository', name);
    if (inside.startsWith('models/')) return classified('error', name);
    return;
  }
  if (name === 'kernel') {
    if (section === 'models' || section === 'ports')
      return classified('kernel', name);
    return;
  }
  if (name === 'contracts') {
    if (domainSet.has(section) || section === 'shared')
      return classified('contract', name);
    return;
  }
  return;
}

function classifyServer(inside: string) {
  const owner = 'server';
  if (/\.(?:test|spec)\.ts$/.test(inside)) return classified('test', owner);
  if (inside.startsWith('use-cases/')) return classified('use-case', owner);
  if (inside.startsWith('jobs/')) return classified('transport', owner);
  if (inside.startsWith('bootstrap/')) return classified('bootstrap', owner);
  if (inside.startsWith('runtime/')) return classified('runtime', owner);
  if (inside.startsWith('ports/')) return classified('server-port', owner);
  if (inside.startsWith('adapters/')) return classified('gateway', owner);
  if (inside === 'installer/index.ts')
    return classified('installer-api', owner);
  if (inside.startsWith('installer/')) return classified('installer', owner);
  if (inside.startsWith('config/')) return classified('config', owner);
  if (inside === 'cli/main.ts' || inside === 'cli/index.ts')
    return classified('bootstrap', owner);
  if (inside.startsWith('cli/')) return classified('transport', owner);
  if (inside.startsWith('http/')) {
    const http = inside.slice('http/'.length);
    if (
      /^(?:scopes|hooks|routes|mcp|protocol)\//.test(http) ||
      [
        'schemas/error-responses.ts',
        'error-handler.ts',
        'static-files.ts',
        'principal.ts',
      ].includes(http)
    )
      return classified('transport', owner);
    if (http === 'status-policy.ts') return classified('status-policy', owner);
    if (http === 'server.ts' || http === 'owner-server.ts')
      return classified('bootstrap', owner);
    return;
  }
  return;
}

export function classify(path: string): Classification | undefined {
  const packageFake = /^packages\/([^/]+)\/spec\/fakes\/.+\.ts$/.exec(path);
  if (packageFake) return classified('fake', packageFake[1] ?? '');
  if (/^apps\/server\/spec\/fakes\/.+\.ts$/.test(path))
    return classified('fake', 'server');
  const packageFile = /^packages\/([^/]+)\/src\/(.+)$/.exec(path);
  if (packageFile)
    return classifyPackage(packageFile[1] ?? '', packageFile[2] ?? '');
  if (path.startsWith('apps/server/src/'))
    return classifyServer(path.slice('apps/server/src/'.length));
  return;
}

const domainInternal: readonly Role[] = [
  'service',
  'rule',
  'model',
  'port',
  'error',
];

const everything: readonly Role[] = [
  'transport',
  'status-policy',
  'use-case',
  'installer',
  'domain-api',
  'rule-api',
  'model-api',
  'port-api',
  'error-api',
  ...domainInternal,
  'repository-api',
  'repository',
  'gateway-api',
  'gateway',
  'runtime',
  'server-port',
  'bootstrap',
  'contract',
  'config',
  'kernel',
];

export const allowedTargets: Record<Role, ReadonlySet<Role>> = {
  transport: new Set([
    'installer-api',
    'transport',
    'status-policy',
    'use-case',
    'server-port',
    'contract',
    'config',
  ]),
  'status-policy': new Set(['error-api', 'gateway-api', 'runtime', 'contract']),
  'use-case': new Set([
    'domain-api',
    'model-api',
    'kernel',
    'contract',
    'runtime',
    'server-port',
  ]),
  installer: new Set(['installer', 'server-port', 'config']),
  'installer-api': new Set(['installer', 'config']),
  'domain-api': new Set(['service']),
  'rule-api': new Set(['rule']),
  'model-api': new Set(['model']),
  'port-api': new Set(['port']),
  'error-api': new Set(['error']),
  service: new Set([
    'kernel',
    'port',
    'port-api',
    'model',
    'model-api',
    'rule',
    'rule-api',
    'error',
    'error-api',
  ]),
  rule: new Set(['kernel', 'rule', 'model', 'model-api', 'error', 'error-api']),
  model: new Set(['kernel', 'model', 'model-api']),
  port: new Set(['kernel', 'port', 'model', 'model-api']),
  error: new Set(['error']),
  repository: new Set([
    'kernel',
    'repository',
    'port-api',
    'model-api',
    'error',
  ]),
  'repository-api': new Set([
    'kernel',
    'repository',
    'port-api',
    'model-api',
    'error',
  ]),
  gateway: new Set([
    'kernel',
    'gateway',
    'gateway-api',
    'port-api',
    'model-api',
    'runtime',
    'server-port',
    'config',
  ]),
  'gateway-api': new Set(['gateway']),
  runtime: new Set(['kernel', 'runtime', 'model-api', 'config']),
  'server-port': new Set(['server-port', 'kernel', 'model-api']),
  bootstrap: new Set(everything),
  contract: new Set(['contract']),
  config: new Set(['config']),
  kernel: new Set(['kernel']),
  fake: new Set([
    'kernel',
    'port',
    'port-api',
    'model',
    'model-api',
    'runtime',
    'server-port',
    'fake',
  ]),
  test: new Set([...everything, 'fake', 'test']),
};

export function violation(
  from: Classification,
  to: Classification,
): string | undefined {
  if (from.role === 'test') return;
  if (
    from.role === 'fake' &&
    to.owner !== from.owner &&
    (to.owner !== 'kernel' || to.role === 'fake') &&
    (from.owner !== 'server' || to.role === 'fake')
  )
    return 'fake-imports-own-package-only';
  if (from.owner !== 'server' && to.owner === 'server')
    return 'package-cannot-import-server';
  if (from.owner === 'git' && domainSet.has(to.owner))
    return 'git-cannot-import-domain';
  if (
    domainSet.has(from.owner) &&
    domainSet.has(to.owner) &&
    from.owner !== to.owner
  )
    return 'domain-cannot-import-another-domain';
  if (domainSet.has(from.owner) && to.owner === 'contracts')
    return 'domain-cannot-import-transport-contract';
  if (from.owner !== to.owner) {
    if (to.owner === 'git' && to.role !== 'gateway-api')
      return 'git-public-api-only';
    if (domainSet.has(to.owner) && !domainApiRoles.has(to.role))
      return 'domain-public-api-only';
    if (to.owner === 'storage' && to.role !== 'repository-api')
      return 'storage-public-api-only';
    if (to.owner === 'agents' && to.role !== 'gateway-api')
      return 'agents-public-api-only';
  }
  if (!allowedTargets[from.role].has(to.role))
    return `${from.role}-cannot-import-${to.role}`;
  return;
}

const typedRoles = new Set<Role>([
  ...domainInternal,
  ...domainApiRoles,
  'use-case',
  'server-port',
]);
const boundaryRoles = new Set<Role>([
  'transport',
  'status-policy',
  'contract',
  'config',
]);
const nodeModules = new Set(
  builtinModules.map((name) => name.replace(/^node:/, '')),
);
const infrastructureModule =
  /^(?:zod|fastify|@fastify\/|ws|drizzle-orm|better-sqlite3)(?:\/|$)?/;
const storageEngineModule =
  /^(?:better-sqlite3|drizzle-orm|fs|child_process)(?:\/|$)/;

function isNodeModule(name: string): boolean {
  return nodeModules.has(name) || nodeModules.has(name.split('/')[0] ?? '');
}

export function forbiddenExternal(role: Role, module: string): boolean {
  if (role === 'kernel') return true;
  const name = module.replace(/^node:/, '');
  if (typedRoles.has(role)) {
    if ((role === 'rule' || role === 'rule-api') && name === 'crypto')
      return false;
    return isNodeModule(name) || infrastructureModule.test(name);
  }
  if (boundaryRoles.has(role)) return storageEngineModule.test(name);
  return false;
}
