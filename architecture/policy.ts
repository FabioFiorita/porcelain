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
        .filter((name) => name !== 'files' && name !== 'changes')
        .map((name) => [`./${name}`, `./src/repositories/${name}/index.ts`]),
    ),
  },
  agents: {
    './commit-planning': './src/commit-planning/index.ts',
  },
  kernel: {
    './models': './src/models/index.ts',
    './ports': './src/ports/index.ts',
    './rules': './src/rules/index.ts',
    './errors': './src/errors/index.ts',
    './fakes': './spec/fakes/index.ts',
  },
  process: { '.': './src/index.ts' },
};

for (const name of ['access', 'git-actions', 'projects', 'reviews'])
  targetPackageExports[name] = {
    ...targetPackageExports[name],
    './store-contracts': './spec/contracts/index.ts',
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
  'apps/server/src/ports/operation-context.ts',
  'apps/server/src/ports/event-publisher.ts',
];

export const roles = [
  'transport',
  'status-policy',
  'use-case',
  'installer',
  'installer-api',
  'domain-api',
  'service',
  'rule-api',
  'rule',
  'model-api',
  'model',
  'port-api',
  'port',
  'error-api',
  'error',
  'repository-api',
  'repository',
  'gateway-api',
  'gateway',
  'process-api',
  'process',
  'runtime',
  'server-port',
  'bootstrap',
  'contract',
  'config',
  'kernel',
  'fake',
  'fixture',
  'capture',
  'store-contract',
  'test',
] as const;

export type Role = (typeof roles)[number];

export const archRules = [
  'code-outside-roots',
  'unclassified-package-export',
  'missing-target-package',
  'missing-target-export',
  'missing-server-structure',
  'no-helpers-folder',
  'flat-http-route',
  'use-case-file-name',
  'service-file-name',
  'role-folder-is-flat',
  'unclassified-source',
  'cross-package-import-must-use-package-name',
  'unclassified-import-target',
  'import-outside-source-roots',
  'runtime-node-allow-list',
  'no-circular-source-imports',
  'git-capability-dependency-order',
  'git-capability-public-api-only',
  'infrastructure-layout',
  'test-imports-own-package-support-only',
  'store-contract-runs-against-its-fake-storage-and-server-adapters-only',
  'package-cannot-import-server',
  'fake-imports-own-package-only',
  'fixture-imports-own-package-models-only',
  'git-cannot-import-domain',
  'domain-cannot-import-another-domain',
  'domain-cannot-import-transport-contract',
  'contract-imports-kernel-rules-only',
  'git-public-api-only',
  'domain-public-api-only',
  'kernel-public-api-only',
  'storage-public-api-only',
  'agents-public-api-only',
  'process-public-api-only',
  'process-importable-by-git-agents-installer',
  'no-undefined-union-result',
  'models-file-shape',
  'recording-fake-for-write-only-port',
  'lane-per-table',
  'lane-mode-matches-service',
  'unused-export',
] as const;

export type ArchRule =
  | (typeof archRules)[number]
  | `${Role}-cannot-import-${Role | 'external'}`;

export const archRuleFamilies = [
  '<role>-cannot-import-<role>',
  '<role>-cannot-import-external',
] as const;

export function archRuleFamily(name: string): string | undefined {
  const match = /^(.+)-cannot-import-(.+)$/.exec(name);
  const from = roles.find((role) => role === match?.[1]);
  if (from === undefined) return undefined;
  if (match?.[2] === 'external') return '<role>-cannot-import-external';
  return roles.some((role) => role === match?.[2])
    ? '<role>-cannot-import-<role>'
    : undefined;
}

export const styleRules = [
  'disable-directives',
  'one-lint-config',
  'strict-json',
  'lint-config',
  'rule-list',
  'probe-shape',
  'tsconfig',
] as const;

export type StyleRule = (typeof styleRules)[number];

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
): ArchRule | undefined {
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

export function helpersFolderViolation(path: string): ArchRule | undefined {
  return /^(?:packages\/(?:git|agents|process)\/src|apps\/server\/src)\/(?:.*\/)?helpers\//.test(
    path,
  )
    ? 'no-helpers-folder'
    : undefined;
}

const infrastructureParts: ReadonlySet<string> = new Set([
  'commands',
  'parsers',
  'dtos',
  'errors',
  'interfaces',
]);

