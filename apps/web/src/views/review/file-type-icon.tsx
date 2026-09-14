import {
  createFileTreeIconResolver,
  getBuiltInSpriteSheet,
} from '@pierre/trees';
import { cn } from '@/lib/utils';

/** The same complete, coloured icon set used by the Files tree. */
export const ICON_SET = 'complete' as const;

const resolver = createFileTreeIconResolver({
  set: ICON_SET,
  colored: true,
});

/**
 * Mount Pierre's symbols once outside the tree's shadow root. Keeping the
 * sprite in the document (rather than display:none) preserves its gradients.
 */
export function PierreIconSprite() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: 0,
        height: 0,
        overflow: 'hidden',
      }}
      // @pierre/trees supplies this static, trusted sprite markup.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the sprite is package-owned static markup
      dangerouslySetInnerHTML={{ __html: getBuiltInSpriteSheet(ICON_SET) }}
    />
  );
}

/** Resolve a file icon with the same rules as Pierre's Files tree. */
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
