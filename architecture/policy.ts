export const domainPackages = [
  'projects',
  'changes',
  'reviews',
  'files',
  'git-actions',
  'access',
] as const;

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
    legacyUseCaseFiles: [
      'collect-absent-worktrees',
      'find-projects',
      'list-file-preferences',
      'list-worktree-paths',
      'register-project',
      'remove-project',
      'resolve-worktree',
      'set-file-preference',
    ],
    repositories: [
      'file-preference-repository',
      'inventory-repository',
      'project-removal-repository',
      'worktree-presence-repository',
    ],
    ports: [
      'file-preference-store',
      'inventory-store',
      'project-removal-store',
      'worktree-presence-store',
      'worktree-source',
    ],
  },
  changes: {
    legacyUseCaseFiles: [
      'fingerprint-change',
      'list-commits',
      'observe-worktree-sides',
      'read-change-diffs',
      'read-change-lines',
      'read-commit-files',
      'read-worktree-changes',
      'read-worktree-status',
      'resolve-history-checkout',
      'resolve-inspection-worktree',
    ],
    repositories: ['worktree-status-repository'],
    ports: ['worktree-status-store'],
  },
  reviews: {
    legacyUseCaseFiles: [
      'comment-threads',
      'list-reviewed-files',
      'mark-comments-seen',
      'published-review',
      'remove-reviewed-file',
      'set-reviewed-files',
      'set-reviewed-file',
      'validate-comment-command',
    ],
    repositories: [
      'comment-repository',
      'reviewed-file-repository',
      'reviewed-layer-repository',
      'review-repository',
    ],
    ports: ['comment-store', 'reviewed-file-store', 'review-store'],
  },
  files: {
    legacyUseCaseFiles: [
      'asset-media-types',
      'edit-file',
      'list-directory',
      'read-asset',
      'read-preview-assets',
      'read-text-file',
      'resolve-readable-worktree',
      'validate-file-path',
    ],
    repositories: [],
    ports: [],
  },
  'git-actions': {
    legacyUseCaseFiles: ['commit-drafts', 'execute-git-action', 'resolve-action-worktree'],
    repositories: ['git-action-repository'],
    ports: ['git-action-store'],
  },
  access: {
    legacyUseCaseFiles: ['device-details', 'pairing'],
    repositories: ['pairing-repository'],
    ports: ['pairing-store'],
  },
};

export const legacySupportRoles = {
  'asset-media-types': 'model',
  'device-details': 'model',
  'fingerprint-change': 'model',
  'observe-worktree-sides': 'gateway',
  'resolve-action-worktree': 'gateway',
  'resolve-history-checkout': 'gateway',
  'resolve-inspection-worktree': 'gateway',
  'resolve-readable-worktree': 'gateway',
  'resolve-worktree': 'gateway',
  'validate-comment-command': 'model',
  'validate-file-path': 'model',
} as const;

export const gatewayPortOwnership = {
  projects: ['project-folders'],
  files: ['file-reader', 'file-writer', 'ignored-entries', 'worktree-files'],
  'git-actions': ['commit-generator'],
} as const;

export const lifecycleOwnership = {
  'data-directory.ts': 'bootstrap',
  'device-directory.ts': 'gateway',
  'git-action-coordinator.ts': 'controller',
  'lanes.ts': 'runtime',
  'launch-limit.ts': 'runtime',
  'live-updates.ts': 'gateway',
  'owner-socket.ts': 'bootstrap',
  'runtime.ts': 'bootstrap',
  'shared-reads.ts': 'runtime',
  'startup-lock.ts': 'bootstrap',
  'worktree-directory.ts': 'gateway',
} as const;

export const lifecycleTargets = {
  'data-directory.ts': 'server/bootstrap',
  'device-directory.ts': 'access gateway',
  'git-action-coordinator.ts': 'server/controllers/git-actions',
  'lanes.ts': 'server/runtime',
  'launch-limit.ts': 'server/runtime',
  'live-updates.ts': 'server/adapters/events',
  'owner-socket.ts': 'server/bootstrap',
  'runtime.ts': 'server/bootstrap',
  'shared-reads.ts': 'server/runtime',
  'startup-lock.ts': 'server/bootstrap',
  'worktree-directory.ts': 'projects gateway',
} as const;

