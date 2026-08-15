/**
 * Best-effort "where is it listening?" detection from a development server's own output.
 *
 * This is a convenience, never a source of truth: a wrong URL is worse than no URL, so the
 * match is deliberately narrow — an http(s) URL with an explicit host, printed by the process
 * itself. Anything ambiguous is left undetected and the human reads the terminal.
 */

const URL_PATTERN = /https?:\/\/[^\s"'`<>()[\]{},\\]+/g

/**
 * Replace every control byte with a space. This is how ANSI colouring is defused without a
 * regex full of escape characters: a coloured `ESC[36mhttp://…ESC[0m` becomes ` [36mhttp://… [0m`,
 * and since the URL scan starts at `http` and stops at whitespace, both the prefix and the
 * reset fall outside the match. Written as a scan rather than a pattern because a regex
 * containing control characters is lint-blocked here, and rightly so.
 */
export function stripControlBytes(text: string): string {
  let out = ''
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0
    out += code < 0x20 || code === 0x7f ? ' ' : character
  }
  return out
}

/**
 * The first usable http(s) URL in a chunk of terminal output, or null.
 *
 * Trailing punctuation a human sentence adds (`.`, `,`, `;`, `:`) is trimmed, because
 * "Serving at http://127.0.0.1:8000." is the common shape. A URL whose host is a wildcard
 * bind (`0.0.0.0`, `[::]`) is rewritten to loopback: that is what the human can actually open.
 *
 * An explicit port is REQUIRED, and that is not pedantry. The shell echoes the command before
 * it runs, so the first output a server produces is its own command line — and a command that
 * mentions a URL (`console.log("http://127.0.0.1:" + port)`) would otherwise be detected as
 * the answer, with the port truncated at the quote. A development server states its port; a
 * fragment of source code does not.
 */
export function detectServerUrl(text: string): string | null {
  for (const raw of stripControlBytes(text).matchAll(URL_PATTERN)) {
    const trimmed = raw[0].replace(/[.,;:!?]+$/, '')
    let url: URL
    try {
      url = new URL(trimmed)
    } catch {
      continue
    }
    if (url.hostname === '' || url.port === '') continue
    if (url.hostname === '0.0.0.0' || url.hostname === '::' || url.hostname === '[::]') {
      url.hostname = '127.0.0.1'
    }
    return url.toString()
  }
  return null
}
