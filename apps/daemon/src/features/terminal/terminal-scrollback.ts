/**
 * The bounded replay buffer behind every PTY session. Extracted from the session manager so
 * the manager stays about lifetime and this stays about bytes — and so the byte arithmetic
 * (UTF-8 boundaries, not code units) is testable on its own.
 */

/**
 * Keep the last `cap` BYTES of a string without splitting a multi-byte character. Cutting at
 * an arbitrary byte offset would hand xterm half a code point and paint a replacement glyph
 * into replayed scrollback, so the cut walks forward off any continuation byte.
 */
export function trimUtf8Tail(value: string, cap: number): string {
  const bytes = Buffer.from(value)
  if (bytes.byteLength <= cap) return value
  let start = bytes.byteLength - cap
  while (start < bytes.byteLength) {
    const byte = bytes[start]
    if (byte === undefined || (byte & 0xc0) !== 0x80) break
    start += 1
  }
  return bytes.subarray(start).toString('utf8')
}

export class ScrollbackBuffer {
  private readonly chunks: string[] = []
  private bytes = 0

  constructor(private readonly cap: number) {}

  append(chunk: string): void {
    this.chunks.push(chunk)
    this.bytes += Buffer.byteLength(chunk)
    while (this.bytes > this.cap && this.chunks.length > 1) {
      const dropped = this.chunks.shift()
      if (dropped !== undefined) this.bytes -= Buffer.byteLength(dropped)
    }
    if (this.bytes > this.cap && this.chunks.length === 1) {
      const [only] = this.chunks
      if (only !== undefined) {
        this.chunks[0] = trimUtf8Tail(only, this.cap)
        this.bytes = Buffer.byteLength(this.chunks[0])
      }
    }
  }

  snapshot(): string {
    return this.chunks.join('')
  }
}
