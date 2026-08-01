/**
 * Which rows a syntax highlighter should colour next. Tokenizing a whole change is wasted work
 * on a phone: the canvas reports the range it is drawing, and only that range plus an overscan
 * band is ever handed to the tokenizer, each row exactly once.
 */

/** Rows above and below the viewport, so a flick lands on already-coloured text. */
const OVERSCAN_ROWS = 80
/** One tokenizer pass per callback stays well inside a frame at this batch size. */
const BATCH_ROWS = 200

export type TokenWindowInput = {
  rows: readonly { id: string }[]
  visible: { firstIndex: number; lastIndex: number }
  /** Rows that can carry syntax at all — headers and notices never can. */
  tokenizable: { has: (rowId: string) => boolean }
  /** Rows already patched into the canvas. */
  tokenized: { has: (rowId: string) => boolean }
  overscan?: number
  batch?: number
}

export function pendingTokenRowIds({
  batch = BATCH_ROWS,
  overscan = OVERSCAN_ROWS,
  rows,
  tokenizable,
  tokenized,
  visible,
}: TokenWindowInput): string[] {
  const first = Math.max(0, Math.min(visible.firstIndex, visible.lastIndex) - overscan)
  const last = Math.min(rows.length - 1, Math.max(visible.firstIndex, visible.lastIndex) + overscan)

  const pending: string[] = []
  for (let index = first; index <= last; index += 1) {
    const id = rows[index]?.id
    if (id === undefined || tokenized.has(id) || !tokenizable.has(id)) continue
    pending.push(id)
    if (pending.length >= batch) break
  }
  return pending
}
