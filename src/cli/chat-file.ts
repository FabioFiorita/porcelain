import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Builtins only — see cli.ts. Agent chat / relay channel: messages local and
// remote agents (and the human) post to exchange context. Atomic writes; app
// re-validates with zod on read. Cap matches chat-store.ts.

const MAX_CHAT_MESSAGES = 200

export interface ChatMessage {
  id: string
  from: string
  body: string
  createdAt: number
}

type Chat = Record<string, ChatMessage[]>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function chatPath(): string {
  return process.env.PORCELAIN_CHAT ?? join(homedir(), '.porcelain', 'chat.json')
}

function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  const messages: ChatMessage[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    if (typeof item.id !== 'string' || typeof item.from !== 'string') continue
    if (typeof item.body !== 'string') continue
    messages.push({
      id: item.id,
      from: item.from,
      body: item.body,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
    })
  }
  return messages
}

function readAll(): Chat {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(chatPath(), 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const all: Chat = {}
  for (const [repoPath, value] of Object.entries(parsed)) all[repoPath] = parseMessages(value)
  return all
}

function writeAll(all: Chat): void {
  const path = chatPath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(all, null, 2))
  renameSync(tmp, path)
}

export function readMessages(repoPath: string): ChatMessage[] {
  const messages = readAll()[repoPath] ?? []
  return [...messages].sort((a, b) => a.createdAt - b.createdAt)
}

export function postMessage(repoPath: string, from: string, body: string): ChatMessage {
  const message: ChatMessage = {
    id: randomUUID(),
    from: from.trim(),
    body: body.trim(),
    createdAt: Date.now(),
  }
  const all = readAll()
  const next = [...(all[repoPath] ?? []), message]
  all[repoPath] =
    next.length > MAX_CHAT_MESSAGES ? next.slice(next.length - MAX_CHAT_MESSAGES) : next
  writeAll(all)
  return message
}

export function clearMessages(repoPath: string): boolean {
  const all = readAll()
  if (!(repoPath in all)) return false
  delete all[repoPath]
  writeAll(all)
  return true
}

/** Render the thread for `porcelain chat list`. */
export function describeChat(repoPath: string, messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return `Agent chat for ${repoPath} is empty. Post with \`porcelain chat post\` (set a clear "from" label like "local" or "beelink") so agents across environments can exchange context.`
  }
  const lines: string[] = [`Agent chat for ${repoPath} (${messages.length} message(s)):`]
  for (const m of messages) {
    const when = m.createdAt > 0 ? new Date(m.createdAt).toISOString() : '?'
    lines.push(`- [${m.id}] ${when} · ${m.from}: ${m.body.replace(/\n/g, '\n  ')}`)
  }
  return lines.join('\n')
}
