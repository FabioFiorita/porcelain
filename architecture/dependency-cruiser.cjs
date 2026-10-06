const { resolve } = require('node:path');
const { existsSync, readdirSync, readFileSync } = require('node:fs');
const domains = '(?:projects|changes|reviews|files|git-actions|access)';
const domainSource = `^packages/(${domains})/src/`;
const productSource = '^(?:apps/[^/]+|packages/[^/]+)/src/';
const tests = '\\.(?:spec|test)\\.tsx?$';

// Native export targets define public APIs; new exports need no policy inventory.
function publicTargets(folder) {
  if (!existsSync(folder)) return [];
  const targets = (value) =>
    typeof value === 'string'
      ? [value]
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(targets)
        : [];
  return readdirSync(folder).flatMap((name) => {
    const manifest = `${folder}/${name}/package.json`;
    if (!existsSync(manifest)) return [];
    return targets(JSON.parse(readFileSync(manifest, 'utf8')).exports).map(
      (target) =>
        '^' +
        `${folder}/${name}/${target.replace(/^\.\//, '')}`
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replaceAll('\\*', '.*') +
        '$',
    );
  });
}
const publicPackages = publicTargets('packages');
const publicApps = publicTargets('apps');

module.exports = {
  forbidden: [
    {
      name: 'no-circular-source-imports',
      comment:
        'Keep source dependencies acyclic so initialization has one order.',
      severity: 'error',
      from: { path: productSource },
      to: { circular: true },
    },
    {
      name: 'domains-independent',
      comment:
        'A domain owns its decisions; compose domains in server use cases.',
      severity: 'error',
      from: { path: domainSource, pathNot: tests },
      to: { path: `^packages/${domains}/src/`, pathNot: '^packages/$1/src/' },
    },
    {
      name: 'domains-no-wire-or-platform',
      comment:
        'Domains declare ports; server adapters own wire and platform work.',
      severity: 'error',
      from: { path: domainSource, pathNot: tests },
      to: {
        path: '^(?:apps/|packages/(?:contracts|client|storage|agents|process)/|packages/git/src/(?!shared/errors/))',
      },
    },
    {
      name: 'domains-no-node-io',
      comment:
        'Only pure hashing in domain rules uses Node; I/O belongs to adapters.',
      severity: 'error',
      from: { path: domainSource, pathNot: tests },
      to: { dependencyTypes: ['core'], pathNot: '^(?:node:)?crypto$' },
    },
    {
      name: 'crypto-rules-only',
      severity: 'error',
      from: {
        path: `^packages/(?:${domains}|kernel)/src/`,
        pathNot: [tests, '/src/rules/'],
      },
      to: { dependencyTypes: ['core'], path: '^(?:node:)?crypto$' },
    },
    {
      name: 'kernel-independent',
      severity: 'error',
      from: { path: '^packages/kernel/src/', pathNot: tests },
      to: { path: '^(?:apps/|packages/(?!kernel/))' },
    },
    {
      name: 'kernel-no-node-io',
      severity: 'error',
      from: { path: '^packages/kernel/src/', pathNot: tests },
      to: { dependencyTypes: ['core'], pathNot: '^(?:node:)?crypto$' },
    },
    {
      name: 'domains-no-platform-libraries',
      severity: 'error',
      from: { path: domainSource, pathNot: tests },
      to: {
        path: [
          '(?:^|node_modules/)@effect/platform',
          '(?:^|node_modules/)effect/(?:dist/|src/unstable/|src/)(?:http|http-api|socket|rpc|net|process|platform|FileSystem|Path)(?:/|\\.|$)',
          '^effect/(?:http|http-api|socket|rpc|net|process|platform|FileSystem|Path)(?:/|$)',
        ],
      },
    },
    {
      name: 'contracts-no-implementation',
      comment:
        'Wire schemas use canonical models and public domain errors, never implementation.',
      severity: 'error',
      from: { path: '^packages/contracts/src/', pathNot: tests },
      to: {
        path: `^(?:apps/|packages/(?:client|effects|storage|agents|process)/|packages/${domains}/src/(?!errors/)|packages/git/src/(?!shared/errors/))`,
      },
    },
    {
      name: 'contracts-no-node-io',
      severity: 'error',
      from: { path: '^packages/contracts/src/', pathNot: tests },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'client-no-app-or-platform',
      comment:
        'Shared client logic uses wire contracts and injected app adapters.',
      severity: 'error',
      from: { path: '^packages/client/src/', pathNot: tests },
      to: {
        path: `^(?:apps/|packages/(?:storage|git|agents|process)/|packages/${domains}/src/(?:services|ports)/)`,
      },
    },
    {
      name: 'client-no-platform-libraries',
      severity: 'error',
      from: { path: '^packages/client/src/', pathNot: tests },
      to: {
        path: [
          '(?:^|node_modules/)@effect/platform',
          '(?:^|node_modules/)effect/(?:dist/|src/unstable/|src/)(?:process|platform|FileSystem|Path)(?:/|\\.|$)',
          '^effect/(?:process|platform|FileSystem|Path)(?:/|$)',
        ],
      },
    },
    {
      name: 'clients-no-node-io',
      severity: 'error',
      from: {
        path: '^(?:packages/client|apps/(?:web|mobile))/src/',
        pathNot: tests,
      },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'packages-use-public-imports',
      comment:
        'Package exports are the public API; foreign implementation stays private.',
      severity: 'error',
      from: { path: '^packages/([^/]+)/' },
      to: {
        path: '^packages/',
        pathNot: ['^packages/$1/', ...publicPackages],
      },
    },
    {
      name: 'apps-use-public-package-imports',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^packages/', pathNot: publicPackages },
    },
    {
      name: 'apps-independent',
      severity: 'error',
      from: { path: '^apps/(web|mobile|desktop)/src/', pathNot: tests },
      to: {
        path: '^apps/',
        pathNot: ['^apps/$1/', ...publicApps],
      },
    },
    {
      name: 'shared-imports-no-feature-owner',
      comment:
        'Shared modules cannot depend on the features that consume them.',
      severity: 'error',
      from: {
        path: '^apps/(web|mobile)/src/(?:shared|components/ui)/',
      },
      to: {
        path: '^apps/$1/src/(?:features|app|shell|routes)/',
      },
    },
    {
      name: 'client-shared-imports-no-feature-owner',
      severity: 'error',
      from: { path: '^packages/client/src/shared/' },
      to: { path: '^packages/client/src/features/' },
    },
    {
      name: 'apps-use-public-app-imports',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: ['^apps/$1/', ...publicApps] },
    },
    ...['web', 'mobile'].flatMap((app) => [
      {
        name: `${app}-routes-import-feature-index`,
        severity: 'error',
        from: { path: `^apps/${app}/src/${app === 'web' ? 'routes' : 'app'}/` },
        to: {
          path: `^apps/${app}/src/features/`,
          pathNot: `^apps/${app}/src/features/[^/]+/index\\.ts$`,
        },
      },
      {
        name: `${app}-features-import-feature-index`,
        severity: 'error',
        from: { path: `^apps/${app}/src/features/([^/]+)/` },
        to: {
          path: `^apps/${app}/src/features/`,
          pathNot: [
            `^apps/${app}/src/features/$1/`,
            `^apps/${app}/src/features/[^/]+/index\\.ts$`,
          ],
        },
      },
    ]),
    {
      name: 'workspace-imports-resolve',
      comment:
        'Unresolved public workspace imports cannot silently escape boundaries.',
      severity: 'error',
      from: { path: productSource },
      to: { couldNotResolve: true, path: '^(?:@porcelain/|@/)' },
    },
  ],
  options: {
    tsConfig: { fileName: resolve('tsconfig.json') },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'node', 'default'],
      extensions: [
        '.ts',
        '.tsx',
        '.ios.ts',
        '.ios.tsx',
        '.android.ts',
        '.android.tsx',
        '.js',
        '.mjs',
        '.cjs',
        '.json',
      ],
    },
  },
};
