import { describe, expect, it } from 'vitest'
import { isSafeExternalUrl } from './external-url'

describe('isSafeExternalUrl', () => {
  it('allows https URLs', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true)
  })

  it('allows http URLs with paths and queries', () => {
    expect(isSafeExternalUrl('http://example.com/path?q=1')).toBe(true)
  })

  it('allows mailto URLs', () => {
    expect(isSafeExternalUrl('mailto:a@b.com')).toBe(true)
  })

  it('rejects file URLs', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false)
  })

  it('rejects custom-scheme URLs', () => {
    expect(isSafeExternalUrl('ldap://host/x')).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(isSafeExternalUrl('not a url')).toBe(false)
    expect(isSafeExternalUrl('')).toBe(false)
  })
})
