import { beforeEach, describe, expect, it } from 'vitest'
import { lineRangeFromRange } from './line-selection'

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
