import { describe, expect, it } from 'vitest'
import { evidenceHtmlEmptyMessage, formatEvidenceMb } from './evidence-message'

describe('formatEvidenceMb', () => {
  it('formats bytes as MB with one decimal', () => {
    expect(formatEvidenceMb(4_194_304)).toBe('4.0 MB')
    expect(formatEvidenceMb(3_700_000)).toBe('3.5 MB')
  })
})

describe('evidenceHtmlEmptyMessage', () => {
  it('is Loading while the query is unresolved', () => {
    expect(evidenceHtmlEmptyMessage(undefined)).toBe('Loading…')
  })

  it('is cleared when the store returned null', () => {
    expect(evidenceHtmlEmptyMessage(null)).toBe('Evidence was cleared.')
  })

  it('explains over-cap with sizes (never "cleared")', () => {
    const msg = evidenceHtmlEmptyMessage({
      title: 'Big',
      updatedAt: '',
      checks: [],
      medium: 'html',
      htmlUnavailable: { reason: 'too-large', bytes: 5_000_000, maxBytes: 4_194_304 },
    })
    expect(msg).toContain('Evidence too large')
    expect(msg).toContain('4.8 MB')
    expect(msg).toContain('4.0 MB')
    expect(msg).not.toContain('cleared')
  })

  it('returns null when html is ready', () => {
    expect(
      evidenceHtmlEmptyMessage({
        title: 'Ok',
        updatedAt: '',
        checks: [],
        medium: 'html',
        html: '<p>hi</p>',
      }),
    ).toBeNull()
  })

  it('is empty-body when pack exists without html or reason', () => {
    expect(
      evidenceHtmlEmptyMessage({
        title: 'Ok',
        updatedAt: '',
        checks: [],
        medium: 'html',
      }),
    ).toBe('No evidence body.')
  })
})
