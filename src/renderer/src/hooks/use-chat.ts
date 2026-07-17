import type { ChatMessage } from '@backend/chat-store'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/** Agent-chat messages for the current repo (live-refreshed on MCP post). */
export function useChatMessages(): { messages: ChatMessage[]; error: string | null } {
  const repo = useRepoStore((s) => s.repo)
  const { data, error } = trpc.chatMessages.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return { messages: data ?? [], error: error?.message ?? null }
}

export function useChatActions(): {
  post: (from: string, body: string) => Promise<void>
  clear: () => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const refresh = async (): Promise<void> => {
    await utils.chatMessages.invalidate()
  }
  const post = trpc.postChatMessage.useMutation({
    onSuccess: refresh,
    onError: onMutationError('Post chat message'),
  })
  const clear = trpc.clearChatMessages.useMutation({
    onSuccess: refresh,
    onError: onMutationError('Clear chat'),
  })
  return {
    post: async (from, body) => {
      if (!repo) return
      await post.mutateAsync({ repoPath: repo.path, from, body })
    },
    clear: async () => {
      if (!repo) return
      await clear.mutateAsync({ repoPath: repo.path })
    },
  }
}
