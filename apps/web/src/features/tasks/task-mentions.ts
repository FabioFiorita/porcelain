export type BodyMention = {
  readonly kind: 'file' | 'tag'
  readonly query: string
  readonly start: number
  readonly end: number
}

/** The @file or #tag token the caret is sitting in, if any. */
export function mentionAtCursor(text: string, cursor: number): BodyMention | null {
  const before = text.slice(0, Math.max(0, cursor))
  const file = /(?:^|[\s])@([^\s]*)$/.exec(before)
  if (file !== null && file.index !== undefined) {
    const at = before.lastIndexOf('@')
    return { kind: 'file', query: file[1] ?? '', start: at, end: cursor }
  }
  const tag = /(?:^|[\s])#([^\s]*)$/.exec(before)
  if (tag !== null && tag.index !== undefined) {
    const hash = before.lastIndexOf('#')
    return { kind: 'tag', query: tag[1] ?? '', start: hash, end: cursor }
  }
  return null
}

export function replaceMention(
  text: string,
  mention: BodyMention,
  inserted: string,
): { text: string; cursor: number } {
  const next = `${text.slice(0, mention.start)}${inserted}${text.slice(mention.end)}`
  return { text: next, cursor: mention.start + inserted.length }
}

const HASH_TAG = /(^|[\s])#([^\s#]+)/g
const AT_PATH = /(^|[\s])@([^\s@]+)/g
const URL_TOKEN = /https?:\/\/[^\s<>)'"]+/gi

export type LiftedLink = { readonly url: string; readonly label: string }

/** Hash tags already written in the body, order preserved, blanks dropped. */
export function extractHashTags(...texts: readonly string[]): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const text of texts) {
    HASH_TAG.lastIndex = 0
    for (const match of text.matchAll(HASH_TAG)) {
      const tag = match[2]?.trim() ?? ''
      if (tag === '' || seen.has(tag)) continue
      seen.add(tag)
      tags.push(tag)
    }
  }
  return tags
}

function linkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host === '' ? url : host
  } catch {
    return url
  }
}

export function extractLinks(...texts: readonly string[]): LiftedLink[] {
  const seen = new Set<string>()
  const links: LiftedLink[] = []
  for (const text of texts) {
    URL_TOKEN.lastIndex = 0
    for (const match of text.matchAll(URL_TOKEN)) {
      const url = match[0].replace(/[.,;:]+$/, '')
      if (seen.has(url)) continue
      seen.add(url)
      links.push({ url, label: linkLabel(url) })
    }
  }
  return links
}

export type LiftedTokens = {
  readonly notes: string
  readonly cursor: number
  readonly tags: string[]
  readonly paths: string[]
  readonly links: LiftedLink[]
}

function overlapsCursor(start: number, end: number, cursor: number): boolean {
  return cursor > start && cursor <= end
}

/**
 * Pull finished @paths, #tags, and http(s) URLs out of the body, leaving the
 * token the caret is still typing. Completed tokens become chips.
 */
export function liftCompletedTokens(notes: string, cursor: number): LiftedTokens {
  type Span = { start: number; end: number; kind: 'tag' | 'path' | 'link'; value: string }
  const spans: Span[] = []
  for (const pattern of [
    { re: HASH_TAG, kind: 'tag' as const },
    { re: AT_PATH, kind: 'path' as const },
  ]) {
    pattern.re.lastIndex = 0
    for (const match of notes.matchAll(pattern.re)) {
      const prefix = match[1] ?? ''
      const value = match[2] ?? ''
      const start = match.index + prefix.length
      const end = start + 1 + value.length
      if (value === '' || overlapsCursor(start, end, cursor)) continue
      spans.push({ start, end, kind: pattern.kind, value })
    }
  }
  URL_TOKEN.lastIndex = 0
  for (const urlMatch of notes.matchAll(URL_TOKEN)) {
    const raw = urlMatch[0]
    const url = raw.replace(/[.,;:]+$/, '')
    const start = urlMatch.index
    const end = start + raw.length
    if (overlapsCursor(start, end, cursor)) continue
    spans.push({ start, end, kind: 'link', value: url })
  }

  spans.sort((left, right) => left.start - right.start)
  const kept: Span[] = []
  let lastEnd = 0
  for (const span of spans) {
    if (span.start < lastEnd) continue
    kept.push(span)
    lastEnd = span.end
  }

  const tags: string[] = []
  const paths: string[] = []
  const links: LiftedLink[] = []
  const seenTag = new Set<string>()
  const seenPath = new Set<string>()
  const seenLink = new Set<string>()
  let next = notes
  let nextCursor = cursor
  for (const span of [...kept].reverse()) {
    if (span.kind === 'tag' && !seenTag.has(span.value)) {
      seenTag.add(span.value)
      tags.unshift(span.value)
    }
    if (span.kind === 'path' && !seenPath.has(span.value)) {
      seenPath.add(span.value)
      paths.unshift(span.value)
    }
    if (span.kind === 'link' && !seenLink.has(span.value)) {
      seenLink.add(span.value)
      links.unshift({ url: span.value, label: linkLabel(span.value) })
    }
    next = `${next.slice(0, span.start)}${next.slice(span.end)}`
    if (span.end <= nextCursor) nextCursor -= span.end - span.start
    else if (span.start < nextCursor) nextCursor = span.start
  }
  return {
    notes: next.replace(/[ \t]{2,}/g, ' ').replace(/ +\n/g, '\n'),
    cursor: nextCursor,
    tags,
    paths,
    links,
  }
}
