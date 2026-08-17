interface HunkHeaderParts {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  context: string | null
}

/** Parse a unified-diff hunk header (`@@ -l,s +l,s @@ optional context`). */
function parseHunkHeader(header: string): HunkHeaderParts | null {
  const match = header.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@\s*(.*)$/)
  if (!match) return null
  return {
    oldStart: Number(match[1]),
    oldCount: match[2] === undefined ? 1 : Number(match[2]),
    newStart: Number(match[3]),
    newCount: match[4] === undefined ? 1 : Number(match[4]),
    context: match[5]?.trim() || null,
  }
}

function lineSpan(start: number, count: number): string {
  if (count <= 1) return `Line ${start}`
  return `Lines ${start}–${start + count - 1}`
}

/**
 * Human label for a hunk header. `@@ -1 +1 @@` becomes "Line 1"; a function
 * context, when git included one, leads the label.
 */
export function formatHunkHeader(header: string): string {
  const parts = parseHunkHeader(header)
  if (!parts) return header
  const same = parts.oldStart === parts.newStart && parts.oldCount === parts.newCount
  let span: string
  if (same) {
    span = lineSpan(parts.newStart, parts.newCount)
  } else if (parts.oldCount === 0) {
    span = `${lineSpan(parts.newStart, parts.newCount)} added`
  } else if (parts.newCount === 0) {
    span = `${lineSpan(parts.oldStart, parts.oldCount)} removed`
  } else {
    span = `${lineSpan(parts.oldStart, parts.oldCount)} → ${lineSpan(parts.newStart, parts.newCount).toLowerCase()}`
  }
  if (parts.context) return `${parts.context} · ${span.toLowerCase()}`
  return span
}
