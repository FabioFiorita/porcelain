import type { KnipConfiguration } from 'knip';
import { parseSync, type Expression } from 'oxc-parser';

function unwrapped(
  node: Expression | null | undefined,
): Expression | null | undefined {
  return node?.type === 'TSAsExpression' ||
    node?.type === 'TSSatisfiesExpression'
    ? unwrapped(node.expression)
    : node;
}

function expoEntries(source: string, path: string): string {
  if (!/\/apps\/mobile\/src\/app\/.+\.tsx$/.test(path)) return source;
  const parsed = parseSync(path, source, { lang: 'tsx' });
  if (parsed.errors.length) throw new Error(`Knip could not parse ${path}`);
  if (path.endsWith('/_layout.tsx') && /<\w*Stack\b/.test(source)) {
    const declaration = parsed.program.body
      .flatMap((node) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration?.type === 'VariableDeclaration'
          ? node.declaration.declarations
          : [],
      )
      .find(
        (declaration) =>
          declaration.id.type === 'Identifier' &&
          declaration.id.name === 'unstable_settings',
      );
    const anchored = (value: Expression | null | undefined): boolean => {
      const settings = unwrapped(value);
      if (settings?.type !== 'ObjectExpression') return false;
      const anchor = settings.properties.find(
        (property) =>
          property.type === 'Property' &&
          property.key.type === 'Identifier' &&
          property.key.name === 'anchor',
      );
      if (anchor?.type === 'Property') {
        const literal = unwrapped(anchor.value);
        return literal?.type === 'Literal' && typeof literal.value === 'string';
      }
      return (
        settings.properties.length > 0 &&
        settings.properties.every(
          (property) =>
            property.type === 'Property' && anchored(property.value),
        )
      );
    };
    if (!anchored(declaration?.init))
      throw new Error(
        `${path} exports unstable_settings with an anchor for its stack, or one anchor per shared group, because a cold deep link needs a route to go back to.`,
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
        node.declaration.declarations[0].id.name === 'unstable_settings') ||
      (path.endsWith('/+native-intent.tsx') &&
        node.type === 'ExportNamedDeclaration' &&
        node.declaration?.type === 'FunctionDeclaration' &&
        node.declaration.id?.name === 'redirectSystemPath'),
  );
  for (const node of entries.toReversed())
    source =
      source.slice(0, node.start) +
      '/** @public */\n' +
      source.slice(node.start);
  return source;
}
export default {
  ignoreWorkspaces: ['apps/marketing'],
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
    '.agents/skills': {
      includeEntryExports: false,
      entry: [
        '*/scripts/cli.ts',
        '*/scripts/*.spec.ts',
        'spec/integration/*.integration.ts',
      ],
      project: ['**/*.ts'],
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
        'src/bootstrap/watch-host.ts',
        'src/**/*.spec.ts',
        'spec/**/*.{spec,integration}.ts',
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
        'spec/**/*.spec.ts',
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
