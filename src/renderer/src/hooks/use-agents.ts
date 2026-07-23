import type { AgentCommand } from '@backend/agents/types'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useAgentDraftsStore } from '@renderer/stores/agent-drafts'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import type {
  AgentInteraction,
  AgentMode,
  AgentProvider,
  ExternalSession,
  ProviderStatus,
  ThreadInfo,
  ThreadOptions,
} from '@shared/agent-protocol'
import { useEffect, useState } from 'react'

/**
 * The Agent tab's domain hooks: the daemon-owned roster + provider status as TanStack
 * Query, thread lifecycle as mutations. The roster query is live-refreshed by the
 * `agent-threads` app event (see `use-app-events.ts`); each mutation re-invalidates it.
 * Turn streaming/approvals ride the WS session and live in `use-agent-channel.ts`.
 */

/** Every Agent thread for the current repo (invalidated on the `agent-threads` app event). */
export function useAgentThreads(): ThreadInfo[] {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.agentThreads.useQuery(
    { repoPath: repo?.path ?? '' },
    { enabled: repo !== null },
  )
  return data ?? []
}

/**
 * Keep open agent tabs' titles in sync with the roster — mounted once in AppShell so
 * BACKGROUND tabs update too (an AgentView-local effect would only fix the active one).
 * A thread's auto-title lands on the daemon after the tab was opened as "New thread"; the
 * roster refetches on the `agent-threads` app event, and this walks every open agent tab
 * and retitles any whose title diverges from its thread's. A tab whose thread has vanished
 * is left alone (deletion already closes it via `closeTabEverywhere`).
 */
export function useReconcileAgentTabTitles(): void {
  const threads = useAgentThreads()
  useEffect(() => {
    const { panes, retitleAgentTab } = useTabsStore.getState()
    for (const thread of threads) {
      const open = panes.some((p) =>
        p.tabs.some((t) => t.kind === 'agent' && t.path === thread.id && t.title !== thread.title),
      )
      if (open) retitleAgentTab(thread.id, thread.title)
    }
  }, [threads])
}

/**
 * Create a thread in the current repo; refreshes the roster. Every field is optional —
 * whatever's omitted is filled from the resolved provider's remembered defaults (model,
 * mode, options, interaction). See `createAgentThread`.
 */
export function useCreateAgentThread(): {
  create: (input: {
    provider?: AgentProvider
    model?: string
    mode?: AgentMode
    // Override the target repo (defaults to the window's current repo). Used when creating
    // a thread bound to a fresh worktree — its repoPath IS the worktree path.
    repoPath?: string
    worktreeBranch?: string
  }) => Promise<ThreadInfo | undefined>
  isPending: boolean
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.createAgentThread.useMutation({
    onSuccess: () => utils.agentThreads.invalidate(),
  })
  return {
    create: async ({ repoPath, ...input }) => {
      const targetRepo = repoPath ?? repo?.path
      if (!targetRepo) return undefined
      return mutation.mutateAsync({ repoPath: targetRepo, ...input })
    },
    isPending: mutation.isPending,
  }
}

/**
 * Recent CLI sessions for the current repo that can be opened as Agent threads
 * (Grok/Claude/Codex/OpenCode on-disk history). Sessions already imported carry `threadId`.
 */
export function useExternalAgentSessions(): ExternalSession[] {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.agentExternalSessions.useQuery(
    { repoPath: repo?.path ?? '' },
    { enabled: repo !== null, staleTime: 15_000 },
  )
  return data ?? []
}

/** Import a CLI session into an Agent thread (or reopen the existing linked thread). */
export function useImportAgentSession(): {
  importSession: (provider: AgentProvider, externalId: string) => Promise<ThreadInfo | undefined>
  isPending: boolean
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.importAgentSession.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.agentThreads.invalidate(), utils.agentExternalSessions.invalidate()])
    },
    onError: onMutationError('Couldn’t open session'),
  })
  return {
    importSession: async (provider, externalId) => {
      if (!repo) return undefined
      return mutation.mutateAsync({ repoPath: repo.path, provider, externalId })
    },
    isPending: mutation.isPending,
  }
}

