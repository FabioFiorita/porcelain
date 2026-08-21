import type { MenuAction } from '@expo/ui/community/menu'

import { type ChromeIconName, sfSymbolFor } from '@/components/chrome-glyph'

/**
 * One item in a row's context menu.
 *
 * Deliberately the same shape as `SheetAction` in `panel-chrome`, minus the tone: the two are
 * the same idea reached two ways — a long press on a row — and a later pass that moves a row
 * from the action sheet to the native menu should be able to hand over the array it already
 * builds.
 */
export type RowMenuAction = {
  id: string
  label: string
  /** Drawn on iOS only — see `sfSymbolFor`. */
  glyph?: ChromeIconName
  /** Red label and, on iOS, the destructive role. */
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}

/** Our rows, as the menu's items. Pure so the mapping is testable without a native view. */
export function rowMenuActions(actions: readonly RowMenuAction[]): MenuAction[] {
  return actions.map((action) => ({
    attributes: { destructive: action.destructive === true, disabled: action.disabled === true },
    id: action.id,
    image: action.glyph === undefined ? undefined : sfSymbolFor(action.glyph),
    title: action.label,
  }))
}

/**
 * Run the action the menu reports, by id.
 *
 * The native menu hands back an identifier, not a closure — it lives in another process's UI —
 * so the dispatch is a lookup. An id the menu reports but the list no longer has is ignored
 * rather than thrown: the menu can outlive a re-render of the rows behind it.
 */
export function rowMenuPress(actions: readonly RowMenuAction[], id: string): void {
  actions.find((action) => action.id === id)?.onPress()
}
