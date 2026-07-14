import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { TimelineItem } from '../../../shared/agent-protocol'
import {
  assistantItem,
  capItems,
  pathsEqual,
  previewText,
  reasoningItem,
  textFromContent,
  toolItem,
  truncateOutput,
  userItem,
} from '../session-import'
import type { ExternalSessionInfo, ImportSessionResult } from '../types'

/**
 * List + import Codex CLI sessions for a repo. Rollouts live under
 * `~/.codex/sessions/YYYY/MM/DD/rollout-…-<sessionId>.jsonl`. Resume handle is the bare
 * session id string (matches codex.ts `onSessionState(threadId)`).
 */

function sessionsRoot(home = homedir()): string {
  return join(home, '.codex', 'sessions')
}

/** Walk year/month/day dirs; return rollout paths newest-first by mtime (best-effort). */
async function listRolloutFiles(home: string, maxFiles: number): Promise<string[]> {
  const root = sessionsRoot(home)
  const found: { path: string; mtime: number }[] = []
  let years: string[]
  try {
    years = await readdir(root)
  } catch {
    return []
  }
  // Newest years first (lexicographic works for YYYY).
  years.sort((a, b) => b.localeCompare(a))
  for (const year of years) {
    if (!/^\d{4}$/.test(year)) continue
    let months: string[]
    try {
      months = await readdir(join(root, year))
    } catch {
      continue
    }
    months.sort((a, b) => b.localeCompare(a))
    for (const month of months) {
      let days: string[]
      try {
        days = await readdir(join(root, year, month))
      } catch {
        continue
      }
      days.sort((a, b) => b.localeCompare(a))
      for (const day of days) {
        let files: string[]
        try {
          files = await readdir(join(root, year, month, day))
        } catch {
          continue
        }
        for (const file of files) {
          if (!file.startsWith('rollout-') || !file.endsWith('.jsonl')) continue
          const path = join(root, year, month, day, file)
          try {
            const info = await stat(path)
            found.push({ path, mtime: info.mtimeMs })
          } catch {
            // skip
          }
        }
        // Early stop once we have a big pool to filter by cwd.
        if (found.length >= maxFiles * 8) {
          found.sort((a, b) => b.mtime - a.mtime)
          return found.slice(0, maxFiles * 8).map((f) => f.path)
        }
      }
    }
  }
  found.sort((a, b) => b.mtime - a.mtime)
  return found.map((f) => f.path)
}

function sessionIdFromRolloutPath(path: string): string | null {
  // rollout-2026-07-11T18-28-33-019f5315-039f-73c2-bb4b-922808a4ebd7.jsonl
  const base = path.split('/').pop() ?? ''
  const m = base.match(
    /rollout-.*-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i,
  )
  if (m) return m[1]
  // Fallback: last UUID-like token
  const m2 = base.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  return m2 ? m2[1] : null
}

async function readSessionMeta(
  path: string,
): Promise<{ sessionId: string; cwd: string; model?: string; updatedAt: number } | null> {
  let head = ''
  try {
    // First line is almost always session_meta; read a small prefix.
    const fd = await readFile(path, 'utf8')
    head = fd.slice(0, 8 * 1024)
  } catch {
    return null
  }
  const firstLine = head.split('\n').find((l) => l.trim() !== '') ?? ''
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(firstLine) as Record<string, unknown>
  } catch {
    return null
  }
  if (obj.type !== 'session_meta') return null
  const payload = (obj.payload ?? {}) as Record<string, unknown>
  const sessionId =
    (typeof payload.session_id === 'string' && payload.session_id) ||
    (typeof payload.id === 'string' && payload.id) ||
    sessionIdFromRolloutPath(path)
  if (!sessionId) return null
  const cwd = typeof payload.cwd === 'string' ? payload.cwd : ''
  const model =
    typeof payload.model === 'string'
      ? payload.model
      : typeof (payload as { model_provider?: unknown }).model_provider === 'string'
        ? undefined
        : undefined
  let updatedAt = Date.parse(typeof obj.timestamp === 'string' ? obj.timestamp : '')
  if (!Number.isFinite(updatedAt)) {
    try {
      updatedAt = (await stat(path)).mtimeMs
    } catch {
      updatedAt = Date.now()
    }
  }
  return { sessionId, cwd, model, updatedAt }
}

export async function listCodexSessions(
  repoPath: string,
  limit = 30,
  home = homedir(),
): Promise<ExternalSessionInfo[]> {
  const files = await listRolloutFiles(home, limit)
  const out: ExternalSessionInfo[] = []
  for (const path of files) {
    const meta = await readSessionMeta(path)
    if (!meta || !pathsEqual(repoPath, meta.cwd)) continue
    // Title from first real user message in a prefix of the file.
    let title = 'Codex session'
    try {
      const body = (await readFile(path, 'utf8')).slice(0, 128 * 1024)
      title = firstCodexUserPreview(body) || title
    } catch {
      // keep default
    }
    out.push({
      provider: 'codex',
      externalId: meta.sessionId,
      title,
      updatedAt: meta.updatedAt,
      ...(meta.model ? { model: meta.model } : {}),
    })
    if (out.length >= limit) break
  }
  return out
}

