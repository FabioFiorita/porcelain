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
    './desktop': './src/desktop/index.ts',
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
  client: { './access/rules': './src/features/access/rules/index.ts' },
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
  'desktop',
  'desktop-gateway',
  'desktop-server-api',
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
  'route',
  'shell',
  'view',
  'query',
  'command',
  'store',
  'live',
  'overlays',
  'web-rule',
  'adapter',
  'api',
  'feature-index',
  'web-shared',
  'ui',
  'browser-spec',
  'browser-kit',
  'web-rule-spec',
  'web-config',
  'web-limits',
  'web-entry',
  'client-rules-api',
  'mobile-config',
] as const;

export type Role = (typeof roles)[number];

export const webRoles: ReadonlySet<Role> = new Set<Role>([
  'route',
  'shell',
  'view',
  'query',
  'command',
  'store',
  'live',
  'overlays',
  'web-rule',
  'adapter',
  'api',
  'feature-index',
  'web-shared',
  'ui',
  'browser-spec',
  'browser-kit',
  'web-rule-spec',
  'web-config',
  'web-limits',
  'web-entry',
  'client-rules-api',
]);

export const webDomains = [
  'access',
  'projects',
  'changes',
  'files',
  'git-actions',
  'history',
  'reviews',
  'preferences',
  'live',
] as const;

export const shadcnRegistry: ReadonlySet<string> = new Set([
  'accordion',
  'alert',
  'alert-dialog',
  'aspect-ratio',
  'attachment',
  'avatar',
  'badge',
  'breadcrumb',
  'bubble',
  'button',
  'button-group',
  'calendar',
  'card',
  'carousel',
  'chart',
  'checkbox',
  'collapsible',
  'combobox',
  'command',
  'context-menu',
  'dialog',
  'direction',
  'drawer',
  'dropdown-menu',
  'empty',
  'field',
  'form',
  'hover-card',
  'input',
  'input-group',
  'input-otp',
  'item',
  'kbd',
  'label',
  'marker',
  'menubar',
  'message',
  'message-scroller',
  'native-select',
  'navigation-menu',
  'pagination',
  'popover',
  'progress',
  'questionnaire',
  'radio-group',
  'resizable',
  'scroll-area',
  'select',
  'separator',
  'sheet',
  'sidebar',
  'skeleton',
  'slider',
  'sonner',
  'spinner',
  'switch',
  'table',
  'tabs',
  'textarea',
  'toast',
  'toggle',
  'toggle-group',
  'tooltip',
]);

export const archRules = [
  'mobile-imports-mobile-client-and-contracts-only',
  'mobile-routes-import-feature-index',
  'mobile-features-import-feature-index',
  'mobile-shared-imports-no-owner',
  'mobile-nothing-imports-routes',
  'client-imports-client-and-contracts-only',
  'client-public-api-only',
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
  'worktree-use-case-checks',
  'unused-export',
  'unused-dependency',
  'web-shadcn-ui-owner',
  'web-shadcn-primitive-owner',
  'web-no-runtime-fixture',
  'web-routes-import-feature-index',
  'web-features-import-feature-index',
  'web-shared-imports-no-owner',
  'web-nothing-imports-routes',
  'web-baseline',
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
  'probe-shape',
  'tsconfig',
  'package-scripts',
  'vitest-config',
  'cruiser-config',
  'ci-steps',
  'manual-audits',
  'pre-push-hook',
  'code-outside-lint-roots',
  'prose-outside-skills',
  'format-config',
  'vite-config',
  'route-tree',
  'react-compiler',
  'web-baseline',
  'web-journey-baseline',
  'shadcn-ui-pinned',
  'web-feature-map',
  'duplicate-code',
] as const;

export type StyleRule = (typeof styleRules)[number];

export const generatedRouteTree = 'apps/web/src/routeTree.gen.ts';

export function entryImportsRouteTree(from: string, to: string): boolean {
  return from === 'apps/web/src/main.tsx' && to === generatedRouteTree;
}

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
  if (name === 'client') {
    const feature = /^features\/([^/]+)\/rules\/([^/]+\.ts)$/.exec(inside);
    if (!feature || !webDomainSet.has(feature[1] ?? '')) return;
    const file = feature[2] ?? '';
    if (!kebabFile.test(file.replace(/\.spec\.ts$/, '.ts'))) return;
    return classified(
      file === 'index.ts'
        ? 'client-rules-api'
        : file.endsWith('.spec.ts')
          ? 'web-rule-spec'
          : 'web-rule',
      name,
    );
  }
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
    if (domainSet.has(section) || section === 'shared' || section === 'desktop')
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

