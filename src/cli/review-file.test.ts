import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addReviewFiles,
  clearReview,
  describeReview,
  mergeReviewFiles,
  readReview,
  setReview,
  toReviewFiles,
  toReviewSections,
} from './review-file'

describe('toReviewFiles', () => {
  it('accepts valid rows and keeps source + note', () => {
    expect(
      toReviewFiles([{ path: 'a.ts' }, { path: 'b.ts', source: 'shipped', note: 'check this' }]),
    ).toEqual([{ path: 'a.ts' }, { path: 'b.ts', source: 'shipped', note: 'check this' }])
  })

  it('keeps an agent-declared flow layer', () => {
    expect(toReviewFiles([{ path: 'a.ts', layer: 'Store' }])).toEqual([
      { path: 'a.ts', layer: 'Store' },
    ])
  })

  it('throws on a non-array', () => {
    expect(() => toReviewFiles('nope')).toThrow('files must be an array')
  })

  it('throws on a missing path', () => {
    expect(() => toReviewFiles([{ note: 'x' }])).toThrow('path must be a non-empty string')
  })

  it('throws on an invalid source', () => {
    expect(() => toReviewFiles([{ path: 'a.ts', source: 'whoops' }])).toThrow(
      'source must be one of',
    )
  })
})

describe('toReviewSections', () => {
  it('accepts valid sections and keeps prose, diagram, and anchors', () => {
    expect(
      toReviewSections([
        {
          title: 'Entry',
          prose: 'starts here',
          diagram: '<svg />',
          anchors: [{ path: 'a.ts', startLine: 1, endLine: 9 }],
        },
        { title: 'Data', prose: '' },
      ]),
    ).toEqual([
      {
        title: 'Entry',
        prose: 'starts here',
        diagram: '<svg />',
        anchors: [{ path: 'a.ts', startLine: 1, endLine: 9 }],
      },
      { title: 'Data', prose: '', anchors: [] },
    ])
  })

  it('throws on a non-array', () => {
    expect(() => toReviewSections('nope')).toThrow('sections must be an array')
  })

  it('throws with the section index on a missing title or prose', () => {
    expect(() => toReviewSections([{ prose: 'x' }])).toThrow(
      'sections[0].title must be a non-empty string',
    )
    expect(() => toReviewSections([{ title: 'A', prose: 'x' }, { title: 'B' }])).toThrow(
      'sections[1].prose must be a string',
    )
  })

  it('throws on oversized prose and too many sections (mirroring the app caps)', () => {
    expect(() => toReviewSections([{ title: 'A', prose: 'x'.repeat(32_769) }])).toThrow(
      'sections[0].prose must be at most 32768 characters',
    )
    const many = Array.from({ length: 31 }, (_, i) => ({ title: `S${i}`, prose: '' }))
    expect(() => toReviewSections(many)).toThrow('at most 30 entries')
  })

  it('throws with the anchor index on a bad anchor', () => {
    expect(() => toReviewSections([{ title: 'A', prose: '', anchors: [{}] }])).toThrow(
      'sections[0].anchors[0].path must be a non-empty string',
    )
    expect(() =>
      toReviewSections([{ title: 'A', prose: '', anchors: [{ path: 'a.ts', startLine: 0 }] }]),
    ).toThrow('sections[0].anchors[0].startLine must be a positive integer')
  })
})

describe('mergeReviewFiles', () => {
  it('replaces a file with the same path and appends new ones', () => {
    const merged = mergeReviewFiles(
      [{ path: 'a.ts', note: 'old' }, { path: 'b.ts' }],
      [{ path: 'a.ts', note: 'new' }, { path: 'c.ts' }],
    )
    expect(merged).toEqual([{ path: 'a.ts', note: 'new' }, { path: 'b.ts' }, { path: 'c.ts' }])
  })
})

