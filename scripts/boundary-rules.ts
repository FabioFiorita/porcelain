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
  },
};
