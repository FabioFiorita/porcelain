import archive from '@expo/material-symbols/archive.xml';
import close from '@expo/material-symbols/close.xml';
import check from '@expo/material-symbols/check.xml';
import add from '@expo/material-symbols/add.xml';
import merge from '@expo/material-symbols/merge.xml';
import refresh from '@expo/material-symbols/refresh.xml';
import settings from '@expo/material-symbols/settings.xml';
import taskAlt from '@expo/material-symbols/task_alt.xml';
import undo from '@expo/material-symbols/undo.xml';
import history from '@expo/material-symbols/history.xml';
import forum from '@expo/material-symbols/forum.xml';
import commentsDisabled from '@expo/material-symbols/comments_disabled.xml';
import addComment from '@expo/material-symbols/add_comment.xml';
import deselect from '@expo/material-symbols/deselect.xml';
import checkCircle from '@expo/material-symbols/check_circle.xml';
import compareArrows from '@expo/material-symbols/compare_arrows.xml';
import code from '@expo/material-symbols/code.xml';
import article from '@expo/material-symbols/article.xml';
import moreVert from '@expo/material-symbols/more_vert.xml';
import leftPanelOpen from '@expo/material-symbols/left_panel_open.xml';
import leftPanelClose from '@expo/material-symbols/left_panel_close.xml';
import formatListBulleted from '@expo/material-symbols/format_list_bulleted.xml';
import chevronLeft from '@expo/material-symbols/chevron_left.xml';
import chevronRight from '@expo/material-symbols/chevron_right.xml';
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
  timeline: history,
  comments: forum,
  hideComments: commentsDisabled,
  comment: addComment,
  clearSelection: deselect,
  markReviewed: checkCircle,
  unmarkReviewed: taskAlt,
  comparison: compareArrows,
  showSource: code,
  showRendered: article,
  files: formatListBulleted,
  more: moreVert,
  showList: leftPanelOpen,
  hideList: leftPanelClose,
  previous: chevronLeft,
  next: chevronRight,
} satisfies Record<HeaderIconName, ImageSourcePropType>;

export function headerIcon(name: HeaderIconName) {
  return symbols[name];
}
