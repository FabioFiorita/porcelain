import type { FileStatus } from '@/lib/daemon/procedures/changes'

/**
 * The SF Symbols a file row may wear. Declared as literals rather than imported from
 * `sf-symbols-typescript` so this module stays free of `@expo/ui`'s dependency graph and can be
 * unit tested; the literals still have to be real symbol names for `Image` to accept them.
 */
export type StatusSymbol =
  | 'plus.circle'
  | 'pencil.circle'
  | 'minus.circle'
  | 'arrow.triangle.turn.up.right.circle'
  | 'questionmark.circle'

const SYMBOLS: Record<FileStatus, StatusSymbol> = {
  added: 'plus.circle',
  deleted: 'minus.circle',
  modified: 'pencil.circle',
  renamed: 'arrow.triangle.turn.up.right.circle',
  untracked: 'questionmark.circle',
}

/** `diffReading` files carry `status` optionally, so an unknown status still gets a glyph. */
export function statusSymbol(status: FileStatus | undefined): StatusSymbol {
  return status === undefined ? 'questionmark.circle' : SYMBOLS[status]
}
