import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { TimelineItem } from '../../../shared/agent-protocol'
import {
  assistantItem,
  capItems,
  claudeProjectSlug,
  pathsEqual,
  previewText,
  textFromContent,
  toolItem,
  truncateOutput,
  userItem,
} from '../session-import'
import type { ExternalSessionInfo, ImportSessionResult } from '../types'

/**
 * List + import Claude Code sessions for a repo. Transcripts are JSONL under
 * `~/.claude/projects/<slug>/<sessionId>.jsonl` where slug is the cwd with `/` → `-`.
 * Resume handle is `{ sessionId }` (matches claude.ts).
 */

function projectsRoot(home = homedir()): string {
  return join(home, '.claude', 'projects')
}

function projectDir(repoPath: string, home = homedir()): string {
  return join(projectsRoot(home), claudeProjectSlug(repoPath))
}

export async function listClaudeSessions(
  repoPath: string,
  limit = 30,
  home = homedir(),
): Promise<ExternalSessionInfo[]> {
  const dir = projectDir(repoPath, home)
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const out: ExternalSessionInfo[] = []
  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue
    const externalId = name.slice(0, -'.jsonl'.length)
    const path = join(dir, name)
    try {
      const info = await stat(path)
      // Cheap title: first user text from a prefix read (full file can be huge).
      const head = await readFile(path, { encoding: 'utf8' /* full — capped below */ }).catch(
        () => '',
      )
      // Only scan first 256KB for the title/preview so a 50MB session doesn't stall list.
      const snippet = head.slice(0, 256 * 1024)
      const { title, model, cwdOk } = scanClaudeHead(snippet, repoPath)
      if (!cwdOk) continue
      out.push({
        provider: 'claude',
        externalId,
        title,
        updatedAt: info.mtimeMs,
        ...(model ? { model } : {}),
      })
    } catch {
      // skip
    }
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt)
  return out.slice(0, limit)
}

export async function importClaudeSession(
  repoPath: string,
  externalId: string,
  home = homedir(),
): Promise<ImportSessionResult | null> {
  const path = join(projectDir(repoPath, home), `${externalId}.jsonl`)
  let body: string
  try {
    body = await readFile(path, 'utf8')
  } catch {
    return null
  }
  // Guard: confirm at least one line belongs to this cwd when cwd is present.
  const head = scanClaudeHead(body.slice(0, 256 * 1024), repoPath)
  if (!head.cwdOk) return null
  const items = capItems(mapClaudeTranscript(body))
  return {
    title: head.title,
    ...(head.model ? { model: head.model } : {}),
    sessionState: { sessionId: externalId },
    items,
  }
}

function scanClaudeHead(
  snippet: string,
  repoPath: string,
): { title: string; model?: string; cwdOk: boolean } {
  let title = 'Claude session'
  let model: string | undefined
  let sawCwd = false
  let cwdMatches = false
  for (const line of snippet.split('\n')) {
    if (line.trim() === '') continue
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    if (typeof obj.cwd === 'string') {
      sawCwd = true
      if (pathsEqual(repoPath, obj.cwd)) cwdMatches = true
    }
    if (obj.type === 'user' && title === 'Claude session') {
      const text = extractClaudeUserText(obj).trim()
      if (text !== '') title = previewText(text, 60) || title
    }
    if (obj.type === 'assistant' && model === undefined) {
      const message = obj.message as Record<string, unknown> | undefined
      if (typeof message?.model === 'string') model = message.model
    }
  }
  // Files with no cwd (rare) are allowed; files with a foreign cwd are rejected.
  const cwdOk = !sawCwd || cwdMatches
  return { title, model, cwdOk }
}

function extractClaudeUserText(obj: Record<string, unknown>): string {
  const message = obj.message as Record<string, unknown> | undefined
  if (!message) return textFromContent(obj.content)
  return textFromContent(message.content)
}

/** Pure: fold Claude Code JSONL into TimelineItems. */
export function mapClaudeTranscript(jsonl: string): TimelineItem[] {
  const items: TimelineItem[] = []
  const pendingTools = new Map<string, number>()
  let n = 0
  const nextId = (prefix: string): string => {
    n += 1
    return `import-claude-${prefix}-${n}`
  }

  for (const line of jsonl.split('\n')) {
    if (line.trim() === '') continue
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    const type = obj.type
    if (type === 'user') {
      // tool_result blocks often arrive as user messages with tool_result content.
      const message = obj.message as Record<string, unknown> | undefined
      const content = message?.content
      if (Array.isArray(content)) {
        let hadToolResult = false
        for (const block of content) {
          if (!block || typeof block !== 'object') continue
          const b = block as Record<string, unknown>
          if (b.type === 'tool_result') {
            hadToolResult = true
            const callId = typeof b.tool_use_id === 'string' ? b.tool_use_id : ''
            const output = textFromContent(b.content)
            const idx = pendingTools.get(callId)
            if (idx !== undefined) {
              const existing = items[idx]
              if (existing.kind === 'tool') {
                items[idx] = {
                  ...existing,
                  status: b.is_error === true ? 'error' : 'ok',
                  ...(output !== '' ? { output: truncateOutput(output) } : {}),
                }
              }
              pendingTools.delete(callId)
            }
          }
        }
        if (hadToolResult) continue
      }
      const text = extractClaudeUserText(obj).trim()
      if (text === '') continue
      items.push(userItem(nextId('user'), text))
      continue
    }

    if (type === 'assistant') {
      const message = obj.message as Record<string, unknown> | undefined
      const content = message?.content
      if (!Array.isArray(content)) {
        const text = textFromContent(content).trim()
        if (text !== '') items.push(assistantItem(nextId('asst'), text))
        continue
      }
      for (const block of content) {
        if (!block || typeof block !== 'object') continue
        const b = block as Record<string, unknown>
        if (b.type === 'text' && typeof b.text === 'string' && b.text.trim() !== '') {
          items.push(assistantItem(nextId('asst'), b.text.trim()))
        } else if (b.type === 'tool_use') {
          const id = typeof b.id === 'string' ? b.id : nextId('tool')
          const name = typeof b.name === 'string' ? b.name : 'tool'
          const input =
            b.input && typeof b.input === 'object' ? (b.input as Record<string, unknown>) : {}
          const first = Object.values(input).find((v) => typeof v === 'string')
          const detail = typeof first === 'string' ? previewText(first, 60) : undefined
          pendingTools.set(id, items.length)
          items.push(toolItem(id, name, 'running', detail))
        }
      }
    }
  }

  for (const idx of pendingTools.values()) {
    const existing = items[idx]
    if (existing.kind === 'tool' && existing.status === 'running') {
      items[idx] = { ...existing, status: 'ok' }
    }
  }
  return items
}
