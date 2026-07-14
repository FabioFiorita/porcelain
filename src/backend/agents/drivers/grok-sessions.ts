import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { TimelineItem } from '../../../shared/agent-protocol'
import {
  assistantItem,
  capItems,
  grokSessionDirName,
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
 * List + import Grok Build CLI sessions for a repo. Sessions live under
 * `~/.grok/sessions/<encodeURIComponent(cwd)>/<sessionId>/` with `summary.json` +
 * `chat_history.jsonl`. Resume handle is `{ sessionId }` (matches grok.ts).
 */

function sessionsRoot(home = homedir()): string {
  return join(home, '.grok', 'sessions')
}

function sessionDir(repoPath: string, externalId: string, home = homedir()): string {
  return join(sessionsRoot(home), grokSessionDirName(repoPath), externalId)
}

export async function listGrokSessions(
  repoPath: string,
  limit = 30,
  home = homedir(),
): Promise<ExternalSessionInfo[]> {
  const dir = join(sessionsRoot(home), grokSessionDirName(repoPath))
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const out: ExternalSessionInfo[] = []
  for (const name of names) {
    if (name === 'prompt_history.jsonl') continue
    const summaryPath = join(dir, name, 'summary.json')
    try {
      const raw = JSON.parse(await readFile(summaryPath, 'utf8')) as Record<string, unknown>
      const info = raw.info as Record<string, unknown> | undefined
      const cwd = typeof info?.cwd === 'string' ? info.cwd : ''
      if (cwd !== '' && !pathsEqual(repoPath, cwd)) continue
      const title =
        (typeof raw.generated_title === 'string' && raw.generated_title) ||
        (typeof raw.session_summary === 'string' && raw.session_summary) ||
        'Grok session'
      const updatedAt = Date.parse(
        typeof raw.updated_at === 'string'
          ? raw.updated_at
          : typeof raw.last_active_at === 'string'
            ? raw.last_active_at
            : '',
      )
      const model = typeof raw.current_model_id === 'string' ? raw.current_model_id : undefined
      out.push({
        provider: 'grok',
        externalId: name,
        title: title === '(no summary)' || title === '' ? 'Grok session' : title,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : (await stat(summaryPath)).mtimeMs,
        ...(model ? { model } : {}),
      })
    } catch {
      // missing/corrupt summary — skip
    }
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt)
  return out.slice(0, limit)
}

export async function importGrokSession(
  repoPath: string,
  externalId: string,
  home = homedir(),
): Promise<ImportSessionResult | null> {
  const dir = sessionDir(repoPath, externalId, home)
  let title = 'Grok session'
  let model: string | undefined
  try {
    const raw = JSON.parse(await readFile(join(dir, 'summary.json'), 'utf8')) as Record<
      string,
      unknown
    >
    const info = raw.info as Record<string, unknown> | undefined
    const cwd = typeof info?.cwd === 'string' ? info.cwd : ''
    if (cwd !== '' && !pathsEqual(repoPath, cwd)) return null
    title =
      (typeof raw.generated_title === 'string' && raw.generated_title) ||
      (typeof raw.session_summary === 'string' && raw.session_summary) ||
      title
    if (typeof raw.current_model_id === 'string') model = raw.current_model_id
  } catch {
    return null
  }

  let history = ''
  try {
    history = await readFile(join(dir, 'chat_history.jsonl'), 'utf8')
  } catch {
    history = ''
  }
  const items = capItems(mapGrokChatHistory(history))
  return {
    title: title === '(no summary)' || title === '' ? 'Grok session' : title,
    ...(model ? { model } : {}),
    sessionState: { sessionId: externalId },
    items,
  }
}

/** Pure: fold chat_history.jsonl lines into TimelineItems. */
export function mapGrokChatHistory(jsonl: string): TimelineItem[] {
  const items: TimelineItem[] = []
  const pendingTools = new Map<string, number>() // tool_call_id → items index
  let n = 0
  const nextId = (prefix: string): string => {
    n += 1
    return `import-grok-${prefix}-${n}`
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
    if (type === 'system' || type === 'backend_tool_call') continue

    if (type === 'user') {
      const text = textFromContent(obj.content).trim()
      // Skip the huge environment dumps Grok injects as user blocks.
      if (text === '' || text.startsWith('<user_info>') || text.startsWith('<git_status>')) continue
      // Strip wrapper tags when present.
      const cleaned = text
        .replace(/^<user_query>\s*/i, '')
        .replace(/\s*<\/user_query>\s*$/i, '')
        .trim()
      if (cleaned === '') continue
      items.push(userItem(nextId('user'), cleaned))
      continue
    }

    if (type === 'reasoning') {
      const summary = obj.summary
      let text = ''
      if (Array.isArray(summary)) {
        text = summary
          .map((s) =>
            s && typeof s === 'object' && typeof (s as { text?: unknown }).text === 'string'
              ? (s as { text: string }).text
              : '',
          )
          .filter(Boolean)
          .join('\n')
      }
      if (text !== '') items.push(reasoningItem(nextId('reason'), text))
      continue
    }

    if (type === 'assistant') {
      const text = typeof obj.content === 'string' ? obj.content : textFromContent(obj.content)
      if (text.trim() !== '') items.push(assistantItem(nextId('asst'), text.trim()))
      const toolCalls = obj.tool_calls
      if (Array.isArray(toolCalls)) {
        for (const call of toolCalls) {
          if (!call || typeof call !== 'object') continue
          const c = call as Record<string, unknown>
          const id = typeof c.id === 'string' ? c.id : nextId('tool')
          const name = typeof c.name === 'string' ? c.name : 'tool'
          let detail: string | undefined
          if (typeof c.arguments === 'string') {
            try {
              const args = JSON.parse(c.arguments) as Record<string, unknown>
              const first = Object.values(args).find((v) => typeof v === 'string')
              if (typeof first === 'string') detail = previewText(first, 60)
            } catch {
              detail = previewText(c.arguments, 60)
            }
          }
          pendingTools.set(id, items.length)
          items.push(toolItem(id, name, 'running', detail))
        }
      }
      continue
    }

    if (type === 'tool_result') {
      const callId = typeof obj.tool_call_id === 'string' ? obj.tool_call_id : ''
      const output = typeof obj.content === 'string' ? obj.content : textFromContent(obj.content)
      const idx = pendingTools.get(callId)
      if (idx !== undefined) {
        const existing = items[idx]
        if (existing.kind === 'tool') {
          items[idx] = {
            ...existing,
            status: 'ok',
            ...(output !== '' ? { output: truncateOutput(output) } : {}),
          }
        }
        pendingTools.delete(callId)
      }
    }
  }

  // Any tool still running at end of history → mark ok (we don't have a failure signal).
  for (const idx of pendingTools.values()) {
    const existing = items[idx]
    if (existing.kind === 'tool' && existing.status === 'running') {
      items[idx] = { ...existing, status: 'ok' }
    }
  }
  return items
}
