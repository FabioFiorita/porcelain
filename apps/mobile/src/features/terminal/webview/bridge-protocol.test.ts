import { describe, expect, it } from 'vitest'

import { isSafeExternalUrl, javascriptString, parseBridgeMessage } from './bridge-protocol'

describe('terminal WebView bridge', () => {
  it('parses only the narrow native message protocol', () => {
    expect(parseBridgeMessage(JSON.stringify({ t: 'resize', cols: 80, rows: 24 }))).toEqual({
      cols: 80,
      rows: 24,
      t: 'resize',
    })
    expect(parseBridgeMessage(JSON.stringify({ t: 'resize', cols: '80', rows: 24 }))).toBeNull()
  })

  it('allows only external HTTP links and escapes JavaScript line separators', () => {
    expect(isSafeExternalUrl('https://example.com/docs')).toBe(true)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false)
    expect(javascriptString('a\u2028b\u2029c')).toBe('"a\\u2028b\\u2029c"')
  })
})
