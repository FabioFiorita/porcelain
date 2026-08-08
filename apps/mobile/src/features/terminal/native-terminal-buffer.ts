/**
 * The compact raw-stream bridge between the daemon WS and the native Ghostty canvas.
 *
 * It is deliberately independent of React Native and xterm so its bounded/replay semantics can
 * be proved in Node. The terminal protocol has already decoded websocket data to JavaScript
 * strings by the time it reaches here, hence the code-unit bound.
 */
export const MAX_NATIVE_BUFFER_CODE_UNITS = 1_000_000

export class NativeTerminalBuffer {
  private chunks: string[] = []
  private length = 0

  append(data: string): void {
    if (data === '') return
    this.chunks.push(data)
    this.length += data.length

    while (this.length > MAX_NATIVE_BUFFER_CODE_UNITS && this.chunks.length > 1) {
      const removed = this.chunks.shift()
      if (removed !== undefined) this.length -= removed.length
    }
    // A daemon frame may itself exceed the bound. Retain its tail rather than allowing this
    // uncommon case to retain an unbounded JS string.
    if (this.length > MAX_NATIVE_BUFFER_CODE_UNITS) {
      const only = this.chunks[0] ?? ''
      this.chunks = [only.slice(only.length - MAX_NATIVE_BUFFER_CODE_UNITS)]
      this.length = this.chunks[0].length
    }
  }

  replace(data: string): void {
    this.chunks = []
    this.length = 0
    this.append(data)
  }

  value(): string {
    return this.chunks.join('')
  }
}
