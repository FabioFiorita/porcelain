import { expect, test } from 'vitest';
import { mutableDeclarations } from './source-conventions.ts';

test.each([
  ['let count = 0; count++;', 1],
  ['var count = 0;', 1],
  ['function work() { let { value } = input; }', 1],
  ['for (let i = 0; i < 2; i++) {}', 1],
  ['for (var item of items) {}', 1],
  ['for (let key in object) {}', 1],
  ['let first = 1; var second = 2;', 2],
])('rejects mutable declarations: %s', (source, count) => {
  expect(
    mutableDeclarations('apps/server/src/example.ts', source),
  ).toHaveLength(count);
});

test('reports the declaration location', () => {
  expect(
    mutableDeclarations('packages/client/src/read.ts', '\n  let value = 1;'),
  ).toEqual([
    'packages/client/src/read.ts:2:3: Use const and explicit results instead of let/var.',
  ]);
});

test.each([
  'const message = "let count = 1"; // var example',
  'const expression = /let value/;',
  'const object = { let: 1, var: 2 };',
  'for (const item of items) {}',
  'class Runner { pending = Promise.resolve(); }',
  'using resource = open();',
  'const view = <span>let var</span>;',
])('accepts immutable declarations and unrelated syntax: %s', (source) => {
  expect(mutableDeclarations('apps/web/src/view.tsx', source)).toEqual([]);
});

test.each([
  'apps/server/src/example.spec.ts',
  'apps/web/src/view.spec.tsx',
  'apps/server/src/types.d.ts',
  'scripts/example.ts',
])('excludes specs, declarations and tooling: %s', (file) => {
  expect(mutableDeclarations(file, 'let value = 1;')).toEqual([]);
});

test.each(['ts', 'tsx', 'js', 'jsx', 'mts', 'cts', 'mjs', 'cjs'])(
  'checks %s source',
  (extension) => {
    expect(
      mutableDeclarations(
        `packages/client/src/value.${extension}`,
        'let value = 1;',
      ),
    ).toHaveLength(1);
  },
);

// Only upstream shadcn primitives may retain their original declarations.
test('keeps the vendored declaration exception out of application components', () => {
  expect(
    mutableDeclarations(
      'apps/web/src/components/ui/chart.tsx',
      'let value = 1;',
    ),
  ).toEqual([]);
  expect(
    mutableDeclarations('apps/web/src/components/chart.tsx', 'let value = 1;'),
  ).toHaveLength(1);
  expect(
    mutableDeclarations('apps/web/src/views/chart.tsx', 'var value = 1;'),
  ).toHaveLength(1);
});
