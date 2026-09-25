import {
  createFileTreeIconResolver,
  getBuiltInSpriteSheet,
} from '@pierre/trees';
import { cn } from '@/shared/lib/utils';

const ICON_SET = 'complete' as const;

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