export function infrastructureLayoutViolation(
  path: string,
): ArchRule | undefined {
  const match = /^packages\/(git|agents|process)\/src\/(.+)$/.exec(path);
  if (!match) return undefined;
  const parts = (match[2] ?? '').split('/');
  const inside = match[1] === 'process' ? parts : parts.slice(1);
  const support = match[1] === 'git' && parts[0] === 'shared';
  if (inside.length === 1) return support ? 'infrastructure-layout' : undefined;
  if (inside.length === 2 && infrastructureParts.has(inside[0] ?? ''))
    return undefined;
  return 'infrastructure-layout';
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
  if (/\.test\.ts$/.test(inside)) return;
  if (/\.spec\.ts$/.test(inside)) return classified('test', name);
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
    if (section === 'commit-planning')
      return classified(
        inside === `${section}/index.ts` ? 'gateway-api' : 'gateway',
        name,
      );
    return;
  }
  if (name === 'process')
    return classified(inside === 'index.ts' ? 'process-api' : 'process', name);
  if (name === 'storage') {
    if (
      inside === 'index.ts' ||
      /^repositories\/[^/]+\/index\.ts$/.test(inside)
    )
      return classified('repository-api', name);
    if (inside.startsWith('repositories/') || inside.startsWith('db/'))
      return classified('repository', name);
    if (inside.startsWith('errors/')) return classified('error', name);
    return;
  }
  if (name === 'kernel') {
    if (section === 'models' || section === 'ports')
      return classified('kernel', name);
    if (section === 'rules' || section === 'errors')
      return classifyDomain(name, inside);
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
  if (/\.test\.ts$/.test(inside)) return;
  if (/\.spec\.ts$/.test(inside)) return classified('test', owner);
  if (inside.startsWith('use-cases/')) return classified('use-case', owner);
  if (inside.startsWith('bootstrap/')) return classified('bootstrap', owner);
  if (inside.startsWith('runtime/')) return classified('runtime', owner);
  if (inside.startsWith('ports/')) return classified('server-port', owner);
  if (inside.startsWith('adapters/')) return classified('gateway', owner);
  if (inside === 'installer/index.ts')
    return classified('installer-api', owner);
  if (inside.startsWith('installer/')) return classified('installer', owner);
  if (inside.startsWith('config/')) return classified('config', owner);
  if (inside.startsWith('cli/')) return classified('transport', owner);
  if (inside.startsWith('http/')) {
    const http = inside.slice('http/'.length);
    if (
      /^(?:scopes|hooks|routes|mcp|protocol|presenters)\//.test(http) ||
      [
        'schemas/error-responses.ts',
        'error-handler.ts',
        'server-factory.ts',
        'static-files.ts',
        'principal.ts',
      ].includes(http)
    )
      return classified('transport', owner);
    if (http === 'status-policy.ts') return classified('status-policy', owner);
    if (http === 'server.ts' || http === 'owner-server.ts')
      return classified('transport', owner);
    return;
  }
  return;
}

const nestedRoleFolder =
  /^(?:packages\/[^/]+\/src\/(?:services|models|rules|ports|errors)\/[^/]+\/|apps\/server\/src\/(?:ports\/[^/]+\/|use-cases\/[^/]+\/[^/]+\/))/;

export function nestedInRoleFolder(path: string): boolean {
  return nestedRoleFolder.test(path);
}

export function classify(path: string): Classification | undefined {
  if (nestedInRoleFolder(path)) return;
  const packageFake = /^packages\/([^/]+)\/spec\/fakes\/.+\.ts$/.exec(path);
  if (packageFake) return classified('fake', packageFake[1] ?? '');
  const capture = /^packages\/([^/]+)\/spec\/fixtures\/capture\.ts$/.exec(path);
  if (capture) return classified('capture', capture[1] ?? '');
  const packageFixture = /^packages\/([^/]+)\/spec\/fixtures\/.+$/.exec(path);
  if (packageFixture) return classified('fixture', packageFixture[1] ?? '');
  const storeContract = /^packages\/([^/]+)\/spec\/contracts\/.+\.ts$/.exec(
    path,
  );
  if (storeContract)
    return classified('store-contract', storeContract[1] ?? '');
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
    'kernel',
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
    'rule-api',
    'error-api',
    'model-api',
    'kernel',
    'contract',
    'runtime',
    'server-port',
  ]),
  installer: new Set([
    'installer',
    'runtime',
    'server-port',
    'config',
    'kernel',
    'process-api',
    'repository-api',
  ]),
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
  rule: new Set([
    'kernel',
    'rule',
    'rule-api',
    'model',
    'model-api',
    'error',
    'error-api',
  ]),
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
    'process-api',
  ]),
  'gateway-api': new Set(['gateway']),
  'process-api': new Set(['process']),
  process: new Set(['process']),
  runtime: new Set([
    'kernel',
    'runtime',
    'model-api',
    'config',
    'server-port',
    'contract',
  ]),
  'server-port': new Set(['server-port', 'kernel', 'model-api']),
  bootstrap: new Set([
    'bootstrap',
    'transport',
    'use-case',
    'domain-api',
    'rule-api',
    'port-api',
    'gateway',
    'gateway-api',
    'repository-api',
    'runtime',
    'server-port',
    'config',
    'kernel',
  ]),
  contract: new Set(['contract', 'rule-api']),
  config: new Set(['config', 'contract']),
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
  fixture: new Set(['model', 'kernel']),
  capture: new Set(),
  'store-contract': new Set([
    'kernel',
    'port',
    'port-api',
    'model',
    'model-api',
    'error',
    'error-api',
    'store-contract',
  ]),
  test: new Set([
    ...everything,
    'fake',
    'fixture',
    'store-contract',
    'test',
    'process',
  ]),
};

