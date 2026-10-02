type RouteFixture = {
  name: string;
  files: Readonly<Record<string, string>>;
  called: readonly string[];
  registered?: readonly string[];
  problem?: string;
};

const manifest = JSON.stringify({
  exports: {
    './direct': './src/features/direct/api.ts',
    './barrel': './src/features/barrel/index.ts',
    './types': './src/features/types/api.ts',
  },
});

export const webRouteFixtures: readonly RouteFixture[] = [
  {
    name: 'runtime client exports and demanded reexports',
    files: {
      'packages/client/package.json': manifest,
      'apps/web/src/features/legacy/api.ts':
        "export const oldRead = () => fetch('/api/legacy');",
      'apps/web/src/features/example/queries/read.ts':
        "import { direct } from '@porcelain/client/direct'; import { load as aliased } from '@/shared/reader'; export const read = () => [direct(), aliased()];",
      'apps/web/src/shared/reader.ts':
        "export { selected as load } from '@porcelain/client/barrel';",
      'packages/client/src/features/direct/api.ts':
        "export const direct = (transport: typeof fetch) => transport('/api/direct');",
      'packages/client/src/features/barrel/index.ts':
        "export { query as selected } from './queries/read.ts'; export { mobileOnly } from '../mobile/api.ts'; export * from '../star/index.ts';",
      'packages/client/src/features/barrel/queries/read.ts':
        "import { remoteRead } from '../api.ts'; export const query = () => remoteRead();",
      'packages/client/src/features/barrel/api.ts':
        "export const remoteRead = (transport: typeof fetch) => transport('/api/shared', { method: 'POST' });",
      'packages/client/src/features/mobile/api.ts':
        "export const mobileOnly = (transport: typeof fetch) => transport('/api/mobile-only');",
      'packages/client/src/features/star/index.ts':
        "export { mobileOnly } from '../mobile/api.ts';",
    },
    called: ['GET /api/direct', 'GET /api/legacy', 'POST /api/shared'],
  },
  {
    name: 'type-only imports and reexports stay outside runtime discovery',
    files: {
      'packages/client/package.json': manifest,
      'apps/web/src/features/example/api.ts':
        "import type { TypeReader } from '@porcelain/client/types'; import { type TypeAlias } from '@porcelain/client/types'; export type { TypeReader as ExportedType } from '@porcelain/client/types'; export const read = () => fetch('/api/runtime');",
      'packages/client/src/features/types/api.ts':
        "export const TypeReader = () => fetch('/api/type-only'); export const TypeAlias = () => fetch('/api/type-alias');",
    },
    called: ['GET /api/runtime'],
  },
  {
    name: 'star reexports preserve demanded names across cycles',
    files: {
      'packages/client/package.json': manifest,
      'apps/web/src/features/example/api.ts':
        "import { starRead } from '@porcelain/client/barrel'; export const read = () => starRead();",
      'packages/client/src/features/barrel/index.ts':
        "export * from '../star/index.ts'; export * from '../mobile/api.ts';",
      'packages/client/src/features/star/index.ts':
        "export * from '../barrel/index.ts'; export { read as starRead } from './api.ts';",
      'packages/client/src/features/star/api.ts':
        "export const read = () => fetch('/api/star');",
      'packages/client/src/features/mobile/api.ts':
        "export const mobileOnly = () => fetch('/api/mobile-only');",
    },
    called: ['GET /api/star'],
  },
  {
    name: 'path helpers survive client barrel aliases',
    files: {
      'packages/client/package.json': manifest,
      'apps/web/src/features/example/api.ts':
        "import { path } from '@porcelain/client/barrel'; export const read = () => fetch(path());",
      'packages/client/src/features/barrel/index.ts':
        "export { environmentPath as path } from './rules/path.ts';",
      'packages/client/src/features/barrel/rules/path.ts':
        "export const environmentPath = () => '/api/environment';",
    },
    called: ['GET /api/environment'],
  },
  {
    name: 'unregistered shared client calls remain failures',
    files: {
      'packages/client/package.json': manifest,
      'apps/web/src/features/example/api.ts':
        "import { direct } from '@porcelain/client/direct'; export const read = () => direct();",
      'packages/client/src/features/direct/api.ts':
        "export const direct = () => fetch('/api/unregistered');",
    },
    called: ['GET /api/unregistered'],
    registered: ['GET /api/environment'],
    problem:
      'the web calls GET /api/unregistered, which the server does not register.',
  },
];
