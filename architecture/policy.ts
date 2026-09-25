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
]);

export const webDomains = [
  'access',
  'projects',
  'changes',
  'files',
  'git-actions',
  'history',
  'reviews',
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
  'rule-list',
  'probe-shape',
  'tsconfig',
  'package-scripts',
  'vitest-config',
  'cruiser-config',
  'ci-steps',
  'pre-push-hook',
  'code-outside-lint-roots',
  'format-config',
  'vite-config',
  'react-compiler',
  'web-baseline',
  'web-journey-baseline',
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

export function webPart(path: string): Role | undefined {
  if (path === 'apps/web/vite.config.ts') return 'web-config';
  if (/^apps\/web\/spec\/(?:browser|negative)\//.test(path))
    return 'browser-spec';
  if (path.startsWith('apps/web/spec/kit/')) return 'browser-kit';
  if (!path.startsWith('apps/web/src/') || !webCode.test(path)) return;
  const inside = path.slice('apps/web/src/'.length);
  const parts = inside.split('/');
  const top = parts[0] ?? '';
  if (inside === 'main.tsx' || inside === 'routeTree.gen.ts')
    return 'web-entry';
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
  if (/^apps\/server\/spec\/fakes\/.+\.ts$/.test(path))
    return classified('fake', 'server');
  const packageFile = /^packages\/([^/]+)\/src\/(.+)$/.exec(path);
  if (packageFile)
    return classifyPackage(packageFile[1] ?? '', packageFile[2] ?? '');
  if (path.startsWith('apps/server/src/'))
    return classifyServer(path.slice('apps/server/src/'.length));
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
  route: new Set(['feature-index', 'shell', 'web-shared', 'web-limits']),
  shell: new Set(['feature-index', 'shell', 'ui', 'web-shared', 'web-limits']),
  view: new Set([
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
    'query',
    'api',
    'store',
    'web-rule',
    'web-shared',
    'web-limits',
    'contract',
  ]),
  command: new Set([
    'command',
    'query',
    'api',
    'store',
    'web-rule',
    'web-shared',
    'web-limits',
    'contract',
  ]),
  store: new Set(['web-rule', 'web-shared', 'web-limits', 'contract']),
  live: new Set(['query', 'web-rule', 'web-shared', 'contract']),
  overlays: new Set(['contract']),
  'web-rule': new Set(['web-rule', 'web-limits', 'contract']),
  adapter: new Set([
    'adapter',
    'store',
    'web-rule',
    'web-shared',
    'web-limits',
    'contract',
  ]),
  api: new Set(['web-rule', 'web-shared', 'web-limits', 'contract']),
  'feature-index': new Set([
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
