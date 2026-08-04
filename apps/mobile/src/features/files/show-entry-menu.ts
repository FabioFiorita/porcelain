import { setStringAsync } from 'expo-clipboard'
import { ActionSheetIOS } from 'react-native'

import {
  type EntryMenuAction,
  type EntryMenuState,
  entryMenuAction,
  entryMenuOptions,
} from './entry-menu'
import type { FileEntryActions } from './use-files'

/** Presents the shared row menu. What each option means lives in `entry-menu.ts`. */
export function showEntryMenu(entry: EntryMenuState, actions: FileEntryActions): void {
  const options = entryMenuOptions(entry)

  ActionSheetIOS.showActionSheetWithOptions(
    { cancelButtonIndex: options.length - 1, options, title: entry.path },
    (index: number): void => {
      runEntryMenuAction(entryMenuAction(entry, index), actions)
    },
  )
}

function runEntryMenuAction(action: EntryMenuAction, actions: FileEntryActions): void {
  if (action === null) return
  if (action.kind === 'copy') {
    setStringAsync(action.path).catch(() => {
      // Clipboard access is best effort; the sheet still dismisses cleanly.
    })
    return
  }
  actions[action.kind](action.path)
}
