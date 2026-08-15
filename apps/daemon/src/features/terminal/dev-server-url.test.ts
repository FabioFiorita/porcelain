// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { detectServerUrl, stripControlBytes } from './dev-server-url'

const ESC = String.fromCharCode(0x1b)

describe('development server URL detection', () => {
  it('finds the URL a Vite-shaped banner prints', () => {
    expect(detectServerUrl('  ➜  Local:   http://localhost:5173/\n')).toBe('http://localhost:5173/')
  })

  it('sees through ANSI colouring around the URL', () => {
    const coloured = `  ${ESC}[32m➜${ESC}[39m  Local: ${ESC}[36mhttp://127.0.0.1:4321/${ESC}[0m\n`
    expect(detectServerUrl(coloured)).toBe('http://127.0.0.1:4321/')
  })

  it('trims the sentence punctuation a Python http.server prints', () => {
    expect(detectServerUrl('Serving HTTP on http://0.0.0.0:8000/ ...')).toBe(
      'http://127.0.0.1:8000/',
    )
  })

  it('rewrites a wildcard bind to loopback because that is what opens', () => {
    expect(detectServerUrl('listening on http://0.0.0.0:3000')).toBe('http://127.0.0.1:3000/')
  })

  it('ignores the shell echoing a command that merely mentions a URL', () => {
    // The truncation at the quote is the point: without the explicit-port rule this parsed as
    // http://127.0.0.1/ and the roster proudly showed a link to nothing.
    expect(
      detectServerUrl('node -e \'console.log("http://127.0.0.1:" + this.address().port + "/")\'\n'),
    ).toBeNull()
  })

  it('ignores a URL with no port — a development server always states one', () => {
    expect(detectServerUrl('docs at https://example.com/guide\n')).toBeNull()
  })

  it('returns null for output with no URL, and for a non-http scheme', () => {
    expect(detectServerUrl('compiled 42 modules in 300ms')).toBeNull()
    expect(detectServerUrl('open ws://localhost:9229 to debug')).toBeNull()
  })

  it('takes the first URL when a banner prints several', () => {
    expect(detectServerUrl('Local: http://localhost:3000/  Network: http://10.0.0.4:3000/')).toBe(
      'http://localhost:3000/',
    )
  })

  it('replaces control bytes with spaces so a reset cannot join the URL', () => {
    expect(stripControlBytes(`a${ESC}b\nc`)).toBe('a b c')
  })
})
