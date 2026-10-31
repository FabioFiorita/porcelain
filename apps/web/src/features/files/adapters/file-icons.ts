import type { FileTreeIconConfig } from '@pierre/trees';
const basename = (path: string) => path.split('/').at(-1) ?? path;

const SYMBOLS = {
  code: 'porcelain-file-code',
  text: 'porcelain-file-text',
  symlink: 'porcelain-symlink',
  submodule: 'porcelain-submodule',
};

const TEXT_EXTENSIONS = ['md', 'mdx', 'txt'];

const SYMBOL_ATTRIBUTES =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

const FILE_OUTLINE =
  '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" />';

const FOLDER_OUTLINE =
  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />';

export const FILE_ICON_SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="${SYMBOLS.code}" ${SYMBOL_ATTRIBUTES}>
    ${FILE_OUTLINE}
    <path d="M10 12.5 8 15l2 2.5" />
    <path d="m14 12.5 2 2.5-2 2.5" />
  </symbol>
  <symbol id="${SYMBOLS.text}" ${SYMBOL_ATTRIBUTES}>
    ${FILE_OUTLINE}
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </symbol>
  <symbol id="${SYMBOLS.symlink}" ${SYMBOL_ATTRIBUTES}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </symbol>
  <symbol id="${SYMBOLS.submodule}" ${SYMBOL_ATTRIBUTES}>
    ${FOLDER_OUTLINE}
    <circle cx="12" cy="13" r="2" />
    <path d="M14 13h3" />
    <path d="M7 13h3" />
  </symbol>
</svg>`;

export function treeIconsFor(
  links: readonly { path: string; kind: string }[] = [],
): FileTreeIconConfig {
  return {
    set: 'minimal',
    colored: false,
    spriteSheet: FILE_ICON_SPRITE,
    remap: {
      'file-tree-icon-file': SYMBOLS.code,
    },
    byFileExtension: Object.fromEntries(
      TEXT_EXTENSIONS.map((extension) => [extension, SYMBOLS.text]),
    ),
    byFileName: Object.fromEntries(
      links.flatMap((link) => {
        const symbol =
          link.kind === 'symlink'
            ? SYMBOLS.symlink
            : link.kind === 'submodule'
              ? SYMBOLS.submodule
              : null;
        return symbol ? [[basename(link.path), symbol]] : [];
      }),
    ),
  };
}
