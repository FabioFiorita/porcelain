import type { ChatMessage } from '@backend/chat-store'

/**
 * Pure derivation of coordination state from the raw chat thread — kept out of the hook so
 * it's unit-testable (the codebase pattern of pure lib + thin hook, cf. buildCommentIndex).
 * A claim is just a chat message carrying a file footprint; live claims and overlaps are
 * derived at read time (no new file/channel), so a stale claim self-heals via the TTL.
 */

/** A claim stays "live" for 6h unless closed or superseded. Mirrors chat-file.ts's CLI copy. */
export const CLAIM_TTL_MS = 6 * 60 * 60 * 1000

export interface LiveClaim {
  from: string
  files: string[]
  intent?: string
  at: number
}

export interface ClaimOverlap {
  a: string
  b: string
  files: string[]
}

export interface Participant {
  from: string
  lastAt: number
}

export interface ChatClaims {
  liveClaims: LiveClaim[]
  overlaps: ClaimOverlap[]
  participants: Participant[]
}

/** Normalize a repo-relative claim path for comparison (trim, strip leading './'). */
export function normalizeClaimPath(path: string): string {
  const trimmed = path.trim()
  return trimmed.startsWith('./') ? trimmed.slice(2) : trimmed
}

/**
 * Repo-containment guard for an agent-authored claim path. Claims are posted by OTHER agents
 * (`chat post --files`), and the Coordination panel resolves each path against the repo root to
 * open a file tab (chat-quick-access.tsx → daemon `readFile`, which is not itself repo-scoped).
 * So, exactly like agent-authored review-set paths (`isRepoContained`, review-store.ts), a path
 * that is absolute or `..`-escapes the repo must be dropped before it can reach a file read.
 * String-only (the renderer has no node:path); runs on the already-normalized path.
 */
export function isContainedClaimPath(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.startsWith('\\')) return false
  if (/^[A-Za-z]:/.test(path)) return false // Windows drive-absolute (C:\…)
  return !path.split(/[/\\]/).includes('..')
}

function isClaim(message: ChatMessage): message is ChatMessage & { files: string[] } {
  return Array.isArray(message.files) && message.files.length > 0
}

/**
 * Fold the thread into live claims, overlaps, and participants.
 *
 * - **Live claim per `from`**: its latest claim message, within CLAIM_TTL_MS and not followed
 *   by a `closes` from the same `from`; a newer claim supersedes an older one.
 * - **Overlap**: two different `from` labels' live claims sharing ≥1 normalized path.
 * - **Participants**: distinct `from` values across all messages with their last-seen time.
 */
export function deriveChatClaims(messages: ChatMessage[], now: number = Date.now()): ChatClaims {
  // Sort a copy chronologically so "latest claim" / "closed after" hold regardless of input order.
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt)

  const lastSeen = new Map<string, number>()
  const order: string[] = []
  const byFrom = new Map<string, ChatMessage[]>()
  for (const m of sorted) {
    if (!lastSeen.has(m.from)) order.push(m.from)
    lastSeen.set(m.from, m.createdAt)
    const list = byFrom.get(m.from)
    if (list) list.push(m)
    else byFrom.set(m.from, [m])
  }
  const participants: Participant[] = order.map((from) => ({
    from,
    lastAt: lastSeen.get(from) ?? 0,
  }))

  const liveClaims: LiveClaim[] = []
  for (const [from, list] of byFrom) {
    let latest: ChatMessage | undefined
    for (const m of list) if (isClaim(m)) latest = m
    if (latest === undefined || !isClaim(latest)) continue
    const claim = latest // const so the isClaim narrowing survives into the closure below
    if (list.some((m) => m.closes === true && m.createdAt >= claim.createdAt)) continue
    if (now - claim.createdAt >= CLAIM_TTL_MS) continue
    const files = [...new Set(claim.files.map(normalizeClaimPath).filter(isContainedClaimPath))]
    if (files.length === 0) continue
    liveClaims.push({ from, files, intent: claim.intent, at: claim.createdAt })
  }

  const overlaps: ClaimOverlap[] = []
  for (let i = 0; i < liveClaims.length; i++) {
    for (let j = i + 1; j < liveClaims.length; j++) {
      const a = liveClaims[i]
      const b = liveClaims[j]
      const shared = a.files.filter((f) => b.files.includes(f))
      if (shared.length > 0) overlaps.push({ a: a.from, b: b.from, files: shared })
    }
  }

  return { liveClaims, overlaps, participants }
}
