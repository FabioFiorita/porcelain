import data from './file-icon-data.json' with { type: 'json' };

export const completeFileIconRules = {
  byFileName: Object.fromEntries(
    Object.entries(data.names).map(([name, token]) => [
      name,
      { name: `file-tree-builtin-${token}`, token },
    ]),
  ),
  byFileExtension: Object.fromEntries(
    Object.entries(data.extensions).map(([extension, token]) => [
      extension,
      { name: `file-tree-builtin-${token}`, token },
    ]),
  ),
};

const names = new Map<string, string>(Object.entries(data.names));
const extensions = new Map<string, string>(Object.entries(data.extensions));

export function fileIconToken(path: string): string {
  const name = (path.split('/').at(-1) ?? path).toLowerCase();
  const named = names.get(name);
  if (named) return named;
  const segments = name.split('.');
  for (let index = 1; index < segments.length; index += 1) {
    const token = extensions.get(segments.slice(index).join('.'));
    if (token) return token;
  }
  return 'default';
}

export const completeFileIconArtwork: Readonly<Record<string, string>> =
  data.symbols;
export const completeFileIconColors: Readonly<
  Record<string, { light: string; dark: string }>
> = data.colors;
