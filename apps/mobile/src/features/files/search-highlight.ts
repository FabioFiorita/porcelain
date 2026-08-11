import type { CodeSearchLine } from './search-data'

/** Where a literal query sits inside a result line, so the match can be picked out of it. */
export type MatchSpan = { start: number; end: number }

/**
 * Spans of `query` inside `text`.
 *
 * Empty for a regex query, deliberately: the daemon greps with POSIX `-E` and JavaScript's
 * engine does not agree with it span for span, so highlighting there would confidently point at
 * the wrong characters. The tinted match line carries the signal instead — the same trade the
 * desktop's Search rail makes.
 */
export function matchSpans(
  text: string,
  query: string,
  regex: boolean,
  caseSensitive: boolean,
): MatchSpan[] {
  const needle = caseSensitive ? query : query.toLowerCase()
  if (regex || needle === '') return []
  const haystack = caseSensitive ? text : text.toLowerCase()
  const spans: MatchSpan[] = []
  let at = haystack.indexOf(needle)
  while (at !== -1) {
    spans.push({ end: at + needle.length, start: at })
    at = haystack.indexOf(needle, at + needle.length)
  }
  return spans
}

/** Leading whitespace every line in a hunk shares, stripped so the block reads as one column. */
export function commonIndent(lines: readonly CodeSearchLine[]): number {
  let min = Number.POSITIVE_INFINITY
  for (const line of lines) {
    if (line.text.trim() === '') continue
    min = Math.min(min, line.text.length - line.text.trimStart().length)
  }
  return Number.isFinite(min) ? min : 0
}
