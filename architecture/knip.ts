import type { KnipConfiguration } from 'knip';
import { parseSync } from 'oxc-parser';
function expoEntries(source: string, path: string): string {
  if (!/\/apps\/mobile\/src\/app\/.+\.tsx$/.test(path)) return source;
  const parsed = parseSync(path, source, { lang: 'tsx' });
  if (parsed.errors.length) throw new Error(`Knip could not parse ${path}`);
  const destination = parsed.program.body
    .flatMap((node) =>
      node.type === 'ImportDeclaration' ? node.specifiers : [],
    )
    .find(
      (specifier) =>
        specifier.type === 'ImportSpecifier' &&
        specifier.imported.type === 'Identifier' &&
        specifier.imported.name === 'DestinationLayout',
    );
  if (path.endsWith('/_layout.tsx') && destination) {
    const name = new RegExp(
      `<${destination.local.name}\\b[^>]*\\bname=["']([^"']+)["']`,
    ).exec(source)?.[1];
    const settings = parsed.program.body.find(
      (node) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration?.type === 'VariableDeclaration' &&
        node.declaration.declarations.some(
          (declaration) =>
            declaration.id.type === 'Identifier' &&
            declaration.id.name === 'unstable_settings',
        ),
    );
    const declaration =
      settings?.type === 'ExportNamedDeclaration' &&
      settings.declaration?.type === 'VariableDeclaration'
        ? settings.declaration.declarations.find(
            (declaration) =>
              declaration.id.type === 'Identifier' &&
              declaration.id.name === 'unstable_settings',
          )
        : undefined;
    const anchor =
      declaration?.init?.type === 'ObjectExpression'
        ? declaration.init.properties.find(
            (property) =>
              property.type === 'Property' &&
              property.key.type === 'Identifier' &&
              property.key.name === 'anchor',
          )
        : undefined;
    if (
      !name ||
      anchor?.type !== 'Property' ||
      anchor.value.type !== 'Literal' ||
      anchor.value.value !== name
    )
      throw new Error(
        `${path} exports unstable_settings with anchor matching its destination, because a cold deep link needs a route to go back to.`,
      );
  }
  const entries = parsed.program.body.filter(
    (node) =>
      node.type === 'ExportDefaultDeclaration' ||
      (node.type === 'ExportNamedDeclaration' &&
        node.specifiers.length === 1 &&
        node.specifiers[0]?.exported.type === 'Identifier' &&
        ['default', 'unstable_settings'].includes(
          node.specifiers[0].exported.name,
        )) ||
      (node.type === 'ExportNamedDeclaration' &&
        node.declaration?.type === 'VariableDeclaration' &&
        node.declaration.declarations.length === 1 &&
        node.declaration.declarations[0]?.id.type === 'Identifier' &&
        node.declaration.declarations[0].id.name === 'unstable_settings'),
  );
  for (const node of entries.toReversed())
    source =
      source.slice(0, node.start) +
      '/** @public */\n' +
      source.slice(node.start);
  return source;
}
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
  ignoreIssues: {
    'architecture/**': ['files', 'exports', 'types', 'nsExports', 'nsTypes'],
    '**/spec/**': ['files', 'exports', 'types', 'nsExports', 'nsTypes'],
    '**/*.{spec,d}.ts': ['exports', 'types', 'nsExports', 'nsTypes'],
    'apps/mobile/metro.config.cjs': ['exports'],
    'apps/mobile/babel.config.js': ['exports'],
    'package.json': ['dependencies', 'devDependencies'],
    'packages/*/package.json': ['dependencies'],
    'apps/{server,desktop,mobile}/package.json': ['dependencies'],
  },
  workspaces: {
    '.': {
      entry: [
        'scripts/*.ts',
        'scripts/cli/**/*.ts',
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
      ignoreIssues: {
        'src/components/ui/**': ['exports', 'types', 'nsExports', 'nsTypes'],
      },
    },
    'apps/mobile': {
      entry: [
        'src/app/**/*.tsx',
        'src/**/*.spec.ts',
        'spec/**/*.e2e.ts',
        'metro.config.cjs',
        'babel.config.js',
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
  compilers: { tsx: expoEntries },
} satisfies KnipConfiguration;
