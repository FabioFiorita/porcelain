/**
 * OSC 52 is how remote TUI apps (Claude Code, vim, tmux with set-clipboard) push
 * text onto the *client* clipboard — without it, copy on a remote PTY silently
 * no-ops and Claude prints "sent N chars via OSC 52 · if paste fails…".
 *
 * The renderer filters OSC 52 before VT parsing and writes only remote → host
 * clipboard text (works in Electron AND the insecure tailnet browser client).
 * Clipboard *read* requests (`OSC 52;c;?`) are ignored —
 * reporting the system clipboard to a remote PTY is an exfil path we don't want.
 */

/** Decode OSC 52 payload (base64 of UTF-8). Empty / invalid → null. */
export function decodeOsc52Payload(b64: string): string | null {
  if (b64 === '' || b64 === '?') return null
  try {
    const cleaned = b64.replace(/\s/g, '')
    // atob is Latin-1; re-encode bytes then decode as UTF-8 so non-ASCII survives.
    const binary = atob(cleaned)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/**
 * Parse the OSC 52 body (`Pc;Pd` after the `52;`). Returns text to write, or null
 * for queries / clears we don't act on.
 */
export function osc52WriteText(data: string): string | null {
  // Format: selection;payload  — selection is c (clipboard), p (primary), or empty
  // (both). Payload `?` is a read request; empty payload clears.
  const sep = data.indexOf(';')
  if (sep < 0) return null
  const selection = data.slice(0, sep)
  const payload = data.slice(sep + 1)
  // Only system clipboard (and the empty "both" form) — ignore primary.
  if (selection !== '' && selection !== 'c') return null
  if (payload === '?' || payload === '') return null
  return decodeOsc52Payload(payload)
}

/**
 * Consume OSC 52 from a PTY byte stream before it reaches a renderer. Ghostty
 * deliberately owns VT parsing, so unlike Ghostty there is no parser hook to
 * install after the fact. Keeping the tiny policy filter here makes clipboard
 * writes renderer-neutral and, importantly, lets replay be explicitly silent.
 */
export class Osc52StreamFilter {
  private pending = ''

  process(data: string, onWrite?: (text: string) => void): string {
    let input = this.pending + data
    this.pending = ''
    let output = ''

    while (input.length > 0) {
      const start = input.indexOf('\u001b]52;')
      if (start < 0) {
        // Preserve an incomplete OSC introducer at the chunk boundary.
        const suffix = this.trailingIntroducer(input)
        output += input.slice(0, input.length - suffix.length)
        this.pending = suffix
        break
      }
      output += input.slice(0, start)
      const bodyStart = start + 5
      const bel = input.indexOf('\u0007', bodyStart)
      const st = input.indexOf('\u001b\\', bodyStart)
      const end = bel < 0 ? st : st < 0 ? bel : Math.min(bel, st)
      if (end < 0) {
        this.pending = input.slice(start)
        break
      }
      const text = osc52WriteText(input.slice(bodyStart, end))
      if (text !== null) onWrite?.(text)
      input = input.slice(end + (end === st ? 2 : 1))
    }
    return output
  }

  reset(): void {
    this.pending = ''
  }

  private trailingIntroducer(input: string): string {
    const introducer = '\u001b]52;'
    for (let length = Math.min(introducer.length - 1, input.length); length > 0; length -= 1) {
      if (input.endsWith(introducer.slice(0, length))) return input.slice(-length)
    }
    return ''
  }
}
