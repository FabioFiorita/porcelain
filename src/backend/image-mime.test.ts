import { describe, expect, it } from 'vitest'
import { imageMimeForPath, isBinaryBuffer, isGitBinaryDiff } from './image-mime'

describe('imageMimeForPath', () => {
  it('maps common extensions case-insensitively', () => {
    expect(imageMimeForPath('/repo/shot.PNG')).toBe('image/png')
    expect(imageMimeForPath('a/b/c.webp')).toBe('image/webp')
    expect(imageMimeForPath('photo.JPEG')).toBe('image/jpeg')
  })

  it('returns null for non-images and extensionless names', () => {
    expect(imageMimeForPath('src/app.ts')).toBeNull()
    expect(imageMimeForPath('Makefile')).toBeNull()
    expect(imageMimeForPath('.gitignore')).toBeNull()
  })

  it('uses only the final extension (uuid-style names still work)', () => {
    expect(imageMimeForPath('/tmp/cmux-drop-f09fa7f7-9ed9-4256-ac93-fb68f6b5491f.png')).toBe(
      'image/png',
    )
  })
})

describe('isBinaryBuffer', () => {
  it('flags a real PNG (NUL in IHDR)', () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    expect(isBinaryBuffer(png)).toBe(true)
  })

  it('does not flag plain text', () => {
    expect(isBinaryBuffer(Buffer.from('const x = 1\n'))).toBe(false)
  })
})

describe('isGitBinaryDiff', () => {
  it('detects the Binary files marker', () => {
    expect(
      isGitBinaryDiff('diff --git a/a.png b/a.png\nBinary files a/a.png and b/a.png differ\n'),
    ).toBe(true)
  })

  it('leaves a normal text diff alone', () => {
    expect(
      isGitBinaryDiff('diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-a\n+b\n'),
    ).toBe(false)
  })
})
