import { describe, expect, it } from 'vitest'

import { isHtmlPath, isMarkdownPath } from './file-kind'

describe('isMarkdownPath', () => {
  it('matches markdown extensions case-insensitively', () => {
    expect(isMarkdownPath('README.md')).toBe(true)
    expect(isMarkdownPath('docs/Guide.MDX')).toBe(true)
    expect(isMarkdownPath('/repo/notes.markdown')).toBe(true)
    expect(isMarkdownPath('src/app.tsx')).toBe(false)
  })
})

describe('isHtmlPath', () => {
  it('matches html and htm extensions', () => {
    expect(isHtmlPath('index.html')).toBe(true)
    expect(isHtmlPath('page.HTM')).toBe(true)
    expect(isHtmlPath('readme.md')).toBe(false)
  })
})
