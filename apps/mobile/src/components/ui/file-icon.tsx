import {
  completeFileIconArtwork,
  completeFileIconColors,
  fileIconToken,
} from '@porcelain/client/files/rules';
import { SvgAst, parse } from 'react-native-svg';
import { useUniwind } from 'uniwind';
import { Icon } from './icon';

const artwork = Object.fromEntries(
  Object.entries(completeFileIconArtwork).map(([token, xml]) => [
    token,
    parse(xml),
  ]),
);

export function FileIcon({
  path,
  kind = 'file',
}: {
  path: string;
  kind?: 'file' | 'folder' | 'openFolder';
}) {
  const { theme } = useUniwind();
  if (kind === 'folder' || kind === 'openFolder')
    return <Icon name={kind} tone="muted" />;
  const token = fileIconToken(path);
  const color = completeFileIconColors[token];
  return (
    <SvgAst
      ast={artwork[token] ?? null}
      override={{
        width: 16,
        height: 16,
        color: (theme === 'dark' ? color?.dark : color?.light) ?? '#84848a',
      }}
    />
  );
}