const specSupportRoles: ReadonlySet<string> = new Set(['fake', 'fixture']);

function testViolation(
  from: Classification,
  to: Classification,
): ArchRule | undefined {
  if (
    specSupportRoles.has(to.role) &&
    to.owner !== from.owner &&
    to.owner !== 'kernel'
  )
    return 'test-imports-own-package-support-only';
  if (
    to.role === 'store-contract' &&
    to.owner !== from.owner &&
    from.owner !== 'storage' &&
    from.owner !== 'server'
  )
    return 'store-contract-runs-against-its-fake-storage-and-server-adapters-only';
  if (from.owner !== 'server' && to.owner === 'server')
    return 'package-cannot-import-server';
  if (!allowedTargets.test.has(to.role)) return `test-cannot-import-${to.role}`;
  return;
}

export function violation(
  from: Classification,
  to: Classification,
): ArchRule | undefined {
  if (from.role === 'test') return testViolation(from, to);
  if (
    from.role === 'fake' &&
    to.owner !== from.owner &&
    (to.owner !== 'kernel' || to.role === 'fake') &&
    (from.owner !== 'server' || to.role === 'fake')
  )
    return 'fake-imports-own-package-only';
  if (
    from.role === 'fixture' &&
    to.owner !== from.owner &&
    !(to.owner === 'kernel' && to.role === 'kernel')
  )
    return 'fixture-imports-own-package-models-only';
  if (from.owner !== 'server' && to.owner === 'server')
    return 'package-cannot-import-server';
  if (from.owner === 'git' && domainSet.has(to.owner))
    return 'git-cannot-import-domain';
  if (from.owner === 'git' && to.owner === 'kernel' && to.role === 'rule-api')
    return;
  if (
    domainSet.has(from.owner) &&
    domainSet.has(to.owner) &&
    from.owner !== to.owner
  )
    return 'domain-cannot-import-another-domain';
  if (domainSet.has(from.owner) && to.owner === 'contracts')
    return 'domain-cannot-import-transport-contract';
  if (
    from.role === 'contract' &&
    to.role === 'rule-api' &&
    to.owner !== 'kernel'
  )
    return 'contract-imports-kernel-rules-only';
  if (from.owner !== to.owner) {
    if (to.owner === 'git' && to.role !== 'gateway-api')
      return 'git-public-api-only';
    if (domainSet.has(to.owner) && !domainApiRoles.has(to.role))
      return 'domain-public-api-only';
    if (to.owner === 'kernel' && (to.role === 'rule' || to.role === 'error'))
      return 'kernel-public-api-only';
    if (to.owner === 'storage' && to.role !== 'repository-api')
      return 'storage-public-api-only';
    if (to.owner === 'agents' && to.role !== 'gateway-api')
      return 'agents-public-api-only';
    if (to.owner === 'process' && to.role !== 'process-api')
      return 'process-public-api-only';
    if (
      to.owner === 'process' &&
      from.owner !== 'git' &&
      from.owner !== 'agents' &&
      from.role !== 'installer'
    )
      return 'process-importable-by-git-agents-installer';
  }
  if (
    from.role === 'gateway' &&
    to.owner === 'kernel' &&
    to.role === 'error-api'
  )
    return;
  if (!allowedTargets[from.role].has(to.role))
    return `${from.role}-cannot-import-${to.role}`;
  return;
}

