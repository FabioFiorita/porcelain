import { realpathSync } from 'node:fs'
import { type TimelineItem, TOOL_OUTPUT_CAP } from '../../shared/agent-protocol'

/**
 * Shared helpers for importing a coding-agent CLI's on-disk sessions into Porcelain
 * Agent threads. Each driver owns its own list/import (formats differ wildly); this
 * module is the common path/text/item utilities so the four importers stay short.
 */

/** Cap imported timelines so a multi-day terminal session can't blow the 16MB thread file. */
export const IMPORT_ITEM_CAP = 200

export function normalizeRepoPath(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    // Missing path (tests, remote daemon path not local) — still match on the string form.
    return path.replace(/\/+$/, '') || path
  }
}

/** True when `candidate` is the same directory as `repoPath` (after realpath when possible). */
export function pathsEqual(repoPath: string, candidate: string): boolean {
  if (candidate === '' || repoPath === '') return false
  return normalizeRepoPath(repoPath) === normalizeRepoPath(candidate)
}

/** Claude's project dir slug: `/Users/foo/bar` → `-Users-foo-bar`. */
export function claudeProjectSlug(repoPath: string): string {
  const normalized = normalizeRepoPath(repoPath)
  return normalized.replace(/\//g, '-')
}

/** Grok's session dir slug: encodeURIComponent of the absolute path. */
export function grokSessionDirName(repoPath: string): string {
  return encodeURIComponent(normalizeRepoPath(repoPath))
}

/** Pull plain text out of Anthropic/OpenAI-style content blocks or a bare string. */
export function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const b = block as Record<string, unknown>
    // text / input_text / output_text / summary_text all carry a string `text` field.
    if (typeof b.text === 'string') parts.push(b.text)
  }
  return parts.join('')
}

export function truncateOutput(text: string): string {
  if (text.length <= TOOL_OUTPUT_CAP) return text
  return `${text.slice(0, TOOL_OUTPUT_CAP)}\n…(truncated)`
}

/** First non-empty line, capped — for list-row previews and derived titles. */
export function previewText(text: string, max = 80): string {
  const line = text.replace(/\s+/g, ' ').trim()
  if (line === '') return ''
  return line.length <= max ? line : `${line.slice(0, max - 1)}…`
}

/**
 * Drop leading items when over cap, preferring to keep the tail (recent conversation).
 * Never drops a trailing partial pair awkwardly — just slice from the end.
 */
export function capItems(items: TimelineItem[]): TimelineItem[] {
  if (items.length <= IMPORT_ITEM_CAP) return items
  return items.slice(items.length - IMPORT_ITEM_CAP)
}

/** Stable resume key extracted from a driver's opaque sessionState (for idempotent import). */
export function resumeKey(sessionState: unknown): string | null {
  if (typeof sessionState === 'string' && sessionState !== '') return sessionState
  if (sessionState && typeof sessionState === 'object' && 'sessionId' in sessionState) {
    const id = (sessionState as { sessionId: unknown }).sessionId
    if (typeof id === 'string' && id !== '') return id
  }
  return null
}

export function userItem(id: string, text: string): TimelineItem {
  return { kind: 'user', id, text }
}

export function assistantItem(id: string, text: string): TimelineItem {
  return { kind: 'assistant', id, text, streaming: false }
}

export function reasoningItem(id: string, text: string): TimelineItem {
  return { kind: 'reasoning', id, text, streaming: false }
}

export function toolItem(
  id: string,
  title: string,
  status: 'running' | 'ok' | 'error',
  detail?: string,
  output?: string,
): TimelineItem {
  return {
    kind: 'tool',
    id,
    title,
    status,
    ...(detail !== undefined && detail !== '' ? { detail } : {}),
    ...(output !== undefined && output !== '' ? { output: truncateOutput(output) } : {}),
  }
}
