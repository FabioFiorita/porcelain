import {
  createFileTreeIconResolver,
  getBuiltInSpriteSheet,
} from '@pierre/trees';
import { cn } from '@/lib/utils';

/** The tree's default: the fullest built-in set, coloured per file type. */
export const ICON_SET = 'complete' as const;

const resolver = createFileTreeIconResolver({ set: ICON_SET, colored: true });

/**
 * Pierre's icon sprite, once per page, so icons outside the tree's shadow root
 * can `<use>` the same symbols. Kept in the layout but invisible: a
 * `display: none` sprite breaks the icons that use gradients.
 */
export function PierreIconSprite() {
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the sprite is package-owned static markup
      dangerouslySetInnerHTML={{ __html: getBuiltInSpriteSheet(ICON_SET) }}
    />
  );
}

/**
 * A file's type icon, resolved exactly as the Files tree resolves it, so a tab,
 * a review row and the tree always agree. Colours come from `.pierre-file-icon`
 * in `pierre.css`.
 */
export function FileTypeIcon({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  const icon = resolver.resolveIcon('file-tree-icon-file', path);
  const width = icon.width ?? 16;
  const height = icon.height ?? 16;
  return (
    <svg
      aria-hidden="true"
      data-icon-token={icon.token}
      viewBox={icon.viewBox ?? `0 0 ${width} ${height}`}
      className={cn('pierre-file-icon', className)}
    >
      <use href={`#${icon.name}`} />
    </svg>
  );
}
