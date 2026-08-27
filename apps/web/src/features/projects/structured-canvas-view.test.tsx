import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StructuredCanvasView } from './structured-canvas-view'

const content = JSON.stringify({
  version: 1,
  title: 'Structured review',
  tabs: [
    { id: 'why', label: 'Why', blocks: [{ type: 'markdown', content: '# Reason' }] },
    { id: 'how', label: 'How', blocks: [{ type: 'html', content: '<p>Implementation</p>' }] },
  ],
  assets: [
    { type: 'image', path: 'assets/shot.png', alt: 'Result', caption: 'Runtime proof' },
    { type: 'video', path: 'assets/demo.mp4', label: 'Demo' },
  ],
})

describe('StructuredCanvasView', () => {
  it('renders supported tabs and a dedicated asset gallery', () => {
    render(<StructuredCanvasView content={content} assetBaseUrl="http://daemon/canvas/token" />)
    expect(screen.getByTestId(TestIds.structuredCanvas)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reason' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'How' }))
    expect(screen.getByTitle('How HTML block 1')).toHaveAttribute('sandbox', '')

    fireEvent.click(screen.getByRole('tab', { name: /assets/i }))
    expect(screen.getByAltText('Result')).toHaveAttribute(
      'src',
      'http://daemon/canvas/token/assets/assets%2Fshot.png',
    )
    expect(screen.getByLabelText('Demo')).toHaveAttribute(
      'src',
      'http://daemon/canvas/token/assets/assets%2Fdemo.mp4',
    )
  })

  it('shows actionable feedback instead of rendering malformed JSON', () => {
    render(<StructuredCanvasView content='{"version":1,"tabs":[]}' assetBaseUrl={null} />)
    expect(screen.getByTestId(TestIds.structuredCanvasInvalid)).toHaveTextContent('title')
    expect(screen.queryByTestId(TestIds.structuredCanvas)).toBeNull()
  })
})
