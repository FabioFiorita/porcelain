/**
 * A byte-capped append buffer for one PTY's output. A daemon-owned session survives
 * disconnect/reload (Phase 2), so its output has to be remembered to replay on
 * re-attach — but a long-running shell (a dev server, a chatty build) would grow that
 * memory without bound. So the buffer keeps only the newest `cap` bytes: chunks are
 * stored whole and the oldest are dropped once the running total exceeds the cap
 * (chunk-granularity trimming — a re-attach replaying a few bytes of a half-dropped
 * escape sequence is a cosmetic non-issue next to the simplicity). Pure: no PTY, no
 * socket, so it's unit-tested in isolation.
 */
export class ScrollbackBuffer {
  private readonly cap: number
  private readonly chunks: string[] = []
  private bytes = 0

  constructor(cap: number = 64 * 1024) {
    this.cap = cap
  }

  /** Append a chunk, then drop the oldest chunks until back under the cap. */
  append(chunk: string): void {
    this.chunks.push(chunk)
    this.bytes += Buffer.byteLength(chunk)
    while (this.bytes > this.cap && this.chunks.length > 1) {
      const dropped = this.chunks.shift()
      if (dropped !== undefined) this.bytes -= Buffer.byteLength(dropped)
    }
  }

  /** The retained output as one string — what a re-attaching client replays. */
  snapshot(): string {
    return this.chunks.join('')
  }
}
