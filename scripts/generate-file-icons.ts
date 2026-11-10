import { Schema } from 'effect';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const directory = fileURLToPath(
  new URL('../apps/web/node_modules/@pierre/trees/dist/', import.meta.url),
);
const source = await readFile(join(directory, 'builtInIcons.js'), 'utf8');
const extracted: unknown = runInNewContext(
  source.replace(/export \{[^}]+\};/, '') +
    '\n;({ names: BUILT_IN_FILE_NAME_TOKENS, extensions: {...BUILT_IN_FILE_EXTENSION_TOKENS, ...COMPLETE_EXTENSION_OVERRIDES}, sprite: getBuiltInSpriteSheet("complete") })',
);
const data = Schema.decodeUnknownSync(
  Schema.Struct({
    names: Schema.Record(Schema.String, Schema.String),
    extensions: Schema.Record(Schema.String, Schema.String),
    sprite: Schema.String,
  }),
)(extracted);
const style: unknown = await import(join(directory, 'style.js'));
const { default: css } = Schema.decodeUnknownSync(
  Schema.Struct({ default: Schema.String }),
)(style);
type IconColors = { light: string; dark: string };
const palette: Record<string, IconColors> = {};
for (const [, name, light, dark] of css.matchAll(
  /--trees-icon-([\w-]+): light-dark\((#[\da-f]+), (#[\da-f]+)\)/g,
)) {
  if (!name || !light || !dark) throw new Error('Invalid Pierre palette');
  palette[name] = { light, dark };
}
const colors: Record<string, IconColors> = {};
for (const [, token, color] of css.matchAll(
  /--trees-file-icon-color-([\w-]+): var\([^;]+var\(--trees-icon-([\w-]+)\)\)/g,
)) {
  const value = color ? palette[color] : undefined;
  if (!token || !value) throw new Error('Invalid Pierre icon color');
  colors[token] = value;
}
const symbols: Record<string, string> = {};
for (const [, token, attributes, body] of data.sprite.matchAll(
  /<symbol id="file-tree-builtin-([^"]+)"([^>]*)>([\s\S]*?)<\/symbol>/g,
)) {
  if (!token || !attributes || !body) throw new Error('Invalid Pierre symbol');
  symbols[token] = `<svg${attributes}>${body}</svg>`;
}
for (const token of [
  'default',
  ...Object.values(data.names),
  ...Object.values(data.extensions),
]) {
  if (!symbols[token]) throw new Error(`Missing Pierre artwork: ${token}`);
  if (!colors[token]) {
    const neutral = palette['gray'];
    if (!neutral) throw new Error('Missing Pierre neutral color');
    colors[token] = neutral;
  }
}
await writeFile(
  new URL(
    '../packages/client/src/features/files/rules/file-icon-data.json',
    import.meta.url,
  ),
  JSON.stringify(
    {
      names: data.names,
      extensions: Object.fromEntries(
        Object.entries(data.extensions).map(([extension, token]) => [
          extension.toLowerCase(),
          token,
        ]),
      ),
      symbols,
      colors,
    },
    null,
    2,
  ) + '\n',
);
