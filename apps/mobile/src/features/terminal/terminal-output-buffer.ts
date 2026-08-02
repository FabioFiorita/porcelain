export const TERMINAL_OUTPUT_FLUSH_MS = 16
export const TERMINAL_OUTPUT_MAX_BYTES = 256 * 1024
const TRUNCATION_MARKER = '\r\n[porcelain: output truncated]\r\n'

type Timer = ReturnType<typeof setTimeout>

/** Coalesce PTY bursts before crossing the React Native ↔ WebView bridge. */
export class TerminalOutputBuffer {
  private pending: string[] = []
  private pendingLength = 0
  private timer: Timer | undefined
  private truncated = false

  public constructor(private readonly onFlush: (data: string) => void) {}

  public append(data: string): void {
    if (data === '') return
    this.pending.push(data)
    this.pendingLength += data.length
    this.trimToLimit()
    if (this.timer === undefined) {
      this.timer = setTimeout(() => {
        this.timer = undefined
        this.flush()
      }, TERMINAL_OUTPUT_FLUSH_MS)
    }
  }

  public flush(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    if (this.pendingLength === 0) return
    const data = `${this.truncated ? TRUNCATION_MARKER : ''}${this.pending.join('')}`
    this.pending = []
    this.pendingLength = 0
    this.truncated = false
    this.onFlush(data)
  }

  public dispose(): void {
    this.clear()
  }

  public clear(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    this.pending = []
    this.pendingLength = 0
    this.truncated = false
  }

  private trimToLimit(): void {
    let overflow = this.pendingLength - TERMINAL_OUTPUT_MAX_BYTES
    while (overflow > 0) {
      const head = this.pending[0]
      if (head === undefined) break
      if (head.length <= overflow) {
        this.pending.shift()
        this.pendingLength -= head.length
        overflow -= head.length
      } else {
        this.pending[0] = head.slice(overflow)
        this.pendingLength -= overflow
        overflow = 0
      }
      this.truncated = true
    }
  }
}
