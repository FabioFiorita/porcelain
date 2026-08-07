import type { ReviewDoc } from '@backend/review/doc-set'
import { TestIds } from '@shared/test-ids'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReviewDocBody } from './review-doc-body'

const markdown = (body: string): ReviewDoc => ({
  file: 'index.md',
  label: 'Index',
  medium: 'markdown',
  body,
})

describe('ReviewDocBody', () => {
  it('renders markdown as escaped prose, never as live HTML', () => {
    render(<ReviewDocBody doc={markdown('# Heading\n\n<script>alert(1)</script>')} />)
    expect(screen.getByText('Heading')).toBeTruthy()
    // react-markdown without rehype-raw: the tag is text, and no script element exists.
    expect(document.querySelector('script')).toBeNull()
  })

  it('routes html through the fully sandboxed iframe, never a src url', () => {
    render(
      <ReviewDocBody doc={{ file: 'a.html', label: 'A', medium: 'html', body: '<p>hi</p>' }} />,
    )
    const frame = screen.getByTestId(TestIds.evidenceIframe)
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame.getAttribute('src')).toBeNull()
    expect(frame.getAttribute('srcdoc')).toContain('<p>hi</p>')
  })
})
