import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { withUniwind, useResolveClassNames } from 'uniwind';
const StyledSymbol = withUniwind(SymbolView);
const symbols = {
  add: { ios: 'plus', android: 'add' },
  close: { ios: 'xmark', android: 'close' },
  copy: { ios: 'document.on.document', android: 'content_copy' },
  check: { ios: 'checkmark', android: 'check' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  down: { ios: 'chevron.down', android: 'expand_more' },
  file: { ios: 'document', android: 'description' },
  code: { ios: 'chevron.left.forwardslash.chevron.right', android: 'code' },
  image: { ios: 'photo', android: 'image' },
  folder: { ios: 'folder', android: 'folder' },
  openFolder: { ios: 'folder.fill', android: 'folder_open' },
  info: { ios: 'info.circle', android: 'info' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
  comment: { ios: 'bubble', android: 'chat_bubble' },
  history: { ios: 'clock.arrow.circlepath', android: 'history' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
} satisfies Record<string, SymbolViewProps['name']>;
const tones = {
  default: 'accent-foreground',
  muted: 'accent-muted-foreground',
  destructive: 'accent-destructive',
  primaryForeground: 'accent-primary-foreground',
  secondaryForeground: 'accent-secondary-foreground',
  primary: 'accent-primary',
};
export type IconName = keyof typeof symbols;
export function Icon({
  name,
  tone = 'default',
  size = 'default',
}: {
  name: IconName;
  tone?: keyof typeof tones;
  size?: 'small' | 'default' | 'large';
}) {
  const dimensions = useResolveClassNames(
    size === 'small' ? 'size-3.5' : size === 'large' ? 'size-6' : 'size-4.5',
  );
  const dimension = Number(dimensions.width);
  return (
    <StyledSymbol
      name={symbols[name]}
      size={dimension}
      style={dimensions}
      tintColorClassName={tones[tone]}
      accessible={false}
    />
  );
}
