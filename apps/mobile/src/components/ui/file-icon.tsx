import { Icon } from './icon';

export function FileIcon({
  kind = 'file',
}: {
  kind?: 'file' | 'folder' | 'openFolder' | 'code' | 'image';
}) {
  return <Icon name={kind} tone="muted" />;
}
