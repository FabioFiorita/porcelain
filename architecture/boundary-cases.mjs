const unit = 'export const value = 1;';
const edge = (from, to, specifier) => ({
  [from]: `import { value } from '${specifier}'; export const result = value;`,
  [to]: unit,
});
const pair = (rule, valid, invalid) => ({ rule, valid, invalid });
const git = (from, to, internal = false) =>
  edge(
    `packages/git/src/${from}/commands/read.ts`,
    `packages/git/src/${to}/${internal ? 'commands/read' : 'index'}.ts`,
    `../../${to}/${internal ? 'commands/read' : 'index'}.ts`,
  );
const feature = (app, source, target) =>
  edge(
    `apps/${app}/src/${source}`,
    `apps/${app}/src/${target}`,
    `${source.startsWith('routes/') || source.startsWith('app/') ? '../' : '../../../'}${target}`,
  );
const portable = (owner, module) => ({
  [`packages/${owner}/src/${owner === 'client' ? 'shared/api/read' : owner === 'contracts' ? 'shared/read' : 'rules/read'}.ts`]: `import * as dependency from '${module}'; export const value = dependency;`,
});

export default [
  pair(
    'mobile-shared-imports-no-owner',
    edge(
      'apps/mobile/src/components/ui/item.tsx',
      'apps/mobile/src/components/ui/text.tsx',
      './text.tsx',
    ),
    edge(
      'apps/mobile/src/components/ui/item.tsx',
      'apps/mobile/src/features/files/index.ts',
      '../../features/files/index.ts',
    ),
  ),
  pair(
    'mobile-ui-imports-no-state',
    edge(
      'apps/mobile/src/components/ui/item.tsx',
      'apps/mobile/src/components/ui/text.tsx',
      './text.tsx',
    ),
    edge(
      'apps/mobile/src/components/ui/item.tsx',
      'apps/mobile/src/shared/application/store.ts',
      '../../shared/application/store.ts',
    ),
  ),
  pair(
    'mobile-ui-imports-no-state',
    edge(
      'apps/mobile/src/components/ui/item.tsx',
      'apps/mobile/src/components/ui/text.tsx',
      './text.tsx',
    ),
    edge(
      'apps/mobile/src/components/ui/item.tsx',
      'packages/client/src/features/files/store.ts',
      '../../../../../packages/client/src/features/files/store.ts',
    ),
  ),
  pair(
    'no-circular-source-imports',
    {
      'packages/effects/src/a.ts':
        "import { value } from './b.ts'; export const result = value;",
      'packages/effects/src/b.ts': unit,
    },
    {
      'packages/effects/src/a.ts':
        "import { value } from './b.ts'; export const value = value;",
      'packages/effects/src/b.ts':
        "import { value } from './a.ts'; export const value = value;",
    },
  ),
  ...['web', 'mobile'].flatMap((app) => {
    const routes = app === 'web' ? 'routes' : 'app';
    return [
      pair(
        `${app}-routes-import-feature-index`,
        feature(app, `${routes}/home.tsx`, 'features/files/index.ts'),
        feature(app, `${routes}/home.tsx`, 'features/files/views/file.tsx'),
      ),
      pair(
        `${app}-features-import-feature-index`,
        feature(
          app,
          'features/access/views/access.tsx',
          'features/files/index.ts',
        ),
        feature(
          app,
          'features/access/views/access.tsx',
          'features/files/views/file.tsx',
        ),
      ),
      pair(
        `${app}-shared-imports-no-owner`,
        edge(
          `apps/${app}/src/shared/read.ts`,
          `apps/${app}/src/shared/value.ts`,
          './value.ts',
        ),
        edge(
          `apps/${app}/src/shared/read.ts`,
          `apps/${app}/src/features/files/index.ts`,
          '../features/files/index.ts',
        ),
      ),
      pair(
        `${app}-nothing-imports-routes`,
        edge(
          `apps/${app}/src/${routes}/home.tsx`,
          `apps/${app}/src/${routes}/other.tsx`,
          './other.tsx',
        ),
        edge(
          `apps/${app}/src/shared/read.ts`,
          `apps/${app}/src/${routes}/home.tsx`,
          `../${routes}/home.tsx`,
        ),
      ),
    ];
  }),
  pair(
    'server-http-imports-use-cases',
    edge(
      'apps/server/src/http/read.ts',
      'apps/server/src/use-cases/files/read.ts',
      '../use-cases/files/read.ts',
    ),
    edge(
      'apps/server/src/http/read.ts',
      'packages/files/src/services/index.ts',
      '../../../../packages/files/src/services/index.ts',
    ),
  ),
  pair(
    'server-runtime-imports-no-use-cases',
    edge(
      'apps/server/src/runtime/read.ts',
      'apps/server/src/ports/read.ts',
      '../ports/read.ts',
    ),
    edge(
      'apps/server/src/runtime/read.ts',
      'apps/server/src/use-cases/files/read.ts',
      '../use-cases/files/read.ts',
    ),
  ),
  pair(
    'package-cannot-import-server',
    edge(
      'packages/effects/src/read.ts',
      'packages/kernel/src/ports/index.ts',
      '../../kernel/src/ports/index.ts',
    ),
    edge(
      'packages/effects/src/read.ts',
      'apps/server/src/runtime/read.ts',
      '../../../apps/server/src/runtime/read.ts',
    ),
  ),
  ...[
    'node:child_process',
    'child_process',
    '@porcelain/process',
    'effect/process',
  ].map((module) =>
    pair(
      'process-importable-by-git-agents-installer',
      {
        'packages/git/src/discovery/commands/run.ts': `import * as dependency from '${module}'; export const value = dependency;`,
      },
      {
        'apps/server/src/runtime/run.ts': `import * as dependency from '${module}'; export const value = dependency;`,
      },
    ),
  ),
  ...['agents', 'installer', 'process', 'mac-network'].map((owner) =>
    pair(
      'process-importable-by-git-agents-installer',
      {
        [owner === 'agents'
          ? 'packages/agents/src/commit-planning/run.ts'
          : owner === 'process'
            ? 'packages/process/src/run.ts'
            : owner === 'installer'
              ? 'apps/server/src/installer/run.ts'
              : 'apps/server/src/adapters/access/mac-network-command.ts']:
          "import * as dependency from 'effect/process'; export const value = dependency;",
      },
      {
        'apps/server/src/adapters/access/other-command.ts':
          "import * as dependency from 'effect/process'; export const value = dependency;",
      },
    ),
  ),
  ...[
    'apps/server/src/adapters/access/mac-network-address-reader.ts',
    'apps/server/src/adapters/projects/git-platform.ts',
    'apps/server/src/adapters/access/mac-network-command-other.ts',
  ].map((path) =>
    pair(
      'process-importable-by-git-agents-installer',
      {
        'apps/server/src/adapters/access/mac-network-command.ts':
          "import { value } from '@porcelain/process'; export const result = value;",
      },
      {
        [path]:
          "import { value } from '@porcelain/process'; export const result = value;",
      },
    ),
  ),
  pair(
    'git-shared-dependency-order',
    git('discovery', 'shared'),
    git('shared', 'discovery'),
  ),
  pair(
    'git-discovery-dependency-order',
    git('discovery', 'shared'),
    git('discovery', 'inspection'),
  ),
  pair(
    'git-inspection-dependency-order',
    git('inspection', 'discovery'),
    git('inspection', 'history'),
  ),
  pair(
    'git-history-dependency-order',
    git('history', 'inspection'),
    git('history', 'actions'),
  ),
  pair(
    'git-capability-public-api-only',
    git('actions', 'history'),
    git('actions', 'history', true),
  ),
  ...[
    'access',
    'changes',
    'files',
    'git-actions',
    'projects',
    'reviews',
    'kernel',
    'contracts',
    'client',
  ].flatMap((owner) => [
    pair(
      'portable-imports-no-node',
      portable(owner, 'effect'),
      portable(owner, 'node:fs'),
    ),
    pair(
      'portable-imports-no-platform',
      portable(owner, 'effect'),
      portable(owner, '@effect/platform-node'),
    ),
  ]),
  ...['contracts', 'client'].map((owner) =>
    pair(
      'portable-crypto-only-in-rules',
      portable(owner, 'effect'),
      portable(owner, 'node:crypto'),
    ),
  ),
  pair('portable-crypto-only-in-rules', portable('kernel', 'node:crypto'), {
    'packages/kernel/src/models/read.ts':
      "import * as dependency from 'node:crypto'; export const value = dependency;",
  }),
  ...[
    'effect/FileSystem',
    'effect/Path',
    'effect/process',
    'electron',
    'react-native',
    'expo-file-system',
  ].map((module) =>
    pair(
      'portable-imports-no-platform',
      portable('client', 'effect'),
      portable('client', module),
    ),
  ),
  pair(
    'domain-imports-own-domain-and-kernel',
    edge(
      'packages/files/src/services/read.ts',
      'packages/kernel/src/ports/index.ts',
      '../../../kernel/src/ports/index.ts',
    ),
    edge(
      'packages/files/src/services/read.ts',
      'packages/reviews/src/services/index.ts',
      '../../../reviews/src/services/index.ts',
    ),
  ),
  pair(
    'client-imports-client-and-contracts-only',
    edge(
      'packages/client/src/shared/api/read.ts',
      'packages/contracts/src/shared/index.ts',
      '../../../../contracts/src/shared/index.ts',
    ),
    edge(
      'packages/client/src/shared/api/read.ts',
      'packages/storage/src/index.ts',
      '../../../../storage/src/index.ts',
    ),
  ),
  pair(
    'mobile-imports-mobile-client-and-contracts-only',
    edge(
      'apps/mobile/src/shared/read.ts',
      'packages/contracts/src/shared/index.ts',
      '../../../../packages/contracts/src/shared/index.ts',
    ),
    edge(
      'apps/mobile/src/shared/read.ts',
      'packages/storage/src/index.ts',
      '../../../../packages/storage/src/index.ts',
    ),
  ),
  pair(
    'runtime-imports-no-specs',
    edge(
      'packages/kernel/src/rules/read.ts',
      'packages/kernel/src/rules/value.ts',
      './value.ts',
    ),
    edge(
      'packages/kernel/src/rules/read.ts',
      'packages/kernel/src/rules/value.spec.ts',
      './value.spec.ts',
    ),
  ),
  pair(
    'runtime-imports-source-only',
    edge(
      'apps/server/src/config/read.ts',
      'apps/server/src/config/value.ts',
      './value.ts',
    ),
    edge(
      'apps/server/src/config/read.ts',
      'architecture/value.ts',
      '../../../../architecture/value.ts',
    ),
  ),
  pair(
    'unresolved-workspace-import',
    portable('client', 'effect'),
    portable('client', '@porcelain/missing'),
  ),
  pair(
    'web-no-runtime-fixture',
    { 'apps/web/src/shared/real.ts': unit },
    { 'apps/web/src/shared/fixture.ts': unit },
  ),
  pair(
    'web-no-runtime-fixture-connected',
    edge(
      'apps/web/src/shared/real.ts',
      'apps/web/src/shared/value.ts',
      './value.ts',
    ),
    edge(
      'apps/web/src/shared/fixture.ts',
      'apps/web/src/shared/value.ts',
      './value.ts',
    ),
  ),
  ...[
    'apps/server/src/http/read.ts',
    'apps/server/src/use-cases/files/read.ts',
    'apps/server/src/runtime/read.ts',
    'apps/server/src/adapters/files/read.ts',
    'packages/files/src/rules/read.ts',
    'packages/contracts/src/shared/read.ts',
    'packages/client/src/features/files/commands/read.ts',
    'packages/git/src/discovery/commands/read.ts',
    'apps/web/src/features/files/views/read.tsx',
    'apps/mobile/src/features/files/views/read.tsx',
  ].map((path) =>
    pair(
      'source-folder-isolated',
      { [path]: unit },
      { [path.replace(/src\/.+$/, 'src/stray.ts')]: unit },
    ),
  ),
  pair(
    'source-folder-isolated',
    { 'packages/files/src/rules/read.ts': unit },
    { 'packages/files/src/helpers/read.ts': unit },
  ),
  pair(
    'source-folder-connected',
    edge(
      'packages/files/src/rules/read.ts',
      'packages/files/src/models/read.ts',
      '../models/read.ts',
    ),
    edge(
      'packages/files/src/helpers/read.ts',
      'packages/files/src/models/read.ts',
      '../models/read.ts',
    ),
  ),
];