export const serverPortContractTypes: Readonly<Record<string, string>> = {
  'apps/server/src/ports/live-channel.ts':
    'a live channel sends the notice the contract schema defines to the socket; a kernel or server copy of that union would drift from the schema the client parses',
};

export function allowedContractType(
  path: string,
  to: Classification,
  typeOnly: boolean,
): boolean {
  return (
    typeOnly &&
    to.role === 'contract' &&
    classify(path)?.role === 'server-port' &&
    serverPortContractTypes[path] !== undefined
  );
}

export const nodeGlobalRoles: ReadonlySet<Role> = new Set<Role>([
  'gateway',
  'gateway-api',
  'repository',
  'repository-api',
  'process',
  'process-api',
]);

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
const storageEngineModule = /^(?:fs|child_process)(?:\/|$)/;

export const externalPackages: Record<Role, readonly string[]> = {
  transport: [
    'fastify',
    '@fastify/*',
    'ws',
    'zod',
    '@modelcontextprotocol/sdk',
    'qrcode-terminal',
  ],
  'status-policy': ['fastify', '@fastify/sensible'],
  'use-case': [],
  installer: ['zod'],
  'installer-api': [],
  'domain-api': [],
  service: [],
  'rule-api': [],
  rule: [],
  'model-api': [],
  model: [],
  'port-api': [],
  port: [],
  'error-api': [],
  error: [],
  'repository-api': ['drizzle-orm', 'better-sqlite3'],
  repository: ['drizzle-orm', 'better-sqlite3'],
  'gateway-api': [],
  gateway: ['zod', 'trash', '@parcel/watcher'],
  'process-api': [],
  process: [],
  runtime: [],
  'server-port': [],
  bootstrap: ['fastify', '@fastify/*', 'better-sqlite3'],
  contract: ['zod'],
  config: ['zod'],
  kernel: [],
  fake: [],
  fixture: [],
  capture: [],
  'store-contract': ['vitest'],
  test: [],
};

const fixtureNodeModules = new Set(['fs', 'path', 'url']);
const captureNodeModules = new Set([
  'child_process',
  'fs',
  'os',
  'path',
  'url',
]);

function isNodeModule(name: string): boolean {
  return nodeModules.has(name) || nodeModules.has(name.split('/')[0] ?? '');
}

function packageName(module: string): string {
  const [scope = '', name = ''] = module.split('/');
  return scope.startsWith('@') ? `${scope}/${name}` : scope;
}

function allowedPackage(role: Role, module: string): boolean {
  const name = packageName(module);
  return externalPackages[role].some((entry) =>
    entry.endsWith('/*') ? name.startsWith(entry.slice(0, -1)) : entry === name,
  );
}

function forbiddenNodeModule(role: Role, name: string): boolean {
  const base = name.split('/')[0] ?? '';
  if (role === 'test') return false;
  if (role === 'capture') return !captureNodeModules.has(base);
  if (base === 'child_process') return role !== 'process';
  if (role === 'kernel' || role === 'fake') return true;
  if (role === 'fixture') return !fixtureNodeModules.has(base);
  if (typedRoles.has(role))
    return !((role === 'rule' || role === 'rule-api') && name === 'crypto');
  if (boundaryRoles.has(role)) return storageEngineModule.test(name);
  return false;
}

const runtimeNodeModules: Readonly<Record<string, readonly string[]>> = {
  'apps/server/src/runtime/data-directory.ts': ['fs'],
  'apps/server/src/runtime/directory-lock.ts': [
    'crypto',
    'fs/promises',
    'path',
  ],
  'apps/server/src/runtime/owner-socket.ts': ['fs'],
  'apps/server/src/runtime/lanes.ts': ['diagnostics_channel'],
  'apps/server/src/runtime/delay.ts': ['timers/promises'],
  'apps/server/src/runtime/start-application.ts': ['fs', 'path', 'os'],
};

export function runtimeNodeViolation(
  path: string,
  module: string,
): ArchRule | undefined {
  if (!module.startsWith('node:') && !isNodeModule(module)) return;
  if (classify(path)?.role !== 'runtime') return;
  const name = module.replace(/^node:/, '');
  return runtimeNodeModules[path]?.includes(name)
    ? undefined
    : 'runtime-node-allow-list';
}

export function forbiddenExternal(role: Role, module: string): boolean {
  if (module.startsWith('node:') || isNodeModule(module))
    return forbiddenNodeModule(role, module.replace(/^node:/, ''));
  if (role === 'test') return false;
  return !allowedPackage(role, module);
}