const webFeatureFolders = ['queries', 'commands', 'rules', 'adapters', 'views'];
const webFeatureFiles: Readonly<Record<string, Role>> = {
  'api.ts': 'api',
  'store.ts': 'store',
  'live.ts': 'live',
  'overlays.ts': 'overlays',
  'index.ts': 'feature-index',
};
const webFolderRoles: Readonly<Record<string, Role>> = {
  queries: 'query',
  commands: 'command',
  rules: 'web-rule',
  adapters: 'adapter',
  views: 'view',
};
const webDomainSet: ReadonlySet<string> = new Set(webDomains);
const webCode = /\.tsx?$/;
const kebabFile = /^[a-z0-9]+(?:-[a-z0-9]+)*\.tsx?$/;

function mobilePart(path: string): Role | undefined {
  if (path === 'apps/mobile/app.config.ts') return 'mobile-config';
  if (/^apps\/mobile\/src\/shared\/rules\/.+\.spec\.ts$/.test(path))
    return 'web-rule-spec';
  if (/^apps\/mobile\/src\/shared\/rules\/[a-z-]+\.ts$/.test(path))
    return 'web-rule';
  const inside = path.slice('apps/mobile/src/'.length);
  if (!path.startsWith('apps/mobile/src/')) return;
  if (/^app\/(?:[^/]+\/)*[^/]+\.tsx$/.test(inside)) return 'route';
  if (/^shell\/[^/]+(?:\.(?:ios|android))?\.tsx?$/.test(inside)) return 'shell';
  if (
    /^shared\/(?:[a-z-]+\/)?[a-z-]+(?:\.(?:ios|android))?\.tsx?$/.test(inside)
  )
    return 'web-shared';
  const feature = /^features\/([^/]+)\/(.+)$/.exec(inside);
  if (!feature || !webDomainSet.has(feature[1] ?? '')) return;
  if (feature[2] === 'index.ts') return 'feature-index';
  if (/^views\/[a-z-]+(?:\.(?:ios|android))?\.tsx$/.test(feature[2] ?? ''))
    return 'view';
  if (/^adapters\/[a-z-]+(?:\.(?:ios|android))?\.tsx?$/.test(feature[2] ?? ''))
    return 'adapter';
  return;
}

