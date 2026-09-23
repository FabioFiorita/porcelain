import type { FileTreeIconConfig } from '@pierre/trees';
import { basename } from '../../domain/review';

const LINK_SYMBOLS = {
  symlink: 'porcelain-symlink',
  submodule: 'porcelain-submodule',
} as const;

const LINK_SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="${LINK_SYMBOLS.symlink}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </symbol>
  <symbol id="${LINK_SYMBOLS.submodule}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    <circle cx="12" cy="13" r="2" />
    <path d="M14 13h3" />
    <path d="M7 13h3" />
  </symbol>
</svg>`;

export function treeIconsFor(
  links: readonly { path: string; kind: string }[] = [],
): FileTreeIconConfig {
  return {
    set: 'complete',
    colored: true,
    spriteSheet: LINK_SPRITE,
    byFileName: Object.fromEntries(
      links.flatMap((link) => {
        const symbol =
          link.kind === 'symlink'
            ? LINK_SYMBOLS.symlink
            : link.kind === 'submodule'
              ? LINK_SYMBOLS.submodule
              : null;
        return symbol ? [[basename(link.path), symbol]] : [];
      }),
    ),
  };
}
