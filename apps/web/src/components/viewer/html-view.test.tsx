import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HtmlDocumentFrame, HtmlView, isHtmlPath } from './html-view'

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
    expect(iframe.getAttribute('scrolling')).toBe('yes')
    expect(iframe.className).toContain('overflow-y-auto')
    expect(iframe.getAttribute('srcdoc')).toContain('<h1>Hello</h1>')
    expect(iframe.getAttribute('srcdoc')).toContain('name="viewport"')
  })
})

describe('HtmlDocumentFrame', () => {
  it('loads the daemon URL in a script-enabled frame that is NOT same-origin', () => {
    render(<HtmlDocumentFrame src="http://127.0.0.1:43118/file-preview/tok" title="review.html" />)
    const iframe = screen.getByTitle('review.html')
    expect(iframe.tagName).toBe('IFRAME')
    // src, never srcdoc: a srcdoc document inherits the app CSP and its inline
    // scripts are refused no matter what the sandbox says.
    expect(iframe.getAttribute('src')).toBe('http://127.0.0.1:43118/file-preview/tok')
    expect(iframe.getAttribute('srcdoc')).toBeNull()
    const sandbox = iframe.getAttribute('sandbox') ?? ''
    expect(sandbox.split(' ')).toContain('allow-scripts')
    expect(sandbox).not.toContain('allow-same-origin')
    // A document with no background of its own must not show the dark app through it.
    expect(iframe.className).toContain('bg-white')
  })
})
