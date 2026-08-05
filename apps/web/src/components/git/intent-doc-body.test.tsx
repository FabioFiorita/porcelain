import type { IntentDoc } from '@backend/review/intent-docs'
import { TestIds } from '@shared/test-ids'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IntentDocBody } from './intent-doc-body'

const markdown = (body: string): IntentDoc => ({
  file: 'index.md',
  label: 'Index',
  medium: 'markdown',
  body,
})

describe('IntentDocBody', () => {
  it('renders markdown as escaped prose, never as live HTML', () => {
    render(<IntentDocBody doc={markdown('# Heading\n\n<script>alert(1)</script>')} />)
    expect(screen.getByText('Heading')).toBeTruthy()
    // react-markdown without rehype-raw: the tag is text, and no script element exists.
    expect(document.querySelector('script')).toBeNull()
  })

  it('routes html through the fully sandboxed iframe, never a src url', () => {
    render(
      <IntentDocBody doc={{ file: 'a.html', label: 'A', medium: 'html', body: '<p>hi</p>' }} />,
    )
    const frame = screen.getByTestId(TestIds.evidenceIframe)
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame.getAttribute('src')).toBeNull()
    expect(frame.getAttribute('srcdoc')).toContain('<p>hi</p>')
  })

  it('takes an already-parsed scene — the renderer never parses one itself', () => {
    // parseExcalidrawScene is Buffer-based; calling it here threw "Buffer is not
    // defined" and blanked the Review. The daemon parses and drops bad scenes.
    render(
      <IntentDocBody
        doc={{ file: 'd.excalidraw', label: 'D', medium: 'excalidraw', scene: { elements: [] } }}
      />,
    )
    expect(screen.getByTestId(TestIds.intentDocBody)).toBeTruthy()
  })
})
