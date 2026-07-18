import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Builtins only — see cli.ts. Agent chat / relay channel: messages local and
// remote agents (and the human) post to exchange context. Atomic writes; app
// re-validates with zod on read. Cap matches chat-store.ts.

const MAX_CHAT_MESSAGES = 200

// Coordination claims — KEEP IN LOCKSTEP with the zod copy in src/backend/chat-store.ts
// (no shared module: this bundle is a dependency-free `node` script that can't import zod
// from inside app.asar). A claim is a chat message carrying a file footprint; the app
// derives live claims/overlaps on read, so there is no new file or channel.
/** A claim stays "live" for 6h unless closed or superseded. Derived at read time. */
export const CLAIM_TTL_MS = 6 * 60 * 60 * 1000
/** Match chat-store's zod `.max()` caps so a CLI-written claim never fails the app schema. */
const MAX_CLAIM_FILES = 50
const MAX_INTENT_LEN = 280

export interface ChatMessage {
  id: string
  from: string
  body: string
  createdAt: number
  /** Repo-relative paths the poster is working on — declares a claim when non-empty. */
  files?: string[]
  /** One-line "working on X". */
  intent?: string
  /** This message retires the poster's currently-open claim(s). */
  closes?: boolean
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
    const message: ChatMessage = {
      id: item.id,
      from: item.from,
      body: item.body,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
    }
    // Lenient claim parse: a malformed field degrades to a plain message, never throws.
    if (
      Array.isArray(item.files) &&
      item.files.length > 0 &&
      item.files.every((f) => typeof f === 'string' && f.trim() !== '')
    ) {
      message.files = item.files as string[]
    }
    if (typeof item.intent === 'string' && item.intent !== '') message.intent = item.intent
    if (item.closes === true) message.closes = true
    messages.push(message)
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

export function postMessage(
  repoPath: string,
  input: { from: string; body: string; files?: string[]; intent?: string; closes?: boolean },
): ChatMessage {
  const message: ChatMessage = {
    id: randomUUID(),
    from: input.from.trim(),
    body: input.body.trim(),
    createdAt: Date.now(),
  }
  // Trim + cap to chat-store's zod limits: an over-cap claim would fail the app schema and
  // get the whole chat.json backed up as corrupt (home-channel). Only add keys when present
  // so a plain message stays byte-identical.
  const files = input.files
    ?.map((f) => f.trim())
    .filter(Boolean)
    .slice(0, MAX_CLAIM_FILES)
  if (files && files.length > 0) message.files = files
  const intent = input.intent?.trim()
  if (intent) message.intent = intent.slice(0, MAX_INTENT_LEN)
  if (input.closes) message.closes = true
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

interface LiveClaim {
  from: string
  files: string[]
  intent?: string
  at: number
}

/** Normalize a repo-relative claim path for comparison (trim, strip leading './'). */
function normalizeClaimPath(path: string): string {
  const trimmed = path.trim()
  return trimmed.startsWith('./') ? trimmed.slice(2) : trimmed
}

/**
 * Minimal own fold of the live claims (the CLI can't import the renderer's chat-claims lib;
 * the asar constraint justifies this small duplication, same as the schema). `messages` is
 * assumed chronological (readMessages sorts ascending).
 */
function foldLiveClaims(messages: ChatMessage[], now: number): LiveClaim[] {
  const byFrom = new Map<string, ChatMessage[]>()
  for (const m of messages) {
    const list = byFrom.get(m.from)
    if (list) list.push(m)
    else byFrom.set(m.from, [m])
  }
  const claims: LiveClaim[] = []
  for (const [from, list] of byFrom) {
    let claim: ChatMessage | undefined
    for (const m of list) if (m.files && m.files.length > 0) claim = m
    if (!claim?.files) continue
    // Closed if a message from this `from` posted a --closes after the claim.
    if (list.some((m) => m.closes === true && m.createdAt >= (claim?.createdAt ?? 0))) continue
    if (now - claim.createdAt >= CLAIM_TTL_MS) continue
    const files = [...new Set(claim.files.map(normalizeClaimPath).filter(Boolean))]
    if (files.length === 0) continue
    claims.push({ from, files, intent: claim.intent, at: claim.createdAt })
  }
  return claims
}

/** Render the thread for `porcelain chat list`, with derived live-claim + overlap blocks. */
export function describeChat(repoPath: string, messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return `Agent chat for ${repoPath} is empty. Post with \`porcelain chat post\` (set a clear "from" label like "local" or "beelink") so agents across environments can exchange context.`
  }
  const lines: string[] = [`Agent chat for ${repoPath} (${messages.length} message(s)):`]
  for (const m of messages) {
    const when = m.createdAt > 0 ? new Date(m.createdAt).toISOString() : '?'
    const body = m.body.replace(/\n/g, '\n  ')
    if (m.files && m.files.length > 0) {
      const intent = m.intent ? `${m.intent} — ` : ''
      lines.push(
        `- [${m.id}] ${when} · ${m.from}: ${body} [CLAIM] ${intent}files: ${m.files.join(', ')}`,
      )
    } else if (m.closes) {
      lines.push(`- [${m.id}] ${when} · ${m.from}: ${body} [CLOSED]`)
    } else {
      lines.push(`- [${m.id}] ${when} · ${m.from}: ${body}`)
    }
  }
  const claims = foldLiveClaims(messages, Date.now())
  if (claims.length > 0) {
    lines.push('', `Live claims (${claims.length}):`)
    const width = Math.max(...claims.map((c) => c.from.length))
    for (const c of claims) {
      const intent = c.intent ? `  ("${c.intent}")` : ''
      lines.push(`  - ${c.from.padEnd(width)}: ${c.files.join(', ')}${intent}`)
    }
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const shared = claims[i].files.filter((f) => claims[j].files.includes(f))
        if (shared.length > 0) {
          lines.push(
            `⚠ Overlap: ${claims[i].from} & ${claims[j].from} both touching ${shared.join(', ')}`,
          )
        }
      }
    }
  }
  return lines.join('\n')
}
