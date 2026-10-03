import {
  createFileTreeIconResolver,
  getBuiltInSpriteSheet,
} from '@pierre/trees';
import { cn } from '@/shared/lib/utils';
import { FILE_ICON_DEFAULT_SIZE } from '@/config/limits';

const ICON_SET = 'complete';

const resolver = createFileTreeIconResolver({
  set: ICON_SET,
  colored: true,
});

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
      dangerouslySetInnerHTML={{ __html: getBuiltInSpriteSheet(ICON_SET) }}
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
      data-icon-token={icon.token}
      viewBox={icon.viewBox ?? `0 0 ${width} ${height}`}
      className={cn('pierre-file-icon', className)}
    >
      <use href={`#${icon.name}`} />
    </svg>
  );
}
