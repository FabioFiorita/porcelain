import archive from '@expo/material-symbols/archive.xml';
import close from '@expo/material-symbols/close.xml';
import check from '@expo/material-symbols/check.xml';
import add from '@expo/material-symbols/add.xml';
import merge from '@expo/material-symbols/merge.xml';
import refresh from '@expo/material-symbols/refresh.xml';
import settings from '@expo/material-symbols/settings.xml';
import taskAlt from '@expo/material-symbols/task_alt.xml';
import undo from '@expo/material-symbols/undo.xml';
import type { ImageSourcePropType } from 'react-native';
import { type HeaderIconName } from './icon';

const symbols = {
  add,
  settings,
  refresh,
  done: check,
  close,
  closed: archive,
  compareParent: merge,
  resolve: taskAlt,
  reopen: undo,
} satisfies Record<HeaderIconName, ImageSourcePropType>;

export function headerIcon(name: HeaderIconName) {
  return symbols[name];
}
