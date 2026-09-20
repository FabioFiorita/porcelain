import type { IConfiguration, IForbiddenRuleType } from 'dependency-cruiser';

const owners = {
  'apps/server': ['packages/contracts', 'packages/git'],
  'apps/web': ['packages/contracts', 'packages/client'],
  'packages/contracts': [],
  'packages/git': [],
  'packages/client': ['packages/contracts'],
} as const;

/**
 * Development tooling that happens to live beside an app: the dev-server
 * bridge and the browser smoke suite. Neither ships, and both drive a real
 * server, so they reach for it the way `scripts/` does. What must not happen
 * is the shipped web app importing the server, which `web-app-is-a-client`
 * states directly.
 */
const webTooling = '^apps/web/(development|e2e)/';

const ownershipRules: IForbiddenRuleType[] = Object.entries(owners).map(
  ([owner, dependencies]) => ({
    name: `${owner.replace('/', '-')}-dependencies`,
    severity: 'error',
    comment: 'Import only the owning module or an approved shared package.',
    from:
      owner === 'apps/web'
        ? { path: `^${owner}/`, pathNot: webTooling }
        : { path: `^${owner}/` },
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
      name: 'web-tooling-dependencies',
      severity: 'error',
      comment:
        'Web development tooling may also drive the server; everything else is still off limits.',
      from: { path: webTooling },
      to: {
        path: '^(apps|packages|scripts)/',
        pathNot: `^(apps/web|apps/server|${owners['apps/web'].join('|')})/`,
      },
    },
    {
      name: 'web-app-is-a-client',
      severity: 'error',
      comment:
        'The web application talks to the server over HTTP and shared contracts, never by importing it.',
      from: { path: '^apps/web/src/' },
      to: { path: '^apps/server/' },
    },
    {
      name: 'web-views-use-query-hooks',
      severity: 'error',
      comment:
        'Views use domain types and query hooks, not ports, wire contracts or cache infrastructure.',
      from: { path: '^apps/web/src/views/', pathNot: '\\.spec\\.tsx?$' },
      to: {
        path: '(^apps/web/src/api/|^apps/web/src/query/(workspace-provider|operation-store|keys)\\.|^packages/(client|contracts)/|(^|/)@tanstack/react-query(/|$))',
      },
    },
    {
      name: 'web-domain-is-independent',
      severity: 'error',
      from: { path: '^apps/web/src/domain/', pathNot: '\\.spec\\.tsx?$' },
      to: {
        path: '(^apps/web/src/(api|query|routes|views|development|components)/|^packages/client/|(^|/)(react|react-dom|@tanstack)(/|$))',
      },
    },
    {
      name: 'web-api-is-independent-of-react',
      severity: 'error',
      from: { path: '^apps/web/src/api/', pathNot: '\\.spec\\.tsx?$' },
      to: {
        path: '(^apps/web/src/(query|routes|views|development|components)/|(^|/)(react|react-dom|@tanstack)(/|$))',
      },
    },
    {
      name: 'web-query-does-not-import-presentation',
      severity: 'error',
      from: { path: '^apps/web/src/query/', pathNot: '\\.spec\\.tsx?$' },
      to: { path: '^apps/web/src/(routes|views|development|components)/' },
    },
    {
      name: 'use-cases-depend-on-ports',
      severity: 'error',
      comment:
        'Product operations depend on internal models and adapter interfaces, not infrastructure.',
      from: { path: '^apps/server/src/use-cases/', pathNot: '\\.spec\\.ts$' },
      to: {
        path: '(^packages/(contracts|git)/|^apps/server/src/|(^|/)(fastify|drizzle-orm|better-sqlite3)(/|$)|^(node:)?(fs|child_process|net|http|https)(/|$))',
        pathNot:
          '(^packages/git/src/(interfaces|dtos|errors)/|^apps/server/src/(use-cases/|models/|(git|filesystem)/(interfaces|dtos|errors)/|agents/interfaces/|repositories/interfaces/))',
      },
    },
    {
      name: 'server-models-are-independent',
      severity: 'error',
      from: { path: '^apps/server/src/models/', pathNot: '\\.spec\\.ts$' },
      to: {
        path: '^(apps/server/src|packages/git/src)/',
        pathNot: '^(apps/server/src/models|packages/git/src/dtos)/',
      },
    },
    {
      name: 'adapter-interfaces-stay-independent',
      severity: 'error',
      from: {
        path: '(^apps/server/src/((git|filesystem)/(interfaces|dtos|errors)|repositories/interfaces)/|^packages/git/src/(interfaces|dtos|errors)/)',
      },
      to: {
        path: '^(apps/server/src|packages/git/src)/',
        pathNot:
          '(^packages/git/src/(interfaces|dtos|errors)/|^apps/server/src/(models/|(git|filesystem)/(interfaces|dtos|errors)/|agents/interfaces/|repositories/interfaces/))',
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
      from: { path: '^packages/(contracts|client)/' },
      to: {
        path: '(^node:|(^|/)(electron|react-dom|react-native|expo)(/|$))',
      },
    },
    {
      name: 'no-node-in-portable-code',
      severity: 'error',
      from: {
        path: '^(packages/(contracts|client)|apps/web/src)/',
      },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'no-platform-ui-in-contracts',
      severity: 'error',
      from: { path: '^packages/contracts/' },
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