export async function importCodexSession(
  repoPath: string,
  externalId: string,
  home = homedir(),
): Promise<ImportSessionResult | null> {
  // Find the rollout file whose session id matches.
  const files = await listRolloutFiles(home, 200)
  let path: string | null = null
  let meta: Awaited<ReturnType<typeof readSessionMeta>> = null
  for (const candidate of files) {
    const m = await readSessionMeta(candidate)
    if (m && m.sessionId === externalId) {
      path = candidate
      meta = m
      break
    }
  }
  if (!path || !meta || !pathsEqual(repoPath, meta.cwd)) return null
  let body = ''
  try {
    body = await readFile(path, 'utf8')
  } catch {
    return null
  }
  const items = capItems(mapCodexRollout(body))
  const title = firstCodexUserPreview(body.slice(0, 128 * 1024)) || 'Codex session'
  return {
    title,
    ...(meta.model ? { model: meta.model } : {}),
    sessionState: externalId,
    items,
  }
}

function firstCodexUserPreview(snippet: string): string {
  for (const line of snippet.split('\n')) {
    if (line.trim() === '') continue
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    if (obj.type !== 'response_item') continue
    const payload = (obj.payload ?? {}) as Record<string, unknown>
    if (payload.type !== 'message' || payload.role !== 'user') continue
    const text = textFromContent(payload.content).trim()
    // Skip system-ish developer dumps and plugin recommendations.
    if (text === '' || text.startsWith('<') || text.length > 500) continue
    return previewText(text, 60)
  }
  return ''
}

/** Pure: fold a Codex rollout JSONL into TimelineItems. */
export function mapCodexRollout(jsonl: string): TimelineItem[] {
  const items: TimelineItem[] = []
  const pendingTools = new Map<string, number>()
  let n = 0
  const nextId = (prefix: string): string => {
    n += 1
    return `import-codex-${prefix}-${n}`
  }

  for (const line of jsonl.split('\n')) {
    if (line.trim() === '') continue
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    if (obj.type !== 'response_item') continue
    const payload = (obj.payload ?? {}) as Record<string, unknown>
    const pType = payload.type

    if (pType === 'message') {
      const role = payload.role
      const text = textFromContent(payload.content).trim()
      if (text === '') continue
      if (role === 'user') {
        if (text.startsWith('<') && text.includes('instructions')) continue
        items.push(userItem(nextId('user'), text))
      } else if (role === 'assistant') {
        items.push(assistantItem(nextId('asst'), text))
      }
      continue
    }

    if (pType === 'reasoning') {
      const summary = payload.summary
      let text = ''
      if (typeof payload.text === 'string') text = payload.text
      else if (Array.isArray(summary)) {
        text = summary
          .map((s) =>
            s && typeof s === 'object' && typeof (s as { text?: unknown }).text === 'string'
              ? (s as { text: string }).text
              : '',
          )
          .filter(Boolean)
          .join('\n')
      }
      if (text.trim() !== '') items.push(reasoningItem(nextId('reason'), text.trim()))
      continue
    }

    if (pType === 'function_call' || pType === 'custom_tool_call') {
      const id =
        (typeof payload.call_id === 'string' && payload.call_id) ||
        (typeof payload.id === 'string' && payload.id) ||
        nextId('tool')
      const name =
        (typeof payload.name === 'string' && payload.name) ||
        (typeof payload.tool_name === 'string' && payload.tool_name) ||
        'tool'
      const args =
        typeof payload.arguments === 'string'
          ? payload.arguments
          : typeof payload.input === 'string'
            ? payload.input
            : ''
      pendingTools.set(id, items.length)
      items.push(toolItem(id, name, 'running', args ? previewText(args, 60) : undefined))
      continue
    }

    if (pType === 'function_call_output' || pType === 'custom_tool_call_output') {
      const id =
        (typeof payload.call_id === 'string' && payload.call_id) ||
        (typeof payload.id === 'string' && payload.id) ||
        ''
      const output =
        typeof payload.output === 'string'
          ? payload.output
          : typeof payload.content === 'string'
            ? payload.content
            : textFromContent(payload.content)
      const idx = pendingTools.get(id)
      if (idx !== undefined) {
        const existing = items[idx]
        if (existing.kind === 'tool') {
          items[idx] = {
            ...existing,
            status: 'ok',
            ...(output !== '' ? { output: truncateOutput(output) } : {}),
          }
        }
        pendingTools.delete(id)
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
