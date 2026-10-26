import { createFileTreeIconResolver } from '@pierre/trees';
import { cn } from '@/shared/lib/utils';
import { FILE_ICON_DEFAULT_SIZE } from '@/config/limits';
import { FILE_ICON_SPRITE, treeIconsFor } from '../adapters/file-icons';

const resolver = createFileTreeIconResolver(treeIconsFor());

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
      dangerouslySetInnerHTML={{ __html: FILE_ICON_SPRITE }}
    />
  );
}

export function FileTypeIcon({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  const icon = resolver.resolveIcon('file-tree-icon-file', path);
  const width = icon.width ?? FILE_ICON_DEFAULT_SIZE;
  const height = icon.height ?? FILE_ICON_DEFAULT_SIZE;
  return (
    <svg
      aria-hidden="true"
      viewBox={icon.viewBox ?? `0 0 ${width} ${height}`}
      className={cn('pierre-file-icon', className)}
    >
      <use href={`#${icon.name}`} />
    </svg>
  );
}
