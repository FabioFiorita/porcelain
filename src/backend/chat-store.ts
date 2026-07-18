import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createHomeChannel } from './home-channel'

/**
 * Agent chat (relay) channel: messages agents (and the human) post so local and
 * remote agents can exchange context without overloading the project board.
 * Keyed by absolute repo path in `~/.porcelain/chat.json`. TWO-WAY: app + CLI.
 * Cap messages per repo so a runaway agent can't grow the file without bound.
 */
export const chatMessageSchema = z.object({
  id: z.string(),
  /** Freeform origin label — e.g. "local", "beelink", "mac:claude", "linux:codex". */
  from: z.string().min(1),
  body: z.string().min(1),
  createdAt: z.number().default(0),
  // Coordination claim fields (all optional; absent on a plain message so it stays
  // byte-identical). A message is "a claim" iff `files` is present and non-empty.
  // KEEP IN LOCKSTEP with the CLI's hand-parsed copy in src/cli/chat-file.ts.
  /** Repo-relative paths the poster is working on — declares a claim. */
  files: z.array(z.string().trim().min(1)).max(50).optional(),
  /** One-line "working on X". */
  intent: z.string().trim().max(280).optional(),
  /** This message retires the poster's currently-open claim(s). */
  closes: z.boolean().optional(),
})
export type ChatMessage = z.infer<typeof chatMessageSchema>

export const chatSchema = z.record(z.string(), z.array(chatMessageSchema))
export type Chat = z.infer<typeof chatSchema>

/** Soft cap: drop oldest when exceeded (after each post). */
export const MAX_CHAT_MESSAGES = 200

const channel = createHomeChannel({
  envVar: 'PORCELAIN_CHAT',
  fileName: 'chat.json',
  schema: chatSchema,
  empty: (): Chat => ({}),
})

export const chatPath = channel.path

/** Messages for a repo, oldest first. */
export async function readMessages(repoPath: string): Promise<ChatMessage[]> {
  const messages = (await channel.readAll())[repoPath] ?? []
  return [...messages].sort((a, b) => a.createdAt - b.createdAt)
}

export async function postMessage(
  repoPath: string,
  input: { from: string; body: string; files?: string[]; intent?: string; closes?: boolean },
): Promise<ChatMessage> {
  const message: ChatMessage = {
    id: randomUUID(),
    from: input.from.trim(),
    body: input.body.trim(),
    createdAt: Date.now(),
    // Only serialize claim keys when present, so a plain message stays byte-identical
    // (the api layer already trims/caps files & intent).
    ...(input.files && input.files.length > 0 ? { files: input.files } : {}),
    ...(input.intent ? { intent: input.intent } : {}),
    ...(input.closes ? { closes: true } : {}),
  }
  await channel.mutate((all) => {
    const next = [...(all[repoPath] ?? []), message]
    all[repoPath] =
      next.length > MAX_CHAT_MESSAGES ? next.slice(next.length - MAX_CHAT_MESSAGES) : next
  })
  return message
}

export async function clearMessages(repoPath: string): Promise<void> {
  await channel.mutate((all) => {
    delete all[repoPath]
  })
}
