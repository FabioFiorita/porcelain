import {
  createFileTreeIconResolver,
  getBuiltInSpriteSheet,
} from '@pierre/trees';
import { cn } from '@/shared/lib/utils';
import { FILE_ICON_DEFAULT_SIZE } from '@/config/limits';
import { FILE_ICON_SPRITE, treeIconsFor } from '../adapters/file-icons';

const resolver = createFileTreeIconResolver(treeIconsFor());
const sprite = `${getBuiltInSpriteSheet('minimal')}${FILE_ICON_SPRITE}`;

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
      dangerouslySetInnerHTML={{ __html: sprite }}
    />
  );
}

export function FileTreeIcon({
  path,
  expanded,
  className,
}: (
  | { path: string; expanded?: never }
  | { path?: never; expanded: boolean }
) & {
  className?: string;
}) {
  const icon = resolver.resolveIcon(
    path === undefined ? 'file-tree-icon-chevron' : 'file-tree-icon-file',
    path,
  );
  const width = icon.width ?? FILE_ICON_DEFAULT_SIZE;
  const height = icon.height ?? FILE_ICON_DEFAULT_SIZE;
  return (
    <svg
      aria-hidden="true"
      viewBox={icon.viewBox ?? `0 0 ${width} ${height}`}
      className={cn(
        'pierre-file-icon',
        expanded === false && '-rotate-90',
        className,
      )}
    >
      <use href={`#${icon.name}`} />
    </svg>
  );
}
