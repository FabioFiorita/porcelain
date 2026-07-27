import type { Terminal } from '@xterm/xterm'
import { copyText } from './utils'

/**
 * OSC 52 is how remote TUI apps (Claude Code, vim, tmux with set-clipboard) push
 * text onto the *client* clipboard — without it, copy on a remote PTY silently
 * no-ops and Claude prints "sent N chars via OSC 52 · if paste fails…".
 *
 * xterm.js does not handle OSC 52 by default. We register write-only: remote →
 * host clipboard via `copyText` (works in Electron AND the insecure tailnet
 * browser client). Clipboard *read* requests (`OSC 52;c;?`) are ignored —
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
 * Register OSC 52 write handling on an xterm instance. Disposal rides
 * `term.dispose()` (parser handlers are cleaned with the terminal).
 */
export function attachOsc52Clipboard(term: Terminal): void {
  term.parser.registerOscHandler(52, (data) => {
    const text = osc52WriteText(data)
    if (text === null) return true
    // Fire-and-forget: the OSC handler can't usefully await UI clipboard prompts.
    // copyText itself is best-effort (execCommand fallback on insecure contexts).
    void copyText(text)
    return true
  })
}