export function webPart(path: string): Role | undefined {
  if (path.startsWith('apps/mobile/')) return mobilePart(path);
  if (path.startsWith('packages/client/src/')) {
    const classified = classifyPackage(
      'client',
      path.slice('packages/client/src/'.length),
    );
    return classified?.role === 'client-rules-api'
      ? 'web-rule'
      : classified?.role;
  }
  if (path === 'apps/web/vite.config.ts') return 'web-config';
  if (/^apps\/web\/spec\/(?:browser|negative)\//.test(path))
    return 'browser-spec';
  if (path.startsWith('apps/web/spec/kit/')) return 'browser-kit';
  if (!path.startsWith('apps/web/src/') || !webCode.test(path)) return;
  const inside = path.slice('apps/web/src/'.length);
  const parts = inside.split('/');
  const top = parts[0] ?? '';
  if (inside === 'main.tsx' || path === generatedRouteTree) return 'web-entry';
  if (inside === 'config/limits.ts') return 'web-limits';
  if (top === 'routes') return 'route';
  if (top === 'app') return inside.endsWith('.tsx') ? 'shell' : undefined;
  if (top === 'components' && parts[1] === 'ui') return 'ui';
  if (top === 'shared') return 'web-shared';
  if (top !== 'features' || parts.length < 3) return;
  const part = parts[2] ?? '';
  if (parts.length === 3) return webFeatureFiles[part];
  if (part === 'rules' && inside.endsWith('.spec.ts')) return 'web-rule-spec';
  return part === 'api' ? 'api' : webFolderRoles[part];
}

function classifyWeb(path: string): Classification | undefined {
  const owner = 'web';
  const role = webPart(path);
  if (role === undefined) return;
  const inside = path.slice('apps/web/'.length).split('/');
  const name = inside.at(-1) ?? '';
  if (role === 'browser-spec')
    return inside.length === 3 && /^[a-z0-9-]+\.browser\.ts$/.test(name)
      ? classified(role, owner)
      : undefined;
  if (role === 'browser-kit')
    return inside.length === 3 && kebabFile.test(name) && name.endsWith('.ts')
      ? classified(role, owner)
      : undefined;
  if (role === 'web-rule-spec')
    return inside.length === 5 &&
      webDomainSet.has(inside[2] ?? '') &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*\.spec\.ts$/.test(name)
      ? classified(role, owner)
      : undefined;
  if (role === 'shell')
    return inside.length === 3 && kebabFile.test(name)
      ? classified(role, owner)
      : undefined;
  if (role === 'ui')
    return inside.length === 4 && shadcnRegistry.has(name.replace(/\.tsx$/, ''))
      ? classified(role, owner)
      : undefined;
  if (role === 'web-shared')
    return inside.length <= 4 && kebabFile.test(name)
      ? classified(role, owner)
      : undefined;
  if (role === 'route' || role === 'web-entry' || role === 'web-config')
    return classified(role, owner);
  if (role === 'web-limits') return classified(role, owner);
  const [, , domain = '', part = ''] = inside;
  if (!webDomainSet.has(domain)) return;
  if (inside.length === 4)
    return webFeatureFiles[part] === role ? classified(role, owner) : undefined;
  if (inside.length !== 5 || !webFeatureFolders.includes(part)) return;
  if (!kebabFile.test(name)) return;
  if (role === 'view' && !name.endsWith('.tsx')) return;
  if (
    (role === 'query' || role === 'command' || role === 'web-rule') &&
    name.endsWith('.tsx')
  )
    return;
  return classified(role, owner);
}

export function webLayout(path: string): string {
  if (path.startsWith('apps/web/spec/'))
    return 'apps/web/spec/browser/<journey>.browser.ts holds the journeys, apps/web/spec/negative/<name>.browser.ts the planted journeys the runner must reject, and apps/web/spec/kit/<part>.ts the journey kit; nothing else';
  const inside = path.slice('apps/web/src/'.length);
  if (inside.startsWith('features/'))
    return `features/<domain>/ holds api.ts, store.ts, live.ts, overlays.ts, index.ts and the flat folders queries/, commands/, rules/ (.ts), adapters/ and views/ (.tsx); <domain> is one of ${webDomains.join(', ')}`;
  if (inside.startsWith('app/'))
    return 'app/ holds the shell only: flat <name>.tsx pieces for the root layout, settings dialog, error and pending views';
  if (inside.startsWith('components/'))
    return 'components/ui/ holds shadcn registry components, added through the shadcn CLI; product views live in features/<domain>/views/';
  return 'apps/web/src holds main.tsx, routes/, app/, components/ui/, shared/, config/limits.ts and features/<domain>/';
}

const nestedRoleFolder =
  /^(?:packages\/[^/]+\/src\/(?:services|models|rules|ports|errors)\/[^/]+\/|apps\/server\/src\/(?:ports\/[^/]+\/|use-cases\/[^/]+\/[^/]+\/)|apps\/web\/src\/features\/[^/]+\/(?:queries|commands|rules|adapters|views)\/[^/]+\/)/;

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
  if (/^apps\/server\/spec\/fixtures\/.+\.ts$/.test(path))
    return classified('fixture', 'server');
  if (/^apps\/server\/spec\/fakes\/.+\.ts$/.test(path))
    return classified('fake', 'server');
  const packageFile = /^packages\/([^/]+)\/src\/(.+)$/.exec(path);
  if (packageFile)
    return classifyPackage(packageFile[1] ?? '', packageFile[2] ?? '');
  if (
    path === 'apps/server/src/bootstrap/desktop.ts' ||
    path === 'apps/server/src/config/desktop-settings.ts'
  )
    return classified('desktop-server-api', 'server');
  if (path.startsWith('apps/desktop/src/')) {
    if (path.endsWith('.spec.ts')) return classified('test', 'desktop');
    if (path.startsWith('apps/desktop/src/adapters/'))
      return classified('desktop-gateway', 'desktop');
    if (path.startsWith('apps/desktop/src/rules/'))
      return classified('rule', 'desktop');
    return classified('desktop', 'desktop');
  }
  if (path.startsWith('apps/server/src/'))
    return classifyServer(path.slice('apps/server/src/'.length));
  if (path.startsWith('apps/mobile/')) {
    const role = mobilePart(path);
    return role === undefined ? undefined : classified(role, 'mobile');
  }
  if (path.startsWith('apps/web/')) return classifyWeb(path);
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
  'desktop',
  'desktop-server-api',
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
  'mobile-config': new Set(['web-rule']),
  'client-rules-api': new Set(['web-rule']),
  desktop: new Set([
    'desktop',
    'desktop-gateway',
    'rule',
    'contract',
    'desktop-server-api',
  ]),
  'desktop-gateway': new Set(['contract']),
  'desktop-server-api': new Set([
    'bootstrap',
    'config',
    'transport',
    'installer-api',
  ]),
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
  route: new Set(['feature-index', 'shell', 'web-shared', 'web-limits']),
  shell: new Set(['feature-index', 'shell', 'ui', 'web-shared', 'web-limits']),
  view: new Set([
    'client-rules-api',
    'view',
    'query',
    'command',
    'store',
    'overlays',
    'web-rule',
    'adapter',
    'ui',
    'web-shared',
    'web-limits',
    'feature-index',
  ]),
  query: new Set([
    'client-rules-api',
    'query',
    'api',
    'store',
    'web-rule',
    'web-shared',
    'web-limits',
    'contract',
  ]),
  command: new Set([
    'client-rules-api',
    'command',
    'query',
    'api',
    'store',
    'web-rule',
    'web-shared',
    'web-limits',
    'contract',
  ]),
  store: new Set([
    'client-rules-api',
    'web-rule',
    'web-shared',
    'web-limits',
    'contract',
  ]),
  live: new Set(['query', 'web-rule', 'web-shared', 'contract']),
  overlays: new Set(['contract']),
  'web-rule': new Set([
    'client-rules-api',
    'web-rule',
    'web-limits',
    'contract',
  ]),
  adapter: new Set([
    'adapter',
    'store',
    'web-rule',
    'web-shared',
    'web-limits',
    'contract',
  ]),
  api: new Set([
    'client-rules-api',
    'web-rule',
    'web-shared',
    'web-limits',
    'contract',
  ]),
  'feature-index': new Set([
    'client-rules-api',
    'view',
    'query',
    'command',
    'store',
    'live',
    'overlays',
    'web-rule',
    'adapter',
  ]),
  'web-shared': new Set(['web-shared', 'web-limits', 'contract']),
  ui: new Set(['ui', 'web-shared']),
  'browser-spec': new Set(['browser-kit', 'contract']),
  'browser-kit': new Set(['browser-kit', 'web-entry', 'contract']),
  'web-rule-spec': new Set(['web-rule', 'web-limits', 'contract']),
  'web-config': new Set(),
  'web-limits': new Set(['contract']),
  'web-entry': new Set([
    'route',
    'shell',
    'feature-index',
    'ui',
    'web-shared',
    'web-limits',
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
  if (
    from.owner !== 'server' &&
    to.owner === 'server' &&
    !(from.owner === 'desktop' && to.role === 'desktop-server-api')
  )
    return 'package-cannot-import-server';
  if (
    from.owner === 'desktop' &&
    to.owner === 'desktop' &&
    to.role === 'desktop-gateway'
  )
    return;
  if (!allowedTargets.test.has(to.role)) return `test-cannot-import-${to.role}`;
  return;
}

export function violation(
  from: Classification,
  to: Classification,
): ArchRule | undefined {
  if (
    from.owner === 'mobile' &&
    !['mobile', 'client', 'contracts'].includes(to.owner)
  )
    return 'mobile-imports-mobile-client-and-contracts-only';
  if (
    from.owner === 'client' &&
    to.owner !== 'client' &&
    to.owner !== 'contracts'
  )
    return 'client-imports-client-and-contracts-only';
  if (
    to.owner === 'client' &&
    from.owner !== 'client' &&
    to.role !== 'client-rules-api'
  )
    return 'client-public-api-only';
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
  if (
    from.owner !== 'server' &&
    to.owner === 'server' &&
    !(from.owner === 'desktop' && to.role === 'desktop-server-api')
  )
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

export const serverProcessImporters: Readonly<Record<string, string>> = {
  'apps/server/src/adapters/access/mac-network-command.ts':
    'macOS has no procfs route and ARP tables; this gateway runs fixed route and arp commands through the process public API, with no request input',
};

export function allowedProcessImport(
  path: string,
  to: Classification,
): boolean {
  return (
    to.role === 'process-api' &&
    classify(path)?.role === 'gateway' &&
    serverProcessImporters[path] !== undefined
  );
}

export const nodeGlobalRoles: ReadonlySet<Role> = new Set<Role>([
  'desktop',
  'desktop-gateway',
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
  'desktop',
  'desktop-server-api',
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
  'mobile-config': ['expo'],
  'client-rules-api': [],
  desktop: ['electron', 'fix-path', 'zod'],
  'desktop-gateway': [],
  'desktop-server-api': [],
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
  route: [],
  shell: [],
  view: [],
  query: [],
  command: [],
  store: [],
  live: [],
  overlays: [],
  'web-rule': [],
  adapter: [],
  api: [],
  'feature-index': [],
  'web-shared': [],
  ui: [],
  'browser-spec': [],
  'browser-kit': [],
  'web-rule-spec': [],
  'web-config': [],
  'web-limits': [],
  'web-entry': [],
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
  if (webRoles.has(role))
    return (
      role !== 'web-config' &&
      (module.startsWith('node:') || isNodeModule(module))
    );
  if (module.startsWith('node:') || isNodeModule(module))
    return forbiddenNodeModule(role, module.replace(/^node:/, ''));
  if (role === 'test') return false;
  return !allowedPackage(role, module);
}

const rolePurposes: Record<Role, string> = {
  'mobile-config':
    'the Expo build configuration, which selects the installation identity and native plugins',
  'client-rules-api': "a shared client feature's public pure rules entry",
  desktop: 'the Electron desktop app in apps/desktop/src',
  'desktop-gateway':
    'a desktop adapter in apps/desktop/src/adapters/ that wraps Electron and the operating system; only the desktop and its own specs reach it',
  'desktop-server-api':
    "the server's entry for the desktop app, bootstrap/desktop.ts and config/desktop-settings.ts",
  transport:
    "the server's HTTP, MCP and CLI edge, which turns a request into one use-case call",
  'status-policy':
    'http/status-policy.ts, which maps outcomes to HTTP statuses',
  'use-case':
    'a server use case in use-cases/<area>/, which runs domain services inside lanes',
  installer: 'the server installer in installer/',
  'installer-api': "installer/index.ts, the installer's public entry",
  'domain-api': "a domain's services/index.ts, its public service entry",
  service: "a domain service, the domain's operation logic",
  'rule-api': 'a rules/index.ts, the public entry to pure rules',
  rule: 'a pure rule',
  'model-api': 'a models/index.ts, the public entry to models',
  model: 'a model, the shape of domain data',
  'port-api': 'a ports/index.ts, the public entry to ports',
  port: 'a port, the interface a domain needs from the outside',
  'error-api': 'an errors/index.ts, the public entry to named errors',
  error: 'a named error',
  'repository-api':
    "the storage package's public entry, index.ts or repositories/<domain>/index.ts",
  repository:
    'storage internals: the SQLite schema and the repositories that implement domain ports',
  'gateway-api': "a git or agents capability's index.ts, its public entry",
  gateway:
    'an adapter that implements ports over git, coding agents, the file system or the network (packages/git, packages/agents, apps/server/src/adapters)',
  'process-api':
    'packages/process index.ts, the one entry for running child processes',
  process: 'packages/process internals, the only code that spawns a process',
  runtime:
    'the server runtime in apps/server/src/runtime: lanes, locks and the data directory',
  'server-port':
    'a server port in apps/server/src/ports, an interface server adapters implement',
  bootstrap:
    'the composition root in apps/server/src/bootstrap, which wires adapters into use cases',
  contract:
    'the HTTP contract in packages/contracts, the schemas server and clients share',
  config: 'server configuration and limits in apps/server/src/config',
  kernel: 'the kernel models and ports every package shares',
  fake: 'a fake in spec/fakes/ that stands in for a port in specs',
  fixture: 'spec data in spec/fixtures/',
  capture:
    'spec/fixtures/capture.ts, the script that records real output as fixtures',
  'store-contract':
    'a store contract in spec/contracts/, the spec every implementation of a store passes',
  test: 'a .spec.ts behaviour spec',
  route: 'a TanStack Router file in apps/web/src/routes/',
  shell: 'the web app shell in apps/web/src/app/',
  view: 'a feature view, which renders feature data and forwards events',
  query: "a feature's queries/ file, which owns a read and its cache",
  command: "a feature's commands/ file, which owns a write and its cache",
  store:
    "a feature's store.ts, the owner of shared client state and Web Storage",
  live: "a feature's live.ts, which applies server notices to its queries",
  overlays: "a feature's overlays.ts, the owner of its Base UI handles",
  'web-rule': "a pure function in a feature's rules/",
  adapter:
    "a feature's adapters/ file, which wraps an imperative library such as Pierre or the editor",
  api: "a feature's api.ts, the only code that talks to the server",
  'feature-index':
    "a feature's index.ts, its public face to routes, the shell and other features",
  'web-shared': 'apps/web/src/shared/, which serves every owner',
  ui: 'a shadcn registry component in components/ui/',
  'browser-spec':
    'a browser journey in apps/web/spec/browser/ or negative/, which drives the real app',
  'browser-kit': 'the journey kit in apps/web/spec/kit/',
  'web-rule-spec': 'a spec for a pure web rule',
  'web-config': 'apps/web/vite.config.ts',
  'web-limits': "apps/web/src/config/limits.ts, the web's limits",
  'web-entry': 'main.tsx and the generated route tree, where the web starts',
};

const archRuleReasons = {
  'mobile-imports-mobile-client-and-contracts-only':
    'Mobile owns native presentation and platform capabilities; shared behavior comes from the client and its contracts, never another app or a server implementation.',
  'mobile-routes-import-feature-index':
    'Expo Router routes compose the shell and public feature entries; importing a private view bypasses the feature boundary.',
  'mobile-features-import-feature-index':
    'Mobile features reach other features through their public entries so native views do not couple to another feature implementation.',
  'mobile-shared-imports-no-owner':
    'Shared native capabilities serve features and the shell and never import their owners.',
  'mobile-nothing-imports-routes':
    'Expo Router discovers routes; features and shared capabilities never import routes or acquire navigation ownership.',
  'client-imports-client-and-contracts-only':
    'Keep shared client code independent of apps and server implementations; platform capabilities belong behind client ports implemented by each app.',
  'client-public-api-only':
    'Import shared client code through its planned package exports; a relative import into a feature bypasses its public boundary.',
  '<role>-cannot-import-<role>':
    'Reach that code through a role on this list, or move it to the role that owns it; allowedTargets in architecture/policy.ts keeps dependencies pointing one way, so no role breaks when one above it changes.',
  '<role>-cannot-import-external':
    'Reach anything else through the role that wraps it, a port with a gateway, repository or adapter on the server or the feature api.ts in the web; libraries and the operating system then stay in the few files that wrap them.',
  'code-outside-roots':
    'Put the file where its line below says; code lives in src/ and spec/ only, because every gate reads those roots and a file elsewhere escapes typecheck, lint and this check.',
  'unclassified-package-export':
    'Remove the entry, or ask the owner to plan it in targetPackageExports in architecture/policy.ts; a package exposes only its planned entries, so its inside stays private.',
  'missing-target-package':
    'Restore the package, or ask the owner to drop it from targetPackageExports in architecture/policy.ts; the architecture plans every package and checks that it exists.',
  'missing-target-export':
    'Export each entry targetPackageExports plans for the package, pointing at a file that exists; other packages import a package through these entries only.',
  'missing-server-structure':
    'Restore the file requiredServerFiles in architecture/policy.ts names; the composition root, scopes, status policy, lanes and ports are the fixed shape every server feature builds on.',
  'no-helpers-folder':
    'Name the module after what it does and put it with its owner; a helpers folder collects code that has no owner.',
  'flat-http-route':
    'Put each endpoint in http/routes/<feature>/<operation>.ts; one file per endpoint, grouped by feature, keeps an endpoint findable from its path.',
  'use-case-file-name':
    'Name a use case use-cases/<domain>/<verb-noun>.ts after a domain package; the path says which operation the file runs and which domain owns it.',
  'service-file-name':
    'Name a domain service file *-service.ts; the result and lane checks find services by that name.',
  'role-folder-is-flat':
    'Keep the file directly in its role folder with a more precise name; a nested file gets no role, so no import rule can check it.',
  'unclassified-source':
    'Move the file to a folder architecture/policy.ts classifies; a file without a role escapes every import rule.',
  'cross-package-import-must-use-package-name':
    "Import another package by its @porcelain/<name> entry, never a relative path; a relative path skips the package's exports and reaches its inside.",
  'unclassified-import-target':
    'Import a file that has a role, or move the target to a classified folder; an import of an unclassified file cannot be checked.',
  'import-outside-source-roots':
    'Import only from src/ and spec/ roots or a dependency; product code never leans on tooling, scripts or other files the gates do not check as product code.',
  'runtime-node-allow-list':
    'Add a capability as a port with an adapter instead of reaching Node from the runtime; only the runtime files runtimeNodeModules in architecture/policy.ts names use Node, each for the modules listed, so the runtime stays small.',
  'no-circular-source-imports':
    'Break the cycle by moving the shared piece to a module both sides import; a cycle ties the modules into one and makes load order matter.',
  'git-capability-dependency-order':
    'A git capability imports only the ones before it, discovery, inspection, history, actions, with shared below all; move the code down to the capability both need, so the capabilities never form a cycle.',
  'git-capability-public-api-only':
    "Import another git capability through its index.ts; a capability's inside stays free to change.",
  'infrastructure-layout':
    'Keep git, agents and process code in the one capability layout; the same shape in every infrastructure package tells where commands, parsers and DTOs live.',
  'test-imports-own-package-support-only':
    "Use fakes and fixtures from the spec's own package or the kernel, and add the fake this package needs; another package's support ties two packages' specs together.",
  'store-contract-runs-against-its-fake-storage-and-server-adapters-only':
    "Run a package's store contract only from its own specs, storage specs or server specs; it proves each implementation of the store against one spec and is no general helper.",
  'package-cannot-import-server':
    'Move what a package needs from the server into a package; packages sit below the server, and only the desktop reaches it, through bootstrap/desktop.ts and config/desktop-settings.ts.',
  'fake-imports-own-package-only':
    "Build a fake on its own package and the kernel only, never on another owner's fake; each package's specs then stand alone.",
  'fixture-imports-own-package-models-only':
    'Build fixture data from its own package and the kernel models only; a fixture that pulls another package breaks when that package changes.',
  'git-cannot-import-domain':
    'Take shapes from the kernel; packages/git is infrastructure the domains reach through their ports, so a domain change never breaks git.',
  'domain-cannot-import-another-domain':
    'Move the shared piece into the kernel, or combine the domains in a server use case; each domain then changes alone.',
  'domain-cannot-import-transport-contract':
    'Use domain models and let the server map them to the contract; the contract is the HTTP shape, so the domain and the wire change apart.',
  'contract-imports-kernel-rules-only':
    'Import rules into a contract from the kernel only; server and clients share the contract, so it never pulls a domain into a client.',
  'git-public-api-only':
    'Import git through a capability entry, @porcelain/git/<capability>; its inside stays free to change.',
  'domain-public-api-only':
    "Import a domain through its services, rules, models, ports or errors entry; the files behind them stay the domain's own.",
  'kernel-public-api-only':
    'Import kernel rules and errors through @porcelain/kernel/rules and @porcelain/kernel/errors; the files behind them stay free to change.',
  'storage-public-api-only':
    'Import storage through @porcelain/storage or its repositories/<domain> entry; tables and queries stay private to storage.',
  'agents-public-api-only':
    'Import agents through @porcelain/agents/commit-planning; its inside stays free to change.',
  'process-public-api-only':
    'Import process through @porcelain/process; its inside stays free to change.',
  'process-importable-by-git-agents-installer':
    'Reach git or a coding agent through its port instead of running a process; only packages/git, packages/agents, the installer and the gateways serverProcessImporters names spawn processes, so every spawn lives in a few audited places.',
  'no-undefined-union-result':
    'Return a named outcome or throw a named error from execute, never undefined or null; the caller then handles every case by name.',
  'models-file-shape':
    'Name a Result outcome without undefined, void or null, and import a kernel type from @porcelain/kernel instead of declaring it again; one shape has one definition.',
  'recording-fake-for-write-only-port':
    'Give a port with a read-back an InMemory fake that specs read through the port; a Recording fake fits only ports whose methods answer nothing, so specs assert behaviour, not calls.',
  'lane-per-table':
    'Run the store call inside the lane that owns its table, as tableLanes in architecture/type-rules.ts names; a lane serializes the writes to its tables, so a call outside it races them.',
  'lane-mode-matches-service':
    "Call a service that writes inside a 'write' lane, lanes.background or lanes.finish; reads share a lane, so a write in a read lane races them.",
  'worktree-use-case-checks':
    'Resolve a worktreeId with checkWorktree (or hand it to a use case that does) before acting on it; the check refreshes a stale catalog, refuses an unknown or unavailable worktree and yields the worktree its lane is keyed on.',
  'unused-export':
    'Delete the export or stop exporting it; an export nothing imports is surface every later change must keep working.',
  'unused-dependency':
    'Remove the dependency from apps/web/package.json; a dependency nothing imports costs install time and invites a second way to do one thing.',
  'web-shadcn-ui-owner':
    'Add a missing primitive through the shadcn CLI and compose product views in features/<domain>/views/; components/ui stays exactly what the registry serves.',
  'web-shadcn-primitive-owner':
    'Use the shadcn primitive from components/ui and its variants; a local copy under its name drifts from the registry.',
  'web-no-runtime-fixture':
    'Drive the web against the real isolated server; a mock in runtime code proves the mock, not the product.',
  'web-routes-import-feature-index':
    "Reach a feature from a route through features/<domain>/index.ts only, so the feature's inside can move without touching routes.",
  'web-features-import-feature-index':
    "Reach another feature through its index.ts only, so each feature's inside stays its own.",
  'web-shared-imports-no-owner':
    'Keep shared/ and components/ui free of features, the app shell and routes; they serve every owner and import none of them.',
  'web-nothing-imports-routes':
    'Import what a route uses from its feature instead; routes are the leaves TanStack Router loads from the generated route tree, and nothing else imports them.',
  'web-baseline':
    'Fix the new finding instead of raising architecture/web-baseline.json, and write a lower count down when one is fixed; the baseline only shrinks, so old debt never grows back.',
} satisfies Record<
  (typeof archRules)[number] | (typeof archRuleFamilies)[number],
  string
>;

const unlistedPackage = 'a-package-policy-does-not-list';
const nodeNames = [...nodeModules]
  .filter((name) => !name.includes('/') && !name.startsWith('_'))
  .toSorted();

function series(noun: string, names: readonly string[]): string {
  return `${noun}${names.length === 1 ? '' : 's'} ${names.join(', ')}`;
}

function listedRoles(names: readonly Role[]): string {
  return names.length === 0 ? 'no other role' : `only ${names.join(', ')}`;
}

function externalAllowance(role: Role): string {
  const packages = externalPackages[role];
  const npm = !forbiddenExternal(role, unlistedPackage)
    ? 'any npm package'
    : packages.length === 0
      ? 'no npm package'
      : `only the npm ${series('package', packages)}`;
  const allowed = nodeNames.filter((name) => !forbiddenExternal(role, name));
  const refused = nodeNames.filter((name) => forbiddenExternal(role, name));
  const node =
    refused.length === 0
      ? 'every Node built-in'
      : allowed.length === 0
        ? 'no Node built-in'
        : allowed.length < refused.length
          ? `only the Node ${series('built-in', allowed)}`
          : `every Node built-in except ${refused.join(', ')}`;
  return `${npm} and ${node}`;
}

export function archRuleReason(rule: ArchRule): string {
  const named = archRules.find((name) => name === rule);
  if (named !== undefined) return archRuleReasons[named];
  const [, fromName, toName] = /^(.+)-cannot-import-(.+)$/.exec(rule) ?? [];
  const from = roles.find((role) => role === fromName);
  if (from === undefined) throw new Error(`${rule} names no role`);
  const to = roles.find((role) => role === toName);
  if (to === undefined)
    return `${from} is ${rolePurposes[from]}; it imports ${externalAllowance(from)}. ${archRuleReasons['<role>-cannot-import-external']}`;
  return `${from} is ${rolePurposes[from]}, and ${to} is ${rolePurposes[to]}. ${from} imports ${listedRoles([...allowedTargets[from]])}. ${archRuleReasons['<role>-cannot-import-<role>']}`;
}
