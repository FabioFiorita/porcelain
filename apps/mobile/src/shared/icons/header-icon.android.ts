import add from '@expo/material-symbols/add.xml';
import check from '@expo/material-symbols/check.xml';
import filterList from '@expo/material-symbols/filter_list.xml';
import merge from '@expo/material-symbols/merge.xml';
import refresh from '@expo/material-symbols/refresh.xml';
import type { ImageSourcePropType } from 'react-native';
import { type HeaderIconName } from './icon';

const symbols = {
  workspace: filterList,
  refresh,
  done: check,
  compareParent: merge,
  add,
} satisfies Record<HeaderIconName, ImageSourcePropType>;

export function headerIcon(name: HeaderIconName) {
  return symbols[name];
}
