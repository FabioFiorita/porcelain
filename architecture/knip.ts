import type { KnipConfiguration } from 'knip';

const sourceIssues: (
  | 'files'
  | 'exports'
  | 'types'
  | 'nsExports'
  | 'nsTypes'
)[] = ['files', 'exports', 'types', 'nsExports', 'nsTypes'];

export default {
  include: [
    'files',
    'exports',
    'types',
    'nsExports',
    'nsTypes',
    'dependencies',
  ],
  includeEntryExports: true,
  // Keep reporting source code and web dependencies, the original useful scope.
  ignoreIssues: {
    'architecture/**': sourceIssues,
    '**/scripts/**': sourceIssues,
    '**/spec/**': sourceIssues,
    '**/*.spec.ts': sourceIssues,
    '**/*.d.ts': sourceIssues,
    '**/*.config.ts': sourceIssues,
    'vitest.config.ts': sourceIssues,
    'apps/web/src/components/ui/**': sourceIssues,
    'apps/web/src/routeTree.gen.ts': sourceIssues,
    '**/package.json': ['devDependencies'],
    'package.json': ['dependencies'],
    'packages/*/package.json': ['dependencies'],
    'apps/{server,desktop,mobile}/package.json': ['dependencies'],
  },
  workspaces: {
    '.': {
      entry: [
        'scripts/*.ts',
        'architecture/rule-tests.mjs',
        'architecture/guardrail-tests.mjs',
      ],
      project: ['scripts/**/*.ts', 'architecture/**/*.{ts,mjs}'],
      includeEntryExports: false,
    },
    'apps/desktop': {
      entry: [
        'src/{main,preload,server}.ts',
        'src/**/*.spec.ts',
        'spec/**/*.e2e.ts',
      ],
      project: ['src/**/*.ts', 'spec/**/*.ts'],
    },
    'apps/server': {
      entry: [
        'src/bootstrap/main.ts',
        'src/**/*.spec.ts',
        'spec/**/*.{spec,integration,perf}.ts',
      ],
      project: ['src/**/*.ts', 'spec/**/*.ts'],
    },
    'apps/web': {
      entry: [
        'src/main.tsx',
        'src/**/*.spec.ts',
        'spec/**/*.{test,e2e}.tsx',
        'spec/**/*.e2e.ts',
      ],
      project: ['src/**/*.{ts,tsx,css}', 'spec/**/*.{ts,tsx}'],
    },
    'apps/mobile': {
      includeEntryExports: false,
      entry: [
        'src/app/**/*.tsx',
        'src/**/*.spec.ts',
        'spec/**/*.e2e.ts',
        'metro.config.cjs',
      ],
      project: ['src/**/*.{ts,tsx,css}', 'spec/**/*.ts'],
      tailwind: true,
      metro: { config: [] },
    },
    'packages/*': {
      entry: [
        'src/**/*.spec.ts',
        'spec/**/*.{spec,integration}.ts',
        'spec/fixtures/isolated-git.ts',
      ],
      project: ['src/**/*.ts', 'spec/**/*.ts'],
    },
  },
} satisfies KnipConfiguration;
