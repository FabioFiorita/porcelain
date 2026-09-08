import type { IConfiguration, IForbiddenRuleType } from 'dependency-cruiser';

const owners = {
  'apps/server': ['packages/contracts'],
  'apps/desktop': ['packages/contracts'],
  'apps/web': [
    'packages/contracts',
    'packages/client',
    'packages/design-tokens',
  ],
  'apps/mobile': [
    'packages/contracts',
    'packages/client',
    'packages/design-tokens',
  ],
  'packages/contracts': [],
  'packages/client': ['packages/contracts'],
  'packages/design-tokens': [],
} as const;

const ownershipRules: IForbiddenRuleType[] = Object.entries(owners).map(
  ([owner, dependencies]) => ({
    name: `${owner.replace('/', '-')}-dependencies`,
    severity: 'error',
    comment: 'Import only the owning module or an approved shared package.',
    from: { path: `^${owner}/` },
    to: {
      path: '^(apps|packages|scripts)/',
      pathNot: `^(${[owner, ...dependencies].join('|')})/`,
    },
  }),
);

export const boundaryRules: IConfiguration = {
  forbidden: [
    ...ownershipRules,
    {
      name: 'use-cases-depend-on-ports',
      severity: 'error',
      comment:
        'Product operations depend on internal models and adapter interfaces, not infrastructure.',
      from: { path: '^apps/server/src/use-cases/', pathNot: '\\.spec\\.ts$' },
      to: {
        path: '(^packages/contracts/|^apps/server/src/|(^|/)(fastify|drizzle-orm|better-sqlite3)(/|$)|^(node:)?(fs|child_process|net|http|https)(/|$))',
        pathNot:
          '^apps/server/src/(use-cases/|models/|(git|filesystem)/(interfaces|dtos|errors)/|repositories/interfaces/)',
      },
    },
    {
      name: 'server-models-are-independent',
      severity: 'error',
      from: { path: '^apps/server/src/models/', pathNot: '\\.spec\\.ts$' },
      to: { path: '^apps/server/src/', pathNot: '^apps/server/src/models/' },
    },
    {
      name: 'adapter-interfaces-stay-independent',
      severity: 'error',
      from: {
        path: '^apps/server/src/((git|filesystem)/(interfaces|dtos|errors)|repositories/interfaces)/',
      },
      to: {
        path: '^apps/server/src/',
        pathNot:
          '^apps/server/src/(models/|(git|filesystem)/(interfaces|dtos|errors)/|repositories/interfaces/)',
      },
    },
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'no-unresolved-imports',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'portable-packages',
      severity: 'error',
      from: { path: '^packages/(contracts|client|design-tokens)/' },
      to: {
        path: '(^node:|(^|/)(electron|react-dom|react-native|expo)(/|$))',
      },
    },
    {
      name: 'no-node-in-portable-code',
      severity: 'error',
      from: {
        path: '^(packages/(contracts|client|design-tokens)|apps/(web|mobile)/src)/',
      },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'no-platform-ui-in-contracts',
      severity: 'error',
      from: { path: '^packages/(contracts|design-tokens)/' },
      to: { path: '(^|/)(react|zustand|@tanstack)(/|$)' },
    },
    {
      name: 'use-package-exports',
      severity: 'error',
      from: { path: '^(apps|packages)/([^/]+)/' },
      to: {
        path: '^packages/[^/]+/src/',
        dependencyTypes: ['local'],
        pathNot: '^$1/$2/',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['types', 'import', 'require', 'node', 'default'],
    },
  },
};
