import check from '@expo/material-symbols/check.xml';
import add from '@expo/material-symbols/add.xml';
import menu from '@expo/material-symbols/menu.xml';
import filterList from '@expo/material-symbols/filter_list.xml';
import merge from '@expo/material-symbols/merge.xml';
import refresh from '@expo/material-symbols/refresh.xml';
import type { ImageSourcePropType } from 'react-native';
import { type HeaderIconName } from './icon';

const symbols = {
  add,
  sidebar: menu,
  workspace: filterList,
  refresh,
  done: check,
  compareParent: merge,
} satisfies Record<HeaderIconName, ImageSourcePropType>;

export function headerIcon(name: HeaderIconName) {
  return symbols[name];
}
