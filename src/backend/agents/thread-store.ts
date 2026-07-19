import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import {
  agentInteractionSchema,
  agentModeSchema,
  agentProviderSchema,
  agentUsageSchema,
  queuedMessageInfoSchema,
  threadOptionsSchema,
  timelineItemSchema,
} from '../../shared/agent-protocol'

/**
 * Per-thread durable JSON under `~/.porcelain/agent-threads/<id>.json`. One file per
 * thread (not one big map) so a large timeline is read/rewritten in isolation, and so
 * a single corrupt thread can be dropped without losing the rest. The daemon is the
 * SOLE writer (unlike the CLI-written agent-channel files), so no cross-process race — but the
 * writes are still atomic (tmp + rename) and the reads still zod-validated + size-
 * capped, returning null on corruption instead of throwing, matching the drop-on-
 * invalid posture of the other stores. NOT an agent channel: the porcelain CLI never
 * reads this (v1).
 *
 * `PORCELAIN_AGENT_THREADS` redirects the directory (dev + tests), the same escape
 * hatch shape as `PORCELAIN_REVIEW_SETS` / `PORCELAIN_BOARD`.
 */

// The persisted meta — a ThreadInfo without the runtime `status` (a hydrated thread is
// always idle, so persisting status would just be a lie after a restart).
export const storedThreadMetaSchema = z.object({
  id: z.string(),
  repoPath: z.string(),
  title: z.string(),
  provider: agentProviderSchema,
  model: z.string(),
  // The CLI-reported effective model for the session (see ThreadInfo.resolvedModel).
  // Optional/back-compat: absent until a turn's init reports one (or for providers that
  // don't surface an effective model), and older thread files read back without it.
  resolvedModel: z.string().optional(),
  mode: agentModeSchema,
  // The Build/Plan toggle. Optional (absent = 'build') so pre-existing files read back.
  interaction: agentInteractionSchema.optional(),
  // The thread's chosen model options. Optional so a thread file written before options
  // existed (or one whose options were never touched) still reads back.
  options: threadOptionsSchema.optional(),
  // Accumulated token usage. Optional so a thread file written before usage tracking (or
  // one whose driver never reported tokens) still reads back.
  usage: agentUsageSchema.optional(),
  // The current turn's start time. Optional/back-compat; only meaningful while working, and a
  // hydrated thread is forced idle, so a persisted value is just a harmless last-turn stamp.
  turnStartedAt: z.number().optional(),
  // Whether the last turn ended in error. Optional/back-compat (absent = last turn was fine).
  lastTurnFailed: z.boolean().optional(),
  // The branch of the worktree this thread is bound to (repoPath IS that worktree's path).
  // Optional/back-compat: absent for a plain in-repo thread and for pre-existing thread files.
  worktreeBranch: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type StoredThreadMeta = z.infer<typeof storedThreadMetaSchema>

export const storedThreadSchema = z.object({
  meta: storedThreadMetaSchema,
  // Driver-private resume state (a Claude session id, …), opaque here. Optional
  // because JSON drops an `undefined` value (a thread persisted before its first
  // turn has none), and zod's `z.unknown()` alone would reject the missing key.
  sessionState: z.unknown().optional(),
  items: z.array(timelineItemSchema),
  // Queued messages (text + image count only — full image payloads are deliberately NOT
  // persisted, matching the timeline, so a long queue can't blow the 16MB file cap; the
  // daemon holds full images in memory). Survives a daemon restart so the composer's chips
  // reappear, though a hard restart loses the full images (documented in agent-manager).
  // Back-compat: pre-array files stored a single object; preprocess lifts it to `[obj]`.
  queued: z.preprocess((value) => {
    if (value === undefined || value === null) return undefined
    return Array.isArray(value) ? value : [value]
  }, z.array(queuedMessageInfoSchema).optional()),
})
export type StoredThread = z.infer<typeof storedThreadSchema>

// A thread file past this is treated as corrupt (returns null). Tool outputs are
// capped per-item (TOOL_OUTPUT_CAP), so a well-behaved thread stays far under this;
// the cap only stops a pathological file from being slurped into memory on read.
const MAX_THREAD_BYTES = 16 * 1024 * 1024

export function threadsDir(): string {
  return process.env.PORCELAIN_AGENT_THREADS ?? join(homedir(), '.porcelain', 'agent-threads')
}

function threadPath(id: string): string {
  return join(threadsDir(), `${id}.json`)
}

/** Read + validate one thread file; null if absent, oversized, or corrupt. */
export async function readThread(id: string): Promise<StoredThread | null> {
  const p = threadPath(id)
  try {
    const info = await stat(p)
    if (info.size > MAX_THREAD_BYTES) {
      console.error(
        `porcelain: ${p} is ${info.size} bytes (> ${MAX_THREAD_BYTES}); treating as absent`,
      )
      return null
    }
    return storedThreadSchema.parse(JSON.parse(await readFile(p, 'utf8')))
  } catch {
    // absent, unparseable, or schema-invalid — drop it (the manager skips the id).
    return null
  }
}

/** Atomic tmp + rename write, creating the directory on first use. */
export async function writeThread(id: string, thread: StoredThread): Promise<void> {
  const p = threadPath(id)
  await mkdir(threadsDir(), { recursive: true })
  const tmp = `${p}.tmp`
  await writeFile(tmp, JSON.stringify(thread, null, 2))
  await rename(tmp, p)
}

/** Delete a thread's file (no-op if it's already gone). */
export async function deleteThreadFile(id: string): Promise<void> {
  await rm(threadPath(id), { force: true })
}

/** The thread ids on disk (the manager hydrates its map from these); [] if the dir is absent. */
export async function listThreadFiles(): Promise<string[]> {
  try {
    const entries = await readdir(threadsDir())
    return entries
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
  } catch {
    return [] // dir absent — no threads yet
  }
}
