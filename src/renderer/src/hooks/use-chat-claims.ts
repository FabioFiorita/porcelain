import { useChatMessages } from '@renderer/hooks/use-chat'
import { type ChatClaims, deriveChatClaims } from '@renderer/lib/chat-claims'
import { useMemo } from 'react'

/**
 * Derived coordination state (live claims, overlaps, participants) for the current repo.
 * Thin over the pure `deriveChatClaims` fold; recomputes when the thread changes (the `'chat'`
 * app-event invalidation), so claims ride the existing query — no new tRPC procedure.
 */
export function useChatClaims(): ChatClaims {
  const { messages } = useChatMessages()
  return useMemo(() => deriveChatClaims(messages), [messages])
}
