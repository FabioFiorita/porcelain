import type { FeatureReading } from '@backend/feature-view'
import type { EvidenceCheck } from '@shared/evidence-check'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  buildRowFocus,
  buildRows,
  EvidenceChecksRow,
  EvidenceHeaderRow,
  rowIndexForTarget,
  svgAspectRatio,
  svgDocument,
} from './reading-surface'

// EvidenceHeaderRow's only hook is useClearEvidence (the Clear button) — stub it so
// the header renders standalone without a tRPC/query provider.
vi.mock('@renderer/hooks/use-evidence', () => ({
  useClearEvidence: () => ({ clear: async () => {}, isClearing: false }),
}))

const reading: FeatureReading = {
  name: 'Feature',
  sections: [],
  evidence: null,
  groups: [
    {
      layer: 'Pages',
      files: [
        {
          path: 'app/page.tsx',
          source: 'changed',
          additions: 2,
          deletions: 1,
          hunks: [
            {
              header: '@@ -1 +1 @@',
              lines: [
                { kind: 'context', oldLine: 1, newLine: 1, text: 'a' },
                { kind: 'add', oldLine: null, newLine: 2, text: 'b' },
              ],
            },
          ],
        },
      ],
    },
    {
      layer: 'Services',
      files: [
        {
          path: 'server/svc.ts',
          source: 'shipped',
          note: 'owns the labels',
          ranges: [{ startLine: 10, lines: ['export const X = 1'], gapBefore: 9 }],
          truncated: true,
        },
      ],
    },
  ],
}

describe('buildRows', () => {
  // null highlighter → plain-text fallback, so no Shiki is needed in the test
  it('flattens the reading into fixed-height rows in flow order', () => {
    expect(buildRows(reading, null).map((r) => r.type)).toEqual([
      'layer', // Pages
      'file', // app/page.tsx (changed)
      'hunkHeader',
      'diff', // context line
      'diff', // added line
      'layer', // Services
      'file', // server/svc.ts (shipped)
      'note', // owns the labels
      'gap', // 9 elided lines before the slice
      'code', // export const X = 1
      'truncated', // capped marker
    ])
  })

  it('anchors a slice row to its original 1-based line number', () => {
    const code = buildRows(reading, null).find((r) => r.type === 'code')
    expect(code).toMatchObject({ type: 'code', lineNo: 10, text: 'export const X = 1' })
  })
})

// The full Review document: thesis, a walkthrough section (prose + diagram +
// anchored code), the unanchored files under the synthetic "More files" chapter,
// and the loop-evidence final chapter.
const document: FeatureReading = {
  name: 'The Review',
  thesis: 'One paragraph of intent.',
  sections: [
    {
      title: 'Entry point',
      prose: 'Where the flow starts.',
      diagram: '<svg><title>flow</title></svg>',
      files: [
        {
          path: 'app/page.tsx',
          source: 'changed',
          hunks: [
            {
              header: '@@ -1 +1 @@',
              lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'x' }],
            },
          ],
        },
      ],
    },
  ],
  groups: [
    {
      layer: 'Services',
      files: [{ path: 'server/svc.ts', source: 'shipped', ranges: [] }],
    },
  ],
  evidence: {
    title: 'Loop closed',
    updatedAt: '2026-07-18T00:00:00.000Z',
    checks: [],
    medium: 'html',
  },
}

