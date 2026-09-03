import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StructuredCanvasView } from './structured-canvas-view'

const decision = JSON.stringify({
  version: 2,
  template: 'decision',
  title: 'Choose the Canvas contract',
  summary: 'Move authored decisions to semantic data.',
  context: 'One semantic contract is the authoring surface.',
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
  it('rejects old structured documents instead of falling back to the old renderer', () => {
    render(<StructuredCanvasView content='{"version":1,"tabs":[]}' assetBaseUrl={null} />)
    expect(screen.getByTestId(TestIds.structuredCanvasInvalid)).toHaveTextContent('template')
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

  it('renders the semantic Review template without accepting version 1', () => {
    render(
      <StructuredCanvasView
        content={JSON.stringify({
          version: 2,
          template: 'review',
          title: 'Review Decision Canvas',
          why: '# Why\nThe explanation belongs to Canvas.',
          how: '# How\nThe renderer owns presentation.',
        })}
        assetBaseUrl={null}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Why' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'How' }))
    expect(screen.getByRole('heading', { name: 'How' })).toBeInTheDocument()
  })

  it('renders ordered Review sections, inert visuals, code references, and real attachments', () => {
    render(
      <StructuredCanvasView
        content={JSON.stringify({
          version: 2,
          template: 'review',
          title: 'Rich review',
          summary: 'Review the contract before the proof.',
          sections: [
            {
              title: 'Contract',
              prose: 'The **shared contract** is canonical.',
              svg: '<svg><text>Flow</text></svg>',
              references: [{ path: 'src/review.ts', startLine: 7, endLine: 12 }],
            },
          ],
          evidence: {
            title: 'Proof',
            checks: [{ label: 'Focused tests', status: 'pass', detail: '12 passed' }],
            assets: [
              {
                kind: 'image',
                path: 'evidence/browser result.png',
                label: 'Browser result',
              },
            ],
          },
        })}
        assetBaseUrl="http://daemon/canvas/token/assets"
        repoPath="/repo"
      />,
    )

    expect(screen.getByRole('tab', { name: 'Contract' })).toBeInTheDocument()
    expect(screen.getByText('Review the contract before the proof.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /src\/review.ts:7-12/ })).toBeInTheDocument()
    const frame = screen.getByTitle('Contract diagram')
    expect(frame).toHaveAttribute('sandbox', '')

    fireEvent.click(screen.getByRole('tab', { name: 'Evidence' }))
    expect(screen.getByRole('heading', { name: 'Proof' })).toBeInTheDocument()
    expect(screen.getByText('12 passed')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Browser result' })).toHaveAttribute(
      'src',
      'http://daemon/canvas/token/assets/evidence/browser%20result.png',
    )
  })
})
