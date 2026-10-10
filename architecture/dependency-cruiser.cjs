const sourceFolders = [
  '^apps/server/src/http/.+\\.ts$',
  '^apps/server/src/use-cases/[^/]+/[^/]+\\.ts$',
  '^apps/server/src/(?:runtime|ports)/.+\\.ts$',
  '^apps/server/src/(?:bootstrap|config|cli|installer|adapters)/.+\\.ts$',
  '^packages/(?:(?:access|changes|files|git-actions|projects|reviews)|kernel)/src/(?:services|rules|models|ports|errors)/[^/]+\\.ts$',
  '^packages/contracts/src/[^/]+/[^/]+\\.ts$',
  '^packages/client/src/(?:features/[^/]+/(?:[^/]+\\.ts|(?:rules|queries|commands|ports|store)/[^/]+\\.ts)|shared/api/[^/]+\\.ts|config/[^/]+\\.ts)$',
  '^packages/(?:git/src/(?:discovery|inspection|history|actions|shared)/|agents/src/[^/]+/|(?:process|storage|effects)/src/).+\\.ts$',
  '^apps/web/src/(?:features/[^/]+/(?:[^/]+\\.tsx?|(?:queries|commands|rules|adapters|views|api)/[^/]+\\.tsx?)|(?:routes|app|shared|components/ui|config)/.+\\.tsx?|(?:main|routeTree\\.gen)\\.tsx?)$',
  '^apps/mobile/src/(?:app/.+\\.tsx|components/ui/[a-z-]+(?:\\.(?:ios|android))?\\.tsx?|features/[^/]+/(?:[^/]+\\.tsx?|(?:queries|commands|rules|adapters|views)/[^/]+\\.tsx?)|(?:shell|shared|config)/.+\\.tsx?)$',
];

