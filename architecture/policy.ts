export const domainPackages = [
  'projects',
  'changes',
  'reviews',
  'files',
  'git-actions',
  'access',
] as const;

export const targetPackageExports: Record<string, Record<string, string>> = {
  ...Object.fromEntries(
    domainPackages.map((name) => [
      name,
      Object.fromEntries(
        ['services', 'models', 'ports', 'errors'].map((part) => [
          `./${part}`,
          `./src/${part}/index.ts`,
        ]),
      ),
    ]),
  ),
  git: Object.fromEntries(
    ['discovery', 'inspection', 'history', 'actions'].map((capability) => [
      `./${capability}`,
      `./src/${capability}/index.ts`,
    ]),
  ),
  contracts: Object.fromEntries(
    domainPackages.map((name) => [`./${name}`, `./src/${name}/index.ts`]),
  ),
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
};

export type Domain = (typeof domainPackages)[number];

export const migrationOwnership: Record<
  Domain,
  {
    legacyUseCaseFiles: readonly string[];
    repositories: readonly string[];
    ports: readonly string[];
  }
> = {
  projects: {
    legacyUseCaseFiles: [],
    repositories: [],
    ports: [],
  },
  changes: {
    legacyUseCaseFiles: [],
    repositories: [],
    ports: [],
  },
  reviews: {
    legacyUseCaseFiles: [],
    repositories: [],
    ports: [],
  },
  files: {
    legacyUseCaseFiles: [],
    repositories: [],
    ports: [],
  },
  'git-actions': {
    legacyUseCaseFiles: [],
    repositories: [],
    ports: [],
  },
  access: {
    legacyUseCaseFiles: [],
    repositories: [],
    ports: [],
  },
};

export const legacySupportRoles = {} as const;

export const gatewayPortOwnership = {
  projects: [],
  files: [],
  'git-actions': [],
} as const;

export type Role =
  | 'transport'
  | 'presentation'
  | 'status-policy'
  | 'controller'
  | 'domain-api'
  | 'domain-error'
  | 'model-api'
  | 'service'
  | 'port'
  | 'port-api'
  | 'model'
  | 'repository'
  | 'repository-api'
  | 'gateway'
  | 'gateway-api'
  | 'runtime'
  | 'bootstrap'
  | 'contract'
  | 'config'
  | 'test';

export type Classification = {
  role: Role;
  owner: string;
  legacy: boolean;
};

