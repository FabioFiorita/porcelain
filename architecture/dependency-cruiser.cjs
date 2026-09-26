module.exports = {
  forbidden: [
    {
      name: 'no-circular-source-imports',
      severity: 'error',
      from: { path: '^(apps/server/src/|packages/)' },
      to: { circular: true },
    },
    {
      name: 'web-routes-import-feature-index',
      severity: 'error',
      from: { path: '^apps/web/src/routes/' },
      to: {
        path: '^apps/web/src/features/',
        pathNot: '^apps/web/src/features/[^/]+/index\\.ts$',
      },
    },
    {
      name: 'web-features-import-feature-index',
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
      severity: 'error',
      from: { path: '^apps/web/src/(?:shared|components/ui)/' },
      to: { path: '^apps/web/src/(?:features|app|routes)/' },
    },
    {
      name: 'web-nothing-imports-routes',
      severity: 'error',
      from: { pathNot: '^apps/web/src/(?:routes/|routeTree\\.gen\\.ts$)' },
      to: { path: '^apps/web/src/routes/' },
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