describe('buildRows (Review document)', () => {
  it('lays out thesis, sections, More files, and the evidence chapter in order', () => {
    expect(buildRows(document, null).map((r) => r.type)).toEqual([
      'thesis',
      'sectionHeader', // Entry point
      'prose',
      'diagram',
      'file', // app/page.tsx (anchored)
      'hunkHeader',
      'diff',
      'sectionHeader', // synthetic More files chapter
      'layer', // Services
      'file', // server/svc.ts
      'evidenceHeader',
      'evidenceBody',
    ])
  })

  it('omits the evidence chapter when includeEvidence is false (Overview canvas)', () => {
    expect(
      buildRows(document, null, undefined, { includeEvidence: false }).map((r) => r.type),
    ).toEqual([
      'thesis',
      'sectionHeader',
      'prose',
      'diagram',
      'file',
      'hunkHeader',
      'diff',
      'sectionHeader',
      'layer',
      'file',
    ])
  })

  it('indexes the synthetic More files header after the last section', () => {
    const headers = buildRows(document, null).filter((r) => r.type === 'sectionHeader')
    expect(headers).toEqual([
      { type: 'sectionHeader', index: 0, title: 'Entry point' },
      { type: 'sectionHeader', index: 1, title: 'More files' },
    ])
  })

  it('emits no More files header when there are no sections (pure-diff review)', () => {
    const rows = buildRows(reading, null)
    expect(rows.some((r) => r.type === 'sectionHeader')).toBe(false)
  })

  it('emits an embed row after the diagram and before the file rows for a section with html', () => {
    const withEmbed: FeatureReading = {
      name: 'Embedded',
      sections: [
        {
          title: 'Summary',
          prose: 'the numbers',
          diagram: '<svg />',
          html: '<table><tr><td>ok</td></tr></table>',
          htmlHeight: 320,
          files: [{ path: 'app/page.tsx', source: 'changed', hunks: [] }],
        },
      ],
      groups: [],
      evidence: null,
    }
    const rows = buildRows(withEmbed, null)
    expect(rows.map((r) => r.type)).toEqual(['sectionHeader', 'prose', 'diagram', 'embed', 'file'])
    expect(rows.find((r) => r.type === 'embed')).toEqual({
      type: 'embed',
      html: '<table><tr><td>ok</td></tr></table>',
      height: 320,
    })
  })

  it('skips empty prose and absent diagram/thesis/evidence', () => {
    const bare: FeatureReading = {
      name: 'Bare',
      sections: [{ title: 'Only title', prose: '  ', files: [] }],
      groups: [],
      evidence: null,
    }
    expect(buildRows(bare, null).map((r) => r.type)).toEqual(['sectionHeader'])
  })
})

describe('buildRows (evidence checks)', () => {
  const checks: EvidenceCheck[] = [
    { label: 'pnpm test', status: 'pass', detail: '1348 passed' },
    { label: 'pnpm build', status: 'fail', detail: 'tsc error' },
  ]
  const withChecks = (list: EvidenceCheck[]): FeatureReading => ({
    name: 'X',
    sections: [],
    groups: [],
    evidence: {
      title: 'Loop closed',
      updatedAt: '2026-07-18T00:00:00.000Z',
      checks: list,
      medium: 'html',
    },
  })

  it('inserts an evidenceChecks row (carrying the checks) between header and body', () => {
    const rows = buildRows(withChecks(checks), null)
    expect(rows.map((r) => r.type)).toEqual(['evidenceHeader', 'evidenceChecks', 'evidenceBody'])
    const checksRow = rows.find((r) => r.type === 'evidenceChecks')
    expect(checksRow).toEqual({ type: 'evidenceChecks', checks })
    const header = rows.find((r) => r.type === 'evidenceHeader')
    expect(header).toMatchObject({ type: 'evidenceHeader', title: 'Loop closed', checks })
  })

  it('emits no evidenceChecks row when there are no checks', () => {
    const rows = buildRows(withChecks([]), null)
    expect(rows.map((r) => r.type)).toEqual(['evidenceHeader', 'evidenceBody'])
  })

  it('tags the evidenceChecks row to the evidence chapter', () => {
    const focus = buildRowFocus(buildRows(withChecks(checks), null))
    expect(focus.every((meta) => meta.section === 'evidence')).toBe(true)
  })
})

describe('EvidenceChecksRow', () => {
  it('renders one row per check with its status icon, label, and detail', () => {
    const { container } = render(
      <EvidenceChecksRow
        checks={[
          { label: 'pnpm test', status: 'pass', detail: '1348 passed' },
          { label: 'pnpm build', status: 'fail', detail: 'tsc error' },
          { label: 'e2e', status: 'skip' },
        ]}
      />,
    )
    expect(screen.getByText('pnpm test')).toBeInTheDocument()
    expect(screen.getByText('1348 passed')).toBeInTheDocument()
    expect(screen.getByText('e2e')).toBeInTheDocument()
    expect(container.querySelector('.lucide-circle-check')).not.toBeNull()
    expect(container.querySelector('.lucide-circle-x')).not.toBeNull()
    expect(container.querySelector('.lucide-circle-minus')).not.toBeNull()
  })
})

