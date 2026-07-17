import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HtmlView, isHtmlPath } from './html-view'

describe('isHtmlPath', () => {
  it('matches html and htm extensions', () => {
    expect(isHtmlPath('/repo/docs/index.html')).toBe(true)
    expect(isHtmlPath('/repo/page.HTM')).toBe(true)
    expect(isHtmlPath('/repo/readme.md')).toBe(false)
    expect(isHtmlPath('/repo/app.tsx')).toBe(false)
  })
})

describe('HtmlView', () => {
  it('renders a fully sandboxed iframe with srcdoc', () => {
    render(<HtmlView html="<h1>Hello</h1>" title="Test page" />)
    const iframe = screen.getByTitle('Test page')
    expect(iframe.tagName).toBe('IFRAME')
    expect(iframe.getAttribute('sandbox')).toBe('')
    expect(iframe.getAttribute('srcdoc')).toContain('<h1>Hello</h1>')
  })
})
