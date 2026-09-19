import type { FileTreeIconConfig } from '@pierre/trees';
import { FolderGit2, Link2 } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { basename } from '../../domain/review';
import { ICON_SET } from './file-type-icon';

/** A symlink or submodule row in the Files tree: a leaf that is never followed. */
export type TreeLink = {
  path: string;
  kind: 'symlink' | 'submodule';
  target?: string;
};

const LINK_SYMBOLS = {
  symlink: 'porcelain-symlink',
  submodule: 'porcelain-submodule',
} as const;

/** Lucide sets its strokes on the `<svg>`, which a `<symbol>` loses; carry them over. */
function lucideSymbol(id: string, svg: string): string {
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<symbol id="${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</symbol>`;
}

/** Rendered once: the symbols never change, only which names map to them. */
const SPRITE_SHEET = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${[
  lucideSymbol(LINK_SYMBOLS.symlink, renderToStaticMarkup(<Link2 />)),
  lucideSymbol(LINK_SYMBOLS.submodule, renderToStaticMarkup(<FolderGit2 />)),
].join('')}</svg>`;

/**
 * Pierre's own icon set, the one `FileTypeIcon` draws outside the tree. Only
 * symlinks and submodules add symbols (lucide Link2 and FolderGit2), mapped by
 * name because the tree has no per-path icon rule. Folders load as they open,
 * so the links known so far are the ones in folders the reviewer opened.
 */
export function treeIconsFor(
  links: readonly TreeLink[] = [],
): FileTreeIconConfig {
  return {
    set: ICON_SET,
    colored: true,
    spriteSheet: SPRITE_SHEET,
    byFileName: Object.fromEntries(
      links.map((link) => [basename(link.path), LINK_SYMBOLS[link.kind]]),
    ),
  };
}