const domainSet = new Set<string>(domainPackages);
const gitCapabilities = new Set([
  'discovery',
  'inspection',
  'history',
  'actions',
  'shared',
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
  if (from === to || gitCapabilityDependencies[from]?.has(to)) return;
  return 'git-capability-dependency-order';
}

function classified(role: Role, owner: string, legacy = false): Classification {
  return { role, owner, legacy };
}

export function classify(
  path: string,
  legacyFiles: ReadonlySet<string>,
): Classification | undefined {
  const packageFile = /^packages\/([^/]+)\/src\/(.+)$/.exec(path);
  if (packageFile) {
    const name = packageFile[1] ?? '';
    const inside = packageFile[2] ?? '';
    if (name === 'client') return undefined;
    if (/\.(?:test|spec)\.ts$/.test(inside)) return classified('test', name);
    if (domainSet.has(name)) {
      if (inside === 'services/index.ts') return classified('domain-api', name);
      if (inside === 'errors/index.ts') return classified('domain-error', name);
      if (inside === 'models/index.ts') return classified('model-api', name);
      if (inside === 'ports/index.ts') return classified('port-api', name);
      if (inside.startsWith('services/')) return classified('service', name);
      if (inside.startsWith('ports/')) return classified('port', name);
      if (inside.startsWith('errors/')) return classified('model', name);
      if (inside.startsWith('models/')) return classified('model', name);
      return undefined;
    }
    if (name === 'git') {
      const capability = inside.split('/')[0] ?? '';
      if (gitCapabilities.has(capability))
        return classified(
          inside.endsWith('/index.ts') ? 'gateway-api' : 'gateway',
          name,
        );
      return legacyFiles.has(path)
        ? classified('gateway', name, true)
        : undefined;
    }
    if (name === 'agents') {
      const capability = inside.split('/')[0] ?? '';
      if (['commit-planning', 'models'].includes(capability))
        return classified(
          inside.endsWith('/index.ts') ? 'gateway-api' : 'gateway',
          name,
        );
      if (inside.startsWith('providers/')) return classified('gateway', name);
      return undefined;
    }
    if (name === 'storage') {
      if (
        inside === 'index.ts' ||
        /^repositories\/[^/]+\/index\.ts$/.test(inside)
      )
        return classified('repository-api', name);
      if (inside.startsWith('repositories/') || inside.startsWith('db/'))
        return classified('repository', name);
      if (inside.startsWith('models/') || inside.startsWith('ports/'))
        return classified(
          inside.startsWith('models/') ? 'model' : 'port',
          name,
        );
      return undefined;
    }
    if (name === 'contracts') {
      const section = inside.split('/')[0] ?? '';
      if (domainSet.has(section) || legacyFiles.has(path))
        return classified('contract', name, legacyFiles.has(path));
      return undefined;
    }
    return undefined;
  }

  if (!path.startsWith('apps/server/src/')) return undefined;
  const inside = path.slice('apps/server/src/'.length);
  if (/\.(?:test|spec)\.ts$/.test(inside)) return classified('test', 'server');
  if (inside.startsWith('controllers/'))
    return classified('controller', 'server');
  if (inside.startsWith('jobs/')) return classified('transport', 'server');
  if (inside.startsWith('bootstrap/')) return classified('bootstrap', 'server');
  if (inside.startsWith('runtime/')) return classified('runtime', 'server');
  if (inside.startsWith('adapters/storage/'))
    return classified('repository', 'server');
  if (inside.startsWith('adapters/')) return classified('gateway', 'server');
  if (inside.startsWith('http/')) {
    const http = inside.slice('http/'.length);
    if (
      http === 'protocol/clear-browser-session.ts' ||
      http === 'protocol/live-updates.ts'
    )
      return classified('transport', 'server');
    if (http.startsWith('scopes/') || http === 'helpers/paired-server.ts')
      return classified('bootstrap', 'server');
    if (
      /^(routes|mcp|middlewares|helpers|scopes)\//.test(http) ||
      http === 'owner-routes.ts'
    )
      return classified('transport', 'server');
    if (/^(mappers|schemas|errors)\//.test(http) || http === 'principal.ts')
      return classified('presentation', 'server');
    if (http === 'status-policy.ts')
      return classified('status-policy', 'server');
    if (http === 'server.ts' || http === 'owner-server.ts')
      return classified('bootstrap', 'server');
    if (http === 'static-files.ts') return classified('transport', 'server');
    return undefined;
  }
  if (inside.startsWith('cli/'))
    return classified(
      inside === 'cli/launcher.ts' ||
        inside === 'cli/index.ts' ||
        inside === 'cli/main.ts' ||
        inside === 'cli/service.ts'
        ? 'bootstrap'
        : 'transport',
      'server',
    );
  if (inside.startsWith('config/')) return classified('config', 'server');
  if (!legacyFiles.has(path)) return undefined;
  if (inside.startsWith('use-cases/errors/'))
    return classified('model', 'server', true);
  if (inside.startsWith('use-cases/helpers/'))
    return classified('test', 'server', true);
  if (inside.startsWith('use-cases/')) {
    const name = inside.slice('use-cases/'.length).replace(/\.ts$/, '');
    const role = legacySupportRoles[name as keyof typeof legacySupportRoles];
    return classified(role ?? 'service', 'server', true);
  }
  if (inside.startsWith('repositories/interfaces/'))
    return classified('port', 'server', true);
  if (inside.startsWith('repositories/errors/'))
    return classified('model', 'server', true);
  if (inside.startsWith('repositories/') || inside.startsWith('db/'))
    return classified('repository', 'server', true);
  if (
    inside.startsWith('filesystem/interfaces/') ||
    inside.startsWith('agents/interfaces/')
  )
    return classified('port', 'server', true);
  if (inside.startsWith('filesystem/errors/'))
    return classified('model', 'server', true);
  if (inside.startsWith('filesystem/') || inside.startsWith('agents/'))
    return classified('gateway', 'server', true);
  if (inside.startsWith('models/')) return classified('model', 'server', true);
  return undefined;
}

export const allowedTargets: Record<Role, ReadonlySet<Role>> = {
  transport: new Set([
    'transport',
    'presentation',
    'status-policy',
    'controller',
    'contract',
    'config',
  ]),
  presentation: new Set([
    'presentation',
    'contract',
    'model',
    'model-api',
    'domain-error',
  ]),
  'status-policy': new Set([
    'domain-error',
    'gateway-api',
    'model',
    'presentation',
    'runtime',
  ]),
  controller: new Set(['domain-api', 'model-api', 'contract', 'runtime']),
  'domain-api': new Set([
    'service',
    'port',
    'port-api',
    'model',
    'model-api',
    'domain-error',
  ]),
  'domain-error': new Set(['model']),
  'model-api': new Set(['model']),
  'port-api': new Set(['port', 'model', 'model-api']),
  service: new Set(['port', 'model', 'model-api', 'domain-error']),
  port: new Set(['port', 'model', 'model-api', 'contract']),
  model: new Set(['model', 'model-api', 'contract']),
  repository: new Set([
    'repository',
    'domain-error',
    'port',
    'port-api',
    'model',
    'model-api',
    'contract',
    'config',
  ]),
  'repository-api': new Set(['repository', 'port', 'port-api', 'model']),
  gateway: new Set([
    'gateway',
    'gateway-api',
    'domain-error',
    'port',
    'port-api',
    'model',
    'model-api',
    'contract',
    'config',
  ]),
  'gateway-api': new Set(['gateway', 'port', 'model']),
  runtime: new Set([
    'runtime',
    'port',
    'model',
    'model-api',
    'contract',
    'config',
  ]),
  bootstrap: new Set([
    'transport',
    'presentation',
    'status-policy',
    'controller',
    'domain-api',
    'domain-error',
    'model-api',
    'service',
    'port',
    'port-api',
    'model',
    'repository',
    'repository-api',
    'gateway',
    'gateway-api',
    'runtime',
    'bootstrap',
    'contract',
    'config',
  ]),
  contract: new Set(['contract']),
  config: new Set(['config', 'contract', 'model']),
  test: new Set([
    'transport',
    'presentation',
    'controller',
    'domain-api',
    'domain-error',
    'model-api',
    'service',
    'port',
    'port-api',
    'model',
    'repository',
    'repository-api',
    'gateway',
    'gateway-api',
    'runtime',
    'bootstrap',
    'contract',
    'config',
    'test',
  ]),
};

export function violation(
  from: Classification,
  to: Classification,
): string | undefined {
  if (from.role === 'test') return undefined;
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
  if (
    from.owner !== to.owner &&
    to.owner === 'git' &&
    to.role !== 'gateway-api'
  )
    return 'git-public-api-only';
  if (
    from.owner !== to.owner &&
    domainSet.has(to.owner) &&
    !['domain-api', 'domain-error', 'model-api', 'port-api'].includes(to.role)
  )
    return 'domain-public-api-only';
  if (
    from.owner !== to.owner &&
    to.owner === 'storage' &&
    to.role !== 'repository-api'
  )
    return 'storage-public-api-only';
  if (
    from.owner !== to.owner &&
    to.owner === 'agents' &&
    to.role !== 'gateway-api'
  )
    return 'agents-public-api-only';
  if (!allowedTargets[from.role].has(to.role))
    return `${from.role}-cannot-import-${to.role}`;
  return undefined;
}

export function forbiddenExternal(role: Role, module: string): boolean {
  return (
    (['controller', 'service', 'port', 'model'].includes(role) &&
      module === 'zod') ||
    ([
      'transport',
      'presentation',
      'status-policy',
      'controller',
      'service',
      'port',
      'model',
      'contract',
      'config',
    ].includes(role) &&
      /^(?:better-sqlite3|drizzle-orm(?:\/|$)|node:(?:fs(?:\/|$)|child_process(?:\/|$)))/.test(
        module,
      ))
  );
}