export type Role =
  | 'transport'
  | 'presentation'
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
const gitCapabilities = new Set(['discovery', 'inspection', 'history', 'actions', 'shared']);

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
        return classified(inside.endsWith('/index.ts') ? 'gateway-api' : 'gateway', name);
      return legacyFiles.has(path) ? classified('gateway', name, true) : undefined;
    }
    if (name === 'storage') {
      if (inside === 'index.ts') return classified('repository-api', name);
      if (inside.startsWith('repositories/') || inside.startsWith('db/'))
        return classified('repository', name);
      if (inside.startsWith('models/') || inside.startsWith('ports/'))
        return classified(inside.startsWith('models/') ? 'model' : 'port', name);
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
  if (inside.startsWith('controllers/')) return classified('controller', 'server');
  if (inside.startsWith('jobs/')) return classified('transport', 'server');
  if (inside.startsWith('bootstrap/')) return classified('bootstrap', 'server');
  if (inside.startsWith('runtime/')) return classified('runtime', 'server');
  if (inside.startsWith('adapters/storage/')) return classified('repository', 'server');
  if (inside.startsWith('adapters/')) return classified('gateway', 'server');
  if (inside.startsWith('http/')) {
    const http = inside.slice('http/'.length);
    if (/^(routes|mcp|middlewares|helpers)\//.test(http) || http === 'owner-routes.ts')
      return classified('transport', 'server');
    if (/^(mappers|schemas|errors)\//.test(http) || http === 'principal.ts')
      return classified('presentation', 'server');
    if (http === 'server.ts' || http === 'owner-server.ts')
      return classified('bootstrap', 'server');
    if (http === 'static-files.ts') return classified('transport', 'server');
    return undefined;
  }
  if (inside.startsWith('cli/'))
    return classified(
      inside === 'cli/launcher.ts' || inside === 'cli/index.ts'
        ? 'bootstrap'
        : 'transport',
      'server',
    );
  if (inside.startsWith('config/')) return classified('config', 'server');
  if (!legacyFiles.has(path)) return undefined;
  if (inside === 'app.ts' || inside === 'main.ts')
    return classified('bootstrap', 'server', true);
  if (inside === 'application.ts') return classified('controller', 'server', true);
  if (inside.startsWith('use-cases/errors/')) return classified('model', 'server', true);
  if (inside.startsWith('use-cases/helpers/')) return classified('test', 'server', true);
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
  if (inside.startsWith('filesystem/interfaces/') || inside.startsWith('agents/interfaces/'))
    return classified('port', 'server', true);
  if (inside.startsWith('filesystem/errors/'))
    return classified('model', 'server', true);
  if (inside.startsWith('filesystem/') || inside.startsWith('agents/'))
    return classified('gateway', 'server', true);
  if (inside.startsWith('models/')) return classified('model', 'server', true);
  if (inside.startsWith('lifecycle/errors/'))
    return classified('model', 'server', true);
  if (inside.startsWith('lifecycle/service/'))
    return classified('bootstrap', 'server', true);
  if (inside.startsWith('lifecycle/')) {
    const file = inside.slice('lifecycle/'.length);
    const role = lifecycleOwnership[file as keyof typeof lifecycleOwnership];
    return role ? classified(role, 'server', true) : undefined;
  }
  return undefined;
}

export const allowedTargets: Record<Role, ReadonlySet<Role>> = {
  transport: new Set(['transport', 'presentation', 'controller', 'contract', 'model', 'model-api', 'domain-error', 'config']),
  presentation: new Set(['presentation', 'contract', 'model', 'model-api', 'domain-error']),
  controller: new Set(['domain-api', 'domain-error', 'model-api', 'model', 'port', 'contract', 'runtime', 'config']),
  'domain-api': new Set(['service', 'port', 'port-api', 'model', 'model-api', 'domain-error']),
  'domain-error': new Set(['model']),
  'model-api': new Set(['model']),
  'port-api': new Set(['port', 'model', 'model-api']),
  service: new Set(['port', 'model', 'model-api', 'domain-error', 'gateway-api', 'repository-api', 'contract', 'config']),
  port: new Set(['port', 'model', 'model-api', 'contract']),
  model: new Set(['model', 'model-api', 'contract']),
  repository: new Set(['repository', 'port', 'port-api', 'model', 'model-api', 'contract', 'config']),
  'repository-api': new Set(['repository', 'port', 'model']),
  gateway: new Set(['gateway', 'port', 'port-api', 'model', 'model-api', 'contract', 'config']),
  'gateway-api': new Set(['gateway', 'port', 'model']),
  runtime: new Set(['runtime', 'port', 'model', 'model-api', 'contract', 'config']),
  bootstrap: new Set(['transport', 'presentation', 'controller', 'domain-api', 'domain-error', 'model-api', 'service', 'port', 'port-api', 'model', 'repository', 'repository-api', 'gateway', 'gateway-api', 'runtime', 'bootstrap', 'contract', 'config']),
  contract: new Set(['contract']),
  config: new Set(['config', 'contract', 'model']),
  test: new Set(['transport', 'presentation', 'controller', 'domain-api', 'domain-error', 'model-api', 'service', 'port', 'port-api', 'model', 'repository', 'repository-api', 'gateway', 'gateway-api', 'runtime', 'bootstrap', 'contract', 'config', 'test']),
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
  if (domainSet.has(from.owner) && domainSet.has(to.owner) && from.owner !== to.owner)
    return 'domain-cannot-import-another-domain';
  if (domainSet.has(from.owner) && to.owner === 'contracts')
    return 'domain-cannot-import-transport-contract';
  if (from.owner !== to.owner && to.owner === 'git' && to.role !== 'gateway-api')
    return 'git-public-api-only';
  if (from.owner !== to.owner && domainSet.has(to.owner) &&
      !['domain-api', 'domain-error', 'model-api', 'port-api'].includes(to.role))
    return 'domain-public-api-only';
  if (from.owner !== to.owner && to.owner === 'storage' && to.role !== 'repository-api')
    return 'storage-public-api-only';
  if (!allowedTargets[from.role].has(to.role))
    return `${from.role}-cannot-import-${to.role}`;
  return undefined;
}

export function forbiddenExternal(role: Role, module: string): boolean {
  return (
    ['transport', 'presentation', 'controller', 'service', 'port', 'model', 'contract', 'config'].includes(role) &&
    /^(?:better-sqlite3|drizzle-orm(?:\/|$)|node:(?:fs(?:\/|$)|child_process(?:\/|$)))/.test(module)
  );
}