module.exports = {
  forbidden: [
    {
      name: 'source-folder-isolated',
      comment:
        'Keep code in folders that identify its runtime and responsibility, including modules without imports.',
      severity: 'error',
      from: {
        path: '^(?:apps/(?:server|web|desktop|mobile)|packages/[^/]+)/src/.+\\.[cm]?[jt]sx?$',
        pathNot: [...sourceFolders, '^apps/desktop/src/.+\\.ts$'],
        orphan: true,
      },
      to: {},
    },
    {
      name: 'source-folder-connected',
      comment:
        'Keep code in folders that identify its runtime and responsibility, including modules without imports.',
      severity: 'error',
      from: {
        path: '^(?:apps/(?:server|web|desktop|mobile)|packages/[^/]+)/src/.+\\.[cm]?[jt]sx?$',
        pathNot: [...sourceFolders, '^apps/desktop/src/.+\\.ts$'],
        orphan: false,
      },
      to: {},
    },
    {
      name: 'server-http-imports-use-cases',
      comment:
        'HTTP delegates business decisions to use cases so transport cannot bypass application orchestration.',
      severity: 'error',
      from: {
        path: '^apps/server/src/http/',
        pathNot: ['\\.spec\\.ts$', '^apps/server/src/http/status-policy\\.ts$'],
      },
      to: {
        path: '^(?:apps/server/src/(?:adapters|bootstrap|runtime)/|packages/(?:(?:access|changes|files|git-actions|projects|reviews)|git|agents|storage|process)/src/)',
        pathNot: [
          '^packages/(?:access|changes|files|git-actions|projects|reviews)/src/errors/index\\.ts$',
          '^apps/server/src/runtime/(?:errors/|observability\\.ts$)',
        ],
      },
    },
    {
      name: 'server-runtime-imports-no-use-cases',
      comment:
        'Runtime provides scheduling and resources to use cases so importing application operations would reverse ownership.',
      severity: 'error',
      from: {
        path: '^apps/server/src/runtime/',
        pathNot: '\\.spec\\.ts$',
      },
      to: {
        path: '^apps/server/src/use-cases/',
      },
    },
    {
      name: 'package-cannot-import-server',
      comment:
        'Packages supply capabilities to the server so they cannot depend on its application runtime.',
      severity: 'error',
      from: {
        path: '^packages/',
      },
      to: {
        path: '^apps/server/src/',
      },
    },
    {
      name: 'process-importable-by-git-agents-installer',
      comment:
        'Only Git, Agents and the installer import process capabilities so business and transport code cannot gain shell access; the process implementation owns execution, and exactly apps/server/src/adapters/access/mac-network-command.ts runs fixed macOS network tools through the process owner.',
      severity: 'error',
      from: {
        path: '^(?:apps/[^/]+|packages/[^/]+)/src/',
        pathNot: [
          '\\.spec\\.tsx?$',
          '^packages/(?:git|agents|process)/src/',
          '^apps/server/src/installer/',
          '^apps/server/src/adapters/access/mac-network-command\\.ts$',
        ],
      },
      to: {
        path: '(?:^(?:node:)?child_process$|^packages/process/src/|(?:^|/)node_modules/(?:@porcelain/process|effect/(?:dist|src)/process)(?:/|$)|^@porcelain/process(?:/|$)|^effect/process(?:/|$))',
      },
    },
    {
      name: 'git-shared-dependency-order',
      comment:
        'Git capabilities build from discovery through inspection and history to actions so lower capabilities cannot depend on higher ones.',
      severity: 'error',
      from: {
        path: '^packages/git/src/shared/',
      },
      to: {
        path: '^packages/git/src/(?:discovery|inspection|history|actions)/',
      },
    },
    {
      name: 'git-discovery-dependency-order',
      comment:
        'Git capabilities build from discovery through inspection and history to actions so lower capabilities cannot depend on higher ones.',
      severity: 'error',
      from: {
        path: '^packages/git/src/discovery/',
      },
      to: {
        path: '^packages/git/src/(?:inspection|history|actions)/',
      },
    },
    {
      name: 'git-inspection-dependency-order',
      comment:
        'Git capabilities build from discovery through inspection and history to actions so lower capabilities cannot depend on higher ones.',
      severity: 'error',
      from: {
        path: '^packages/git/src/inspection/',
      },
      to: {
        path: '^packages/git/src/(?:history|actions)/',
      },
    },
    {
      name: 'git-history-dependency-order',
      comment:
        'Git capabilities build from discovery through inspection and history to actions so lower capabilities cannot depend on higher ones.',
      severity: 'error',
      from: {
        path: '^packages/git/src/history/',
      },
      to: {
        path: '^packages/git/src/(?:actions)/',
      },
    },
    {
      name: 'git-capability-public-api-only',
      comment:
        'A capability imports another through its index so its internal commands and parsers remain private.',
      severity: 'error',
      from: {
        path: '^packages/git/src/([^/]+)/',
      },
      to: {
        path: '^packages/git/src/(?:discovery|inspection|history|actions)/',
        pathNot: [
          '^packages/git/src/$1/',
          '^packages/git/src/[^/]+/index\\.ts$',
        ],
      },
    },
    {
      name: 'portable-imports-no-node',
      comment:
        'Domain decisions and shared clients run independently of Node; only node:crypto in domain/kernel rules retains the existing hashing exception.',
      severity: 'error',
      from: {
        path: '^packages/(?:(?:access|changes|files|git-actions|projects|reviews)|kernel|contracts|client)/src/',
        pathNot: '\\.spec\\.tsx?$',
      },
      to: {
        dependencyTypes: ['core'],
        pathNot: '^(?:node:)?crypto$',
      },
    },
    {
      name: 'portable-crypto-only-in-rules',
      comment:
        'Only pure hashing rules use the existing Node crypto exception so other portable folders cannot acquire Node capabilities.',
      severity: 'error',
      from: {
        path: '^packages/(?:(?:access|changes|files|git-actions|projects|reviews)|kernel|contracts|client)/src/',
        pathNot: [
          '\\.spec\\.tsx?$',
          '^packages/(?:(?:access|changes|files|git-actions|projects|reviews)|kernel)/src/rules/',
        ],
      },
      to: {
        path: '^(?:node:)?crypto$',
      },
    },
    {
      name: 'portable-imports-no-platform',
      comment:
        'Portable packages receive platform implementations through ports so Node, Electron and native mobile capabilities stay in their owners.',
      severity: 'error',
      from: {
        path: '^packages/(?:(?:access|changes|files|git-actions|projects|reviews)|kernel|contracts|client)/src/',
        pathNot: '\\.spec\\.tsx?$',
      },
      to: {
        path: [
          '(?:^|/)node_modules/(?:@effect/platform[^/]*|electron|react-native[^/]*|expo[^/]*)(?:/|$)',
          '^(?:@effect/platform[^/]*|electron|react-native[^/]*|expo[^/]*)(?:/|$)',
          '(?:^|/)effect/(?:dist/|src/)?(?:FileSystem|Path|Stdio|Terminal|process)(?:[./]|$)',
        ],
      },
    },
    {
      name: 'domain-imports-own-domain-and-kernel',
      comment:
        'Domains own their decisions and depend on kernel types so cross-domain decisions belong in server use cases.',
      severity: 'error',
      from: {
        path: '^packages/((?:access|changes|files|git-actions|projects|reviews))/src/',
        pathNot: '\\.spec\\.ts$',
      },
      to: {
        path: '^(?:apps/|packages/)',
        pathNot: [
          '^packages/$1/src/',
          '^packages/(?:kernel|effects)/src/',
          '^packages/git/src/shared/errors/index\\.ts$',
        ],
      },
    },
    {
      name: 'client-imports-client-and-contracts-only',
      comment:
        'Shared clients use wire contracts and shared effects so server and platform implementations remain outside client state.',
      severity: 'error',
      from: {
        path: '^packages/client/src/',
        pathNot: '\\.spec\\.ts$',
      },
      to: {
        path: '^(?:apps/|packages/)',
        pathNot: [
          '^packages/(?:client|contracts|effects)/src/',
          '^packages/[^/]+/src/errors/index\\.ts$',
        ],
      },
    },
    {
      name: 'mobile-imports-mobile-client-and-contracts-only',
      comment:
        'Mobile composes native views with the shared client and contracts so it cannot borrow another app runtime.',
      severity: 'error',
      from: {
        path: '^apps/mobile/src/',
        pathNot: '\\.spec\\.tsx?$',
      },
      to: {
        path: '^(?:apps/|packages/)',
        pathNot: ['^apps/mobile/src/', '^packages/(?:client|contracts)/src/'],
      },
    },
    {
      name: 'runtime-imports-no-specs',
      comment:
        'Product code cannot import sibling specs so test-only Node and process allowances cannot leak into runtime.',
      severity: 'error',
      from: {
        path: '^(?:apps/[^/]+|packages/[^/]+)/src/',
        pathNot: '\\.spec\\.tsx?$',
      },
      to: {
        path: '^(?:apps/[^/]+|packages/[^/]+)/src/.+\\.(?:spec|test)\\.[jt]sx?$',
      },
    },
    {
      name: 'runtime-imports-source-only',
      comment:
        'Runtime imports stay in source roots so shipped code cannot depend on repository tooling, vendored references or test support.',
      severity: 'error',
      from: {
        path: '^(?:apps/[^/]+|packages/[^/]+)/src/',
        pathNot: '\\.spec\\.tsx?$',
      },
      to: {
        path: '^(?:apps|packages|architecture|scripts|repos|\\.agents)/',
        pathNot: '^(?:apps/[^/]+|packages/[^/]+)/src/',
      },
    },
    {
      name: 'unresolved-workspace-import',
      comment:
        'Workspace and web alias imports must resolve so misspelled public APIs cannot escape graph checks.',
      severity: 'error',
      from: {},
      to: {
        path: '^(?:@porcelain/|@/)',
        pathNot: '^@porcelain/theme(?:/|$)',
        couldNotResolve: true,
      },
    },
    {
      name: 'web-no-runtime-fixture',
      comment:
        'Runtime web code uses the real server so test doubles belong outside src.',
      severity: 'error',
      from: {
        path: '^apps/web/src/.*(?:[/.])(?:mocks?|fixtures?|fakes?)(?:[./-]|$)',
        orphan: true,
      },
      to: {},
    },
    {
      name: 'web-no-runtime-fixture-connected',
      comment:
        'Runtime web code uses the real server so test doubles belong outside src.',
      severity: 'error',
      from: {
        path: '^apps/web/src/.*(?:[/.])(?:mocks?|fixtures?|fakes?)(?:[./-]|$)',
        orphan: false,
      },
      to: {},
    },
    {
      name: 'no-circular-source-imports',
      comment:
        'Dependencies form an acyclic graph so each owner can be initialized and changed independently.',
      severity: 'error',
      from: {
        path: '^(apps/server/src/|apps/web/src/|apps/desktop/src/|apps/mobile/src/|packages/)',
      },
      to: { circular: true },
    },
    {
      name: 'web-routes-import-feature-index',
      comment:
        'Routes use feature entry points so navigation cannot couple to private views.',
      severity: 'error',
      from: { path: '^apps/web/src/routes/' },
      to: {
        path: '^apps/web/src/features/',
        pathNot: '^apps/web/src/features/[^/]+/index\\.ts$',
      },
    },
    {
      name: 'web-features-import-feature-index',
      comment:
        'Features use another feature through its entry point so its internals can change independently.',
      severity: 'error',
      from: { path: '^apps/web/src/features/([^/]+)/' },
      to: {
        path: '^apps/web/src/features/',
        pathNot: [
          '^apps/web/src/features/$1/',
          '^apps/web/src/features/[^/]+/index\\.ts$',
        ],
      },
    },
    {
      name: 'web-shared-imports-no-owner',
      comment:
        'Shared web pieces serve all features so they cannot depend on a feature or app owner.',
      severity: 'error',
      from: { path: '^apps/web/src/(?:shared|components/ui)/' },
      to: { path: '^apps/web/src/(?:features|app|routes)/' },
    },
    {
      name: 'web-nothing-imports-routes',
      comment:
        'Routes own navigation composition so reusable code cannot depend on router entry points.',
      severity: 'error',
      from: { pathNot: '^apps/web/src/(?:routes/|routeTree\\.gen\\.ts$)' },
      to: { path: '^apps/web/src/routes/' },
    },
    {
      name: 'mobile-routes-import-feature-index',
      comment:
        'Native routes use feature entry points so navigation cannot couple to private views.',
      severity: 'error',
      from: { path: '^apps/mobile/src/app/' },
      to: {
        path: '^apps/mobile/src/features/',
        pathNot: '^apps/mobile/src/features/[^/]+/index\\.ts$',
      },
    },
    {
      name: 'mobile-features-import-feature-index',
      comment:
        'Native features use another feature through its entry point so internals stay private.',
      severity: 'error',
      from: { path: '^apps/mobile/src/features/([^/]+)/' },
      to: {
        path: '^apps/mobile/src/features/',
        pathNot: [
          '^apps/mobile/src/features/$1/',
          '^apps/mobile/src/features/[^/]+/index\\.ts$',
        ],
      },
    },
    {
      name: 'mobile-shared-imports-no-owner',
      comment:
        'Shared native pieces serve all features so they cannot depend on a feature or shell owner.',
      severity: 'error',
      from: { path: '^apps/mobile/src/(?:shared|components/ui)/' },
      to: { path: '^apps/mobile/src/(?:features|shell|app)/' },
    },
    {
      name: 'mobile-ui-imports-no-state',
      comment:
        'Native primitives may import client and contract types and pure client rules, because views supply shaped data while effects, atoms and state stay with feature owners.',
      severity: 'error',
      from: { path: '^apps/mobile/src/components/ui/' },
      to: {
        path: '^(?:apps/mobile/src/shared/(?:api|adapters|application)/|packages/(?:client|contracts)/src/)',
        pathNot: '^packages/client/src/features/[^/]+/rules/',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'mobile-nothing-imports-routes',
      comment:
        'Native routes own navigation composition so reusable code cannot depend on route entry points.',
      severity: 'error',
      from: { pathNot: '^apps/mobile/src/app/' },
      to: { path: '^apps/mobile/src/app/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'node', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
    },
  },
};
