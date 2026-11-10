import { type SFSymbolIcon } from 'expo-router/native-tabs';
import { type HeaderIconName } from './icon';

const symbols = {
  add: 'plus',
  settings: 'gearshape',
  refresh: 'arrow.clockwise',
  done: 'checkmark',
  close: 'xmark',
  closed: 'archivebox',
  compareParent: 'arrow.triangle.merge',
  resolve: 'checkmark.circle',
  reopen: 'arrow.uturn.backward',
  timeline: 'clock.arrow.circlepath',
  comments: 'bubble.left.and.bubble.right',
  hideComments: 'bubble.left.and.bubble.right.fill',
  comment: 'plus.bubble',
  clearSelection: 'xmark.circle',
  markReviewed: 'checkmark.circle',
  unmarkReviewed: 'checkmark.circle.fill',
  comparison: 'arrow.left.arrow.right',
  showSource: 'chevron.left.forwardslash.chevron.right',
  showRendered: 'doc.richtext',
  files: 'list.bullet',
  more: 'ellipsis',
  showList: 'sidebar.left',
  hideList: 'sidebar.left',
} satisfies Record<HeaderIconName, NonNullable<SFSymbolIcon['sf']>>;

export function headerIcon(name: HeaderIconName) {
  return symbols[name];
}
