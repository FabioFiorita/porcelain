import { describe, expect, it } from 'vitest'
import { classifyMarkdownImageSrc } from './markdown-image-src'

describe('classifyMarkdownImageSrc', () => {
  it('classifies data URIs', () => {
    expect(classifyMarkdownImageSrc('data:image/png;base64,AAAA')).toEqual({
      kind: 'data',
      src: 'data:image/png;base64,AAAA',
    })
  })

  it('classifies absolute, home, and file:// paths as local', () => {
    expect(classifyMarkdownImageSrc('/tmp/shot.png')).toEqual({
      kind: 'local',
      path: '/tmp/shot.png',
    })
    expect(classifyMarkdownImageSrc('~/.porcelain/x.png')).toEqual({
      kind: 'local',
      path: '~/.porcelain/x.png',
    })
    expect(classifyMarkdownImageSrc('file:///tmp/a.png')).toEqual({
      kind: 'local',
      path: 'file:///tmp/a.png',
    })
  })

  it('rejects remote and relative srcs (CSP / ambiguous base)', () => {
    expect(classifyMarkdownImageSrc('https://cdn.example/a.png')).toEqual({
      kind: 'unsupported',
      raw: 'https://cdn.example/a.png',
    })
    expect(classifyMarkdownImageSrc('shots/a.png')).toEqual({
      kind: 'unsupported',
      raw: 'shots/a.png',
    })
  })

  it('handles empty / missing', () => {
    expect(classifyMarkdownImageSrc(null)).toEqual({ kind: 'unsupported', raw: '' })
    expect(classifyMarkdownImageSrc('   ')).toEqual({ kind: 'unsupported', raw: '' })
  })
})