describe('file round-trip', () => {
  const dir = join(tmpdir(), 'porcelain-mcp-test')
  const file = join(dir, 'review-sets.json')

  beforeEach(() => {
    process.env.PORCELAIN_REVIEW_SETS = file
    rmSync(dir, { recursive: true, force: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_REVIEW_SETS
    rmSync(dir, { recursive: true, force: true })
  })

  const read = (): Record<string, { name: string; files: unknown[] }> =>
    JSON.parse(readFileSync(file, 'utf8'))

  it('setReview writes a repo-keyed set', () => {
    setReview('/repo', {
      name: 'Call-outs',
      files: [{ path: 'a.ts', source: 'shipped' }],
      sections: [],
    })
    expect(read()['/repo']).toEqual({
      name: 'Call-outs',
      files: [{ path: 'a.ts', source: 'shipped' }],
      sections: [],
    })
  })

  it('addReviewFiles merges into the existing set and returns the total', () => {
    setReview('/repo', { name: 'Call-outs', files: [{ path: 'a.ts' }], sections: [] })
    const total = addReviewFiles('/repo', [{ path: 'b.ts' }])
    expect(total).toBe(2)
    expect(read()['/repo']?.files).toEqual([{ path: 'a.ts' }, { path: 'b.ts' }])
  })

  it('addReviewFiles creates a set when none exists', () => {
    const total = addReviewFiles('/repo', [{ path: 'a.ts' }])
    expect(total).toBe(1)
    expect(read()['/repo']?.name).toBe('Feature view')
  })

  it('addReviewFiles keeps the existing thesis and sections (files-only merge)', () => {
    setReview('/repo', {
      name: 'Call-outs',
      thesis: 'The why.',
      files: [{ path: 'a.ts' }],
      sections: [{ title: 'Entry', prose: 'starts here', anchors: [{ path: 'a.ts' }] }],
    })
    addReviewFiles('/repo', [{ path: 'b.ts' }])
    const stored = readReview('/repo')
    expect(stored?.thesis).toBe('The why.')
    expect(stored?.sections).toHaveLength(1)
    expect(stored?.files.map((f) => f.path)).toEqual(['a.ts', 'b.ts'])
  })

  it('clearReview removes only the target repo', () => {
    setReview('/repo', { name: 'x', files: [{ path: 'a.ts' }], sections: [] })
    setReview('/other', { name: 'y', files: [{ path: 'b.ts' }], sections: [] })
    clearReview('/repo')
    const all = read()
    expect(all['/repo']).toBeUndefined()
    expect(all['/other']).toBeDefined()
    expect(existsSync(file)).toBe(true)
  })

  it('readReview returns the stored set, or null when none exists', () => {
    expect(readReview('/repo')).toBeNull()
    setReview('/repo', {
      name: 'Call-outs',
      files: [{ path: 'a.ts', source: 'shipped', note: 'check' }],
      sections: [],
    })
    expect(readReview('/repo')).toEqual({
      name: 'Call-outs',
      files: [{ path: 'a.ts', source: 'shipped', note: 'check' }],
      sections: [],
    })
  })

  it('round-trips thesis and sections through the file', () => {
    setReview('/repo', {
      name: 'Login flow',
      thesis: 'One round-trip instead of three.',
      files: [{ path: 'a.ts' }],
      sections: [
        {
          title: 'Entry',
          prose: 'starts **here**',
          diagram: '<svg />',
          anchors: [{ path: 'a.ts', startLine: 1, endLine: 9 }],
        },
      ],
    })
    expect(readReview('/repo')).toEqual({
      name: 'Login flow',
      thesis: 'One round-trip instead of three.',
      files: [{ path: 'a.ts' }],
      sections: [
        {
          title: 'Entry',
          prose: 'starts **here**',
          diagram: '<svg />',
          anchors: [{ path: 'a.ts', startLine: 1, endLine: 9 }],
        },
      ],
    })
  })
})

describe('describeReview', () => {
  it('explains the empty state when there is no set', () => {
    expect(describeReview('/repo', null)).toContain('No feature review set for /repo')
    expect(describeReview('/repo', { name: 'x', files: [], sections: [] })).toContain(
      'No feature review set',
    )
  })

  it('summarizes the set with a per-source breakdown and round-trips as one JSON object', () => {
    const text = describeReview('/repo', {
      name: 'Call-outs',
      thesis: 'The why.',
      files: [{ path: 'a.ts' }, { path: 'b.ts', source: 'shipped', note: 'match the service' }],
      sections: [{ title: 'Entry', prose: 'starts here', anchors: [{ path: 'a.ts' }] }],
    })
    expect(text).toContain('Feature review "Call-outs" for /repo: 2 file(s)')
    expect(text).toContain('1 auto-detected')
    expect(text).toContain('1 shipped')
    expect(text).toContain('1 section(s)')
    expect(text).toContain('thesis set')
    // files + sections + thesis round-trip as JSON so an agent can read → modify → set
    expect(JSON.parse(text.slice(text.indexOf('{')))).toEqual({
      thesis: 'The why.',
      files: [{ path: 'a.ts' }, { path: 'b.ts', source: 'shipped', note: 'match the service' }],
      sections: [{ title: 'Entry', prose: 'starts here', anchors: [{ path: 'a.ts' }] }],
    })
  })

  it('describes a sections-only set (no files) without an empty breakdown', () => {
    const text = describeReview('/repo', {
      name: 'Docs pass',
      files: [],
      sections: [{ title: 'Only prose', prose: 'nothing anchored', anchors: [] }],
    })
    expect(text).toContain('0 file(s), 1 section(s), thesis not set')
    expect(text).not.toContain('()')
  })
})
