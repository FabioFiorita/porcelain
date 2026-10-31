import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useWindowDimensions } from 'react-native';
import { withUniwind, useResolveClassNames } from 'uniwind';
import { iconSize } from './icon-size';
const StyledSymbol = withUniwind(SymbolView);
const symbols = {
  add: { ios: 'plus', android: 'add' },
  filter: { ios: 'line.3.horizontal.decrease', android: 'filter_list' },
  closed: { ios: 'archivebox', android: 'archive' },
  search: { ios: 'magnifyingglass', android: 'search' },
  close: { ios: 'xmark', android: 'close' },
  copy: { ios: 'document.on.document', android: 'content_copy' },
  check: { ios: 'checkmark', android: 'check' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  previous: { ios: 'chevron.left', android: 'chevron_left' },
  send: { ios: 'arrow.up', android: 'arrow_upward' },
  down: { ios: 'chevron.down', android: 'expand_more' },
  collapse: { ios: 'chevron.up.chevron.down', android: 'unfold_less' },
  file: { ios: 'document', android: 'description' },
  code: { ios: 'chevron.left.forwardslash.chevron.right', android: 'code' },
  image: { ios: 'photo', android: 'image' },
  folder: { ios: 'folder', android: 'folder' },
  openFolder: { ios: 'folder.fill', android: 'folder_open' },
  files: { ios: 'folder', android: 'folder' },
  review: { ios: 'plus.minus.capsule', android: 'compare_arrows' },
  settings: { ios: 'gearshape', android: 'settings' },
  appearance: { ios: 'paintbrush', android: 'palette' },
  environments: { ios: 'desktopcomputer', android: 'computer' },
  info: { ios: 'info.circle', android: 'info' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
  comment: { ios: 'bubble', android: 'chat_bubble' },
  lock: { ios: 'lock', android: 'lock' },
  history: { ios: 'clock.arrow.circlepath', android: 'history' },
  branch: { ios: 'arrow.triangle.branch', android: 'fork_right' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh' },
  trash: { ios: 'trash', android: 'delete' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
  split: { ios: 'rectangle.split.2x1', android: 'vertical_split' },
  hidden: { ios: 'eye.slash', android: 'visibility_off' },
  visible: { ios: 'eye', android: 'visibility' },
  sliders: { ios: 'slider.horizontal.3', android: 'tune' },
  checklist: { ios: 'checklist', android: 'checklist' },
  sidebar: { ios: 'sidebar.left', android: 'left_panel_open' },
  panel: { ios: 'sidebar.right', android: 'right_panel_open' },
} satisfies Record<string, SymbolViewProps['name']>;
const tones = {
  default: 'accent-foreground',
  muted: 'accent-muted-foreground',
  destructive: 'accent-destructive',
  primaryForeground: 'accent-primary-foreground',
  secondaryForeground: 'accent-secondary-foreground',
  primary: 'accent-primary',
  brand: 'accent-brand',
  background: 'accent-background',
};
export type IconName = keyof typeof symbols;
export function Icon({
  name,
  tone = 'default',
  size = 'default',
}: {
  name: IconName;
  tone?: keyof typeof tones;
  size?: 'tiny' | 'caption' | 'small' | 'control' | 'default' | 'large';
}) {
  const { fontScale } = useWindowDimensions();
  const dimensions = useResolveClassNames(
    size === 'tiny'
      ? 'size-2.25'
      : size === 'caption'
        ? 'size-3.25'
        : size === 'small'
          ? 'size-3.5'
          : size === 'control'
            ? 'size-4'
            : size === 'large'
              ? 'size-6'
              : 'size-4.5',
  );
  const dimension = Number(dimensions.width);
  return (
    <StyledSymbol
      name={symbols[name]}
      size={iconSize(dimension, fontScale)}
      style={dimensions}
      tintColorClassName={tones[tone]}
      accessible={false}
    />
  );
}