/** Rename a thread's title; refreshes the roster. */
export function useRenameAgentThread(): {
  rename: (id: string, title: string) => Promise<void>
} {
  const utils = trpc.useUtils()
  const mutation = trpc.renameAgentThread.useMutation({
    onSuccess: () => utils.agentThreads.invalidate(),
  })
  return {
    rename: async (id, title) => {
      const trimmed = title.trim()
      if (trimmed === '') return
      await mutation.mutateAsync({ id, title: trimmed })
    },
  }
}

/** Change a thread's model, provider, permission mode, interaction, and/or options; refreshes the roster. */
export function useUpdateAgentThread(): {
  update: (
    id: string,
    fields: {
      model?: string
      mode?: AgentMode
      provider?: AgentProvider
      interaction?: AgentInteraction
      options?: ThreadOptions
    },
  ) => Promise<void>
} {
  const utils = trpc.useUtils()
  const mutation = trpc.updateAgentThread.useMutation({
    onSuccess: () => utils.agentThreads.invalidate(),
  })
  return {
    update: async (id, fields) => {
      await mutation.mutateAsync({ id, ...fields })
    },
  }
}

/**
 * Delete a thread: the daemon aborts a running turn + removes the file, then we close any
 * open viewer tab and drop its live state — a deleted thread can't leave an orphaned tab
 * behind (mirrors the terminal kill flow). Refreshes the roster.
 */
export function useDeleteAgentThread(): {
  remove: (id: string) => Promise<void>
  isPending: boolean
} {
  const utils = trpc.useUtils()
  const mutation = trpc.deleteAgentThread.useMutation({
    onSuccess: () => utils.agentThreads.invalidate(),
  })
  return {
    remove: async (id) => {
      await mutation.mutateAsync({ id })
      useTabsStore.getState().closeTabEverywhere(tabId('agent', id))
      useAgentThreadsStore.getState().remove(id)
      useAgentDraftsStore.getState().clearDraft(id)
    },
    isPending: mutation.isPending,
  }
}

/** Per-provider install/auth state + model catalog (probed from the CLIs; cached 30s). */
export function useAgentProviders(): ProviderStatus[] {
  const { data } = trpc.agentProviders.useQuery(undefined, { staleTime: 30_000 })
  return data ?? []
}

/**
 * Re-probe the provider CLIs on demand (Settings → Agents' refresh button): invalidate the
 * cached `agentProviders` query so an install/sign-in done after launch is picked up without
 * a restart. `isPending` drives the button's spinner state.
 */
export function useRefreshAgentProviders(): { refresh: () => Promise<void>; isPending: boolean } {
  const utils = trpc.useUtils()
  const [isPending, setPending] = useState(false)
  return {
    refresh: async () => {
      setPending(true)
      try {
        await utils.agentProviders.invalidate()
      } finally {
        setPending(false)
      }
    },
    isPending,
  }
}

/**
 * The custom slash commands a provider's CLI exposes for the current repo (scanned from
 * its command `.md` files). Cached ~30s per (repo, provider) like `useAgentProviders`;
 * enabled once a repo + provider are known. Feeds the composer's `/` autocomplete.
 */
export function useAgentCommands(provider: AgentProvider): AgentCommand[] {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.agentCommands.useQuery(
    { repoPath: repo?.path ?? '', provider },
    { enabled: repo !== null, staleTime: 30_000 },
  )
  return data ?? []
}

/** The favorited-model keys (`provider:modelId`), stored global in the daemon config. */
export function useAgentModelFavorites(): string[] {
  const { data } = trpc.agentModelFavorites.useQuery()
  return data ?? []
}

/** Toggle a model favorite; refreshes the favorites query. */
export function useToggleAgentModelFavorite(): { toggle: (key: string) => Promise<void> } {
  const utils = trpc.useUtils()
  const mutation = trpc.toggleAgentModelFavorite.useMutation({
    onSuccess: () => utils.agentModelFavorites.invalidate(),
  })
  return {
    toggle: async (key) => {
      await mutation.mutateAsync({ key })
    },
  }
}
