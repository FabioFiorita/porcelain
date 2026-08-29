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

const decision = JSON.stringify({
  version: 2,
  template: 'decision',
  title: 'Choose the Canvas contract',
  summary: 'Move authored decisions to semantic data.',
  context: 'Version 1 remains a compatibility surface.',
  references: [{ path: 'packages/contracts/src/projects/structured-canvas.contract.ts', line: 1 }],
  options: [
    {
      id: 'semantic',
      name: 'Semantic contract',
      summary: 'Porcelain renders meaning.',
      pros: ['Responsive by default'],
      cons: ['Requires a new version'],
      risks: [{ summary: 'Client drift', severity: 'medium', mitigation: 'Shared contracts' }],
      effort: 'Medium',
    },
    { id: 'html', name: 'Raw HTML', summary: 'Authors render the whole view.' },
    { id: 'markdown', name: 'Markdown', summary: 'Authors provide prose only.' },
  ],
  criteria: [
    { id: 'responsive', label: 'Responsive', description: 'Works at narrow and wide widths.' },
  ],
  assessments: [
    {
      optionId: 'semantic',
      criterionId: 'responsive',
      rating: 'strong',
      note: 'The client owns layout.',
    },
    {
      optionId: 'html',
      criterionId: 'responsive',
      rating: 'fair',
      note: 'Depends on authored CSS.',
    },
  ],
  recommendation: {
    optionId: 'semantic',
    summary: 'Use a semantic version 2 document.',
    rationale: ['It preserves product presentation ownership.'],
    confidence: 'high',
    assumptions: ['Clients consume shared contracts.'],
    changeConditions: ['Semantic primitives prove insufficient.'],
  },
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

  it('renders and switches bounded semantic Decision views', () => {
    render(<StructuredCanvasView content={decision} assetBaseUrl={null} repoPath="/repo" />)
    expect(screen.getByRole('heading', { name: 'Choose the Canvas contract' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Summary',
      'Semantic contract',
      'Raw HTML',
      'Markdown',
      'Compare',
      'Recommendation',
    ])

    fireEvent.click(screen.getByRole('tab', { name: 'Semantic contract' }))
    expect(screen.getByRole('heading', { name: 'Pros' })).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Compare' }))
    expect(screen.getByRole('heading', { name: 'Responsive' })).toBeInTheDocument()
    expect(screen.getByTestId('decision-comparison-responsive')).toHaveClass(
      'md:grid-cols-2',
      'xl:grid-cols-3',
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Recommendation' }))
    expect(
      screen.getByRole('heading', { name: 'Use a semantic version 2 document.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('high confidence')).toBeInTheDocument()
  })
})
