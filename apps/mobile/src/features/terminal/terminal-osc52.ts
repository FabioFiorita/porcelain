import type { Terminal } from '@xterm/headless'

/**
 * OSC 52 — how a program inside the PTY copies to the CLIENT's clipboard.
 *
 * Agents, vim and tmux (`set-clipboard on`) copy by emitting `OSC 52` rather than touching a
 * clipboard they cannot see. xterm does not handle the sequence itself, so without this a copy
 * on a remote machine lands nowhere while Claude Code still prints "sent N chars via OSC 52" —
 * the failure is silent and looks like the app's fault.
 *
 * **Write-only, deliberately.** A read request (`OSC 52 ; c ; ?`) asks the client to REPORT the
 * system clipboard back into the PTY, which is an exfiltration path: anything the human copied
 * — a token, a password — would be handed to whatever is running in the shell. The desktop
 * client omits it for the same reason.
 *
 * The base64 decode is written out rather than reached for: Hermes has no `atob` and no
 * `TextDecoder`, so the browser pair the web client uses does not exist on this runtime.
 */

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Decode base64 to bytes. Null for anything that is not well-formed base64. */
function base64Bytes(input: string): Uint8Array | null {
  const cleaned = input.replace(/\s/g, '').replace(/=+$/, '')
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const char of cleaned) {
    const index = BASE64_ALPHABET.indexOf(char)
    if (index < 0) return null
    value = (value << 6) | index
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >> bits) & 0xff)
    }
  }
  return Uint8Array.from(bytes)
}

/**
 * Decode UTF-8 bytes to a string. Hand-rolled for the same reason as the base64 above; a
 * malformed sequence yields the replacement character rather than throwing, because a
 * half-copied buffer is still worth pasting.
 */
function utf8Text(bytes: Uint8Array): string {
  let out = ''
  let index = 0
  while (index < bytes.length) {
    const byte = bytes[index] ?? 0
    let codePoint = byte
    let extra = 0
    if (byte >= 0xf0) {
      codePoint = byte & 0x07
      extra = 3
    } else if (byte >= 0xe0) {
      codePoint = byte & 0x0f
      extra = 2
    } else if (byte >= 0xc0) {
      codePoint = byte & 0x1f
      extra = 1
    } else if (byte >= 0x80) {
      // A continuation byte with nothing to continue.
      out += '�'
      index += 1
      continue
    }
    if (index + extra >= bytes.length) return `${out}�`
    for (let step = 1; step <= extra; step += 1) {
      const next = bytes[index + step] ?? 0
      if ((next & 0xc0) !== 0x80) return `${out}�`
      codePoint = (codePoint << 6) | (next & 0x3f)
    }
    out += String.fromCodePoint(codePoint)
    index += extra + 1
  }
  return out
}

/** Decode an OSC 52 payload (base64 of UTF-8). Empty, a query, or invalid → null. */
export function decodeOsc52Payload(payload: string): string | null {
  if (payload === '' || payload === '?') return null
  const bytes = base64Bytes(payload)
  if (bytes === null || bytes.length === 0) return null
  return utf8Text(bytes)
}

/**
 * The text an OSC 52 body (`Pc;Pd`, everything after the `52;`) asks to put on the clipboard,
 * or null for the forms we deliberately ignore: a read request, a clear, and the PRIMARY
 * selection, which has no counterpart on a phone.
 */
export function osc52WriteText(data: string): string | null {
  const separator = data.indexOf(';')
  if (separator < 0) return null
  const selection = data.slice(0, separator)
  // `c` is the system clipboard; empty means "both", which we honour as the clipboard.
  if (selection !== '' && selection !== 'c') return null
  return decodeOsc52Payload(data.slice(separator + 1))
}

/**
 * Register OSC 52 write handling on an emulator. `onCopy` is what actually reaches the
 * pasteboard, so the engine keeps the decision about WHEN a copy is honest — a replayed
 * scrollback re-runs every sequence in it, and the copy an agent made an hour ago must not
 * take the clipboard again on reconnect.
 *
 * Disposal rides `term.dispose()`, which tears its parser handlers down with it.
 */
export function attachOsc52Clipboard(term: Terminal, onCopy: (text: string) => void): void {
  term.parser.registerOscHandler(52, (data) => {
    const text = osc52WriteText(data)
    if (text !== null) onCopy(text)
    // Handled either way: an unhandled OSC falls through to xterm's default, which would print
    // the sequence as text.
    return true
  })
}
