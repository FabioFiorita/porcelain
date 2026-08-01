import { beforeEach, describe, expect, it } from 'vitest'
import { fileLineRangeFromRange, lineRangeFromOffsets, lineRangeFromRange } from './line-selection'

// Mirror the rendered DOM: VirtualRows wraps each row in a div that has NO data-line;
// the row div inside carries data-line and holds the code text. This is the shape
// that broke the naive anchorNode/parentElement lookup.
function appendRow(line: number, text: string): { wrapper: HTMLElement; textNode: Text } {
  const wrapper = document.createElement('div') // VirtualRows wrapper — no data-line
  const row = document.createElement('div')
  row.setAttribute('data-line', String(line))
  const span = document.createElement('span')
  span.textContent = text
  row.appendChild(span)
  wrapper.appendChild(row)
  document.body.appendChild(wrapper)
  return { wrapper, textNode: span.firstChild as Text }
}

// The reading surface adds data-file so a selection maps to a range WITHIN one file.
function appendFileRow(file: string, line: number, text: string): { textNode: Text } {
  const wrapper = document.createElement('div')
  const row = document.createElement('div')
  row.setAttribute('data-line', String(line))
  row.setAttribute('data-file', file)
  const span = document.createElement('span')
  span.textContent = text
  row.appendChild(span)
  wrapper.appendChild(row)
  document.body.appendChild(wrapper)
  return { textNode: span.firstChild as Text }
}

describe('lineRangeFromRange', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('resolves a selection within one line to that single line', () => {
    const { textNode } = appendRow(3, 'const widget = () => null')
    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 5)
    expect(lineRangeFromRange(range)).toEqual({ startLine: 3, endLine: 3 })
  })

  it('resolves when an endpoint lands on the no-data-line wrapper (the triple-click bug)', () => {
    const { wrapper, textNode } = appendRow(3, 'const widget = () => null')
    const range = document.createRange()
    range.setStart(textNode, 0)
    // focus lands on the wrapper element, past its single row child — must still map to line 3
    range.setEnd(wrapper, 1)
    expect(lineRangeFromRange(range)).toEqual({ startLine: 3, endLine: 3 })
  })

  it('spans a multi-line selection from the first row to the last', () => {
    const first = appendRow(3, 'line three')
    const last = appendRow(7, 'line seven')
    const range = document.createRange()
    range.setStart(first.textNode, 0)
    range.setEnd(last.textNode, 4)
    expect(lineRangeFromRange(range)).toEqual({ startLine: 3, endLine: 7 })
  })

  it('returns null when neither endpoint is inside a line row', () => {
    const plain = document.createElement('div')
    plain.textContent = 'no data-line here'
    document.body.appendChild(plain)
    const range = document.createRange()
    range.setStart(plain.firstChild as Text, 0)
    range.setEnd(plain.firstChild as Text, 2)
    expect(lineRangeFromRange(range)).toBeNull()
  })
})

describe('fileLineRangeFromRange', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('clamps a same-file multi-line selection to that file', () => {
    const first = appendFileRow('a.ts', 3, 'line three')
    const last = appendFileRow('a.ts', 7, 'line seven')
    const range = document.createRange()
    range.setStart(first.textNode, 0)
    range.setEnd(last.textNode, 4)
    expect(fileLineRangeFromRange(range, 'a.ts')).toEqual({ startLine: 3, endLine: 7 })
  })

  it('returns null when the selection crosses into another file', () => {
    const a = appendFileRow('a.ts', 3, 'in a')
    const b = appendFileRow('b.ts', 5, 'in b')
    const range = document.createRange()
    range.setStart(a.textNode, 0)
    range.setEnd(b.textNode, 2)
    expect(fileLineRangeFromRange(range, 'a.ts')).toBeNull()
    expect(fileLineRangeFromRange(range, 'b.ts')).toBeNull()
  })

  it('returns null when the selection is in a different file than asked', () => {
    const b = appendFileRow('b.ts', 5, 'only b')
    const range = document.createRange()
    range.setStart(b.textNode, 0)
    range.setEnd(b.textNode, 4)
    expect(fileLineRangeFromRange(range, 'a.ts')).toBeNull()
    expect(fileLineRangeFromRange(range, 'b.ts')).toEqual({ startLine: 5, endLine: 5 })
  })
})

describe('lineRangeFromOffsets', () => {
  const text = 'line one\nline two\nline three\nline four'

  it('maps a single-line selection to that one line', () => {
    // "one" within the first line
    expect(lineRangeFromOffsets(text, 5, 8)).toEqual({ startLine: 1, endLine: 1 })
  })

  it('spans a multi-line selection from its first line to its last', () => {
    // from mid line two into line three
    expect(lineRangeFromOffsets(text, 12, 22)).toEqual({ startLine: 2, endLine: 3 })
  })

  it('does not over-count a selection that ends exactly on a newline boundary', () => {
    // select the whole of lines one and two, ending right at the '\n' after line two
    const end = text.indexOf('line three') // offset of the char just past line two's '\n'
    expect(lineRangeFromOffsets(text, 0, end)).toEqual({ startLine: 1, endLine: 2 })
  })

  it('returns null for a caret-only / empty selection', () => {
    expect(lineRangeFromOffsets(text, 4, 4)).toBeNull()
  })

  it('starts at line 1 for a selection anchored at offset 0', () => {
    expect(lineRangeFromOffsets(text, 0, 4)).toEqual({ startLine: 1, endLine: 1 })
  })
})
