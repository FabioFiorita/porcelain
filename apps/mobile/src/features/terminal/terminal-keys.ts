/** Pure key translations shared in origin with the desktop terminal key helpers. */

export function controlByte(key: string): string | null {
  if (key.length !== 1) return null
  if (key === '?') return '\x7f'
  if (key === ' ') return '\x00'
  const code = key.toUpperCase().charCodeAt(0)
  if (code < 0x40 || code > 0x5f) return null
  return String.fromCharCode(code - 0x40)
}

export type ArrowDirection = 'up' | 'down' | 'left' | 'right'

const ARROW_FINAL: Record<ArrowDirection, string> = {
  down: 'B',
  left: 'D',
  right: 'C',
  up: 'A',
}

export function terminalArrowBytes(
  direction: ArrowDirection,
  applicationCursorKeys: boolean,
): string {
  return `\x1b${applicationCursorKeys ? 'O' : '['}${ARROW_FINAL[direction]}`
}

export interface EditChord {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

const MULTILINE_NEWLINE = '\x1b\r'

/** The desktop terminal's line-editing chord table, kept pure for the native key bar. */
export function terminalEditBytes({
  altKey,
  ctrlKey,
  key,
  metaKey,
  shiftKey,
}: EditChord): string | null {
  if (metaKey && !ctrlKey && !altKey && !shiftKey) {
    if (key === 'Backspace') return '\x15'
    if (key === 'ArrowLeft') return '\x01'
    if (key === 'ArrowRight') return '\x05'
    if (key === 'Enter') return MULTILINE_NEWLINE
  }
  if (altKey && !ctrlKey && !metaKey && !shiftKey) {
    if (key === 'Backspace') return '\x1b\x7f'
    if (key === 'ArrowLeft') return '\x1bb'
    if (key === 'ArrowRight') return '\x1bf'
  }
  if (shiftKey && !metaKey && !ctrlKey && !altKey && key === 'Enter') {
    return MULTILINE_NEWLINE
  }
  return null
}
