import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';

const resolve = createRequire(new URL('../package.json', import.meta.url));

function exportNames(source: string) {
  return new Set(
    [
      ...source.matchAll(/\bget (\w+)\(\)/g),
      ...source.matchAll(/defineProperty\(module\.exports, '(\w+)'/g),
    ].flatMap(([, name]) => (name === undefined ? [] : [name])),
  );
}

it('forwards every React Native export through the Uniwind module that Metro substitutes for react-native', async () => {
  const reactNative = await readFile(
    join(dirname(resolve.resolve('react-native/package.json')), 'index.js'),
    'utf8',
  );
  const uniwind = await readFile(
    join(
      dirname(resolve.resolve('uniwind/package.json')),
      'src/components/index.ts',
    ),
    'utf8',
  );
  const required = [...exportNames(reactNative)].sort();
  expect(
    required.filter((name) =>
      ['AssetRegistry', 'InteractionManager', 'Touchable', 'View'].includes(
        name,
      ),
    ),
  ).toEqual(['AssetRegistry', 'InteractionManager', 'Touchable', 'View']);
  expect(uniwind).toContain(
    "get AssetRegistry() {\n        return require('react-native').AssetRegistry",
  );
  expect(required.filter((name) => exportNames(uniwind).has(name))).toEqual(
    required,
  );
});
