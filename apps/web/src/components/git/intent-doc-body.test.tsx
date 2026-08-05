import type { IntentDoc } from '@backend/review/intent-docs'
import { TestIds } from '@shared/test-ids'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IntentDocBody } from './intent-doc-body'

const doc = (over: Partial<IntentDoc>): IntentDoc => ({
  file: 'index.md',
  label: 'Index',
  medium: 'markdown',
  body: '# Why',
  ...over,
})

describe('IntentDocBody', () => {
  it('renders markdown as escaped prose, never as live HTML', () => {
    render(<IntentDocBody doc={doc({ body: '# Heading\n\n<script>alert(1)</script>' })} />)
    expect(screen.getByText('Heading')).toBeTruthy()
    // react-markdown without rehype-raw: the tag is text, and no script element exists.
    expect(document.querySelector('script')).toBeNull()
  })

  it('routes html through the fully sandboxed iframe, never a src url', () => {
    render(<IntentDocBody doc={doc({ file: 'a.html', medium: 'html', body: '<p>hi</p>' })} />)
    const frame = screen.getByTestId(TestIds.evidenceIframe)
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame.getAttribute('src')).toBeNull()
    expect(frame.getAttribute('srcdoc')).toContain('<p>hi</p>')
  })

  it('says so when a diagram cannot be read instead of throwing', () => {
    render(
      <IntentDocBody doc={doc({ file: 'd.excalidraw', medium: 'excalidraw', body: 'not json' })} />,
    )
    expect(screen.getByText(/could not be read/)).toBeTruthy()
  })
})