describe('EvidenceHeaderRow', () => {
  it('shows a Fail badge when any check fails', () => {
    render(
      <EvidenceHeaderRow
        title="Loop"
        checks={[
          { label: 'a', status: 'pass' },
          { label: 'b', status: 'fail' },
        ]}
      />,
    )
    expect(screen.getByText('Fail')).toBeInTheDocument()
    expect(screen.queryByText('Pass')).not.toBeInTheDocument()
  })

  it('shows a Pass badge when all checks pass', () => {
    render(<EvidenceHeaderRow title="Loop" checks={[{ label: 'a', status: 'pass' }]} />)
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('shows no badge with no signal (skip-only or empty)', () => {
    render(<EvidenceHeaderRow title="Loop" checks={[{ label: 'a', status: 'skip' }]} />)
    expect(screen.queryByText('Pass')).not.toBeInTheDocument()
    expect(screen.queryByText('Fail')).not.toBeInTheDocument()
  })
})

describe('buildRowFocus', () => {
  const rows = buildRows(document, null)
  const focus = buildRowFocus(rows)

  it('tags each row with its chapter and file', () => {
    expect(focus[0]).toEqual({ section: null, path: null }) // thesis
    expect(focus[1]).toEqual({ section: 0, path: null }) // Entry point header
    expect(focus[4]).toEqual({ section: 0, path: 'app/page.tsx' }) // anchored file
    expect(focus[6]).toEqual({ section: 0, path: 'app/page.tsx' }) // its diff line
    expect(focus[7]).toEqual({ section: 1, path: null }) // More files header
    expect(focus[9]).toEqual({ section: 1, path: 'server/svc.ts' }) // grouped file
    expect(focus.at(-1)).toEqual({ section: 'evidence', path: null })
  })

  it('leaves the chapter null in a section-less document', () => {
    const flat = buildRowFocus(buildRows(reading, null))
    expect(flat.every((meta) => meta.section === null)).toBe(true)
  })
})

describe('rowIndexForTarget', () => {
  const rows = buildRows(document, null)

  it('resolves top, section, and evidence targets to row indexes', () => {
    expect(rowIndexForTarget(rows, { kind: 'top' })).toBe(0)
    expect(rowIndexForTarget(rows, { kind: 'section', index: 1 })).toBe(7)
    expect(rowIndexForTarget(rows, { kind: 'evidence' })).toBe(10)
  })

  it('returns null for a target that does not exist', () => {
    expect(rowIndexForTarget(rows, { kind: 'section', index: 9 })).toBeNull()
    expect(rowIndexForTarget([], { kind: 'top' })).toBeNull()
  })
})

describe('svgDocument', () => {
  it('wraps the SVG in a minimal srcdoc document', () => {
    const doc = svgDocument('<svg><title>d</title></svg>')
    expect(doc).toContain('<!doctype html>')
    expect(doc).toContain('<svg><title>d</title></svg>')
  })
})

describe('svgAspectRatio', () => {
  it('reads the viewBox width/height ratio', () => {
    expect(svgAspectRatio('<svg viewBox="0 0 720 120"><rect /></svg>')).toBeCloseTo(6)
  })

  it('prefers explicit width/height attributes', () => {
    expect(svgAspectRatio('<svg width="200" height="100" viewBox="0 0 720 120" />')).toBeCloseTo(2)
  })

  it('handles px units and comma-separated viewBox', () => {
    expect(svgAspectRatio('<svg width="300px" height="150px" />')).toBeCloseTo(2)
    expect(svgAspectRatio('<svg viewBox="0,0,400,100" />')).toBeCloseTo(4)
  })

  it('returns null for percentage or missing dimensions', () => {
    expect(svgAspectRatio('<svg width="100%" height="100%" />')).toBeNull()
    expect(svgAspectRatio('<svg><title>d</title></svg>')).toBeNull()
    expect(svgAspectRatio('not an svg')).toBeNull()
  })
})
