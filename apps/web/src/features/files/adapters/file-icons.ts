import type { FileTreeIconConfig } from '@pierre/trees';
const basename = (path: string) => path.split('/').at(-1) ?? path;

const SYMBOLS = {
  chevron: 'porcelain-chevron',
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

export const FILE_ICON_SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="${SYMBOLS.chevron}" ${SYMBOL_ATTRIBUTES}>
    <path d="m6 9 6 6 6-6" />
  </symbol>
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
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    <circle cx="12" cy="13" r="2" />
    <path d="M14 13h3" />
    <path d="M7 13h3" />
  </symbol>
</svg>`;

const FOLDER_OUTLINES = {
  closed:
    '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />',
  open: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />',
};

const folderMask = (outline: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" ${SYMBOL_ATTRIBUTES.replace('currentColor', 'black')}>${outline}</svg>`,
  )}") center / contain no-repeat`;

const FOLDER_GAP = 'calc(var(--trees-item-row-gap) / 2)';

export const FOLDER_ICON_CSS = `[data-item-type="folder"] > [data-item-section="icon"] { width: calc(2 * var(--trees-icon-width) + ${FOLDER_GAP}); justify-content: space-between; } [data-item-type="folder"] > [data-item-section="icon"]::after { content: ""; flex-shrink: 0; width: var(--trees-icon-width); height: var(--trees-icon-width); background-color: currentColor; mask: ${folderMask(FOLDER_OUTLINES.open)}; } [data-item-type="folder"][aria-expanded="false"] > [data-item-section="icon"]::after { mask: ${folderMask(FOLDER_OUTLINES.closed)}; } [data-item-type="file"] > [data-item-section="icon"] { margin-left: calc(var(--trees-icon-width) + ${FOLDER_GAP}); }`;

export function treeIconsFor(
  links: readonly { path: string; kind: string }[] = [],
): FileTreeIconConfig {
  return {
    set: 'minimal',
    colored: false,
    spriteSheet: FILE_ICON_SPRITE,
    remap: {
      'file-tree-icon-chevron': SYMBOLS.chevron,
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
