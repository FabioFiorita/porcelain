import type { AgentCommand } from '@backend/agents/types'
import type { LimitsRefresh } from '@backend/repo-config'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import type {
  AgentInteraction,
  AgentMode,
  AgentProvider,
  ProviderLimits,
  ProviderStatus,
  ThreadInfo,
  ThreadOptions,
} from '@shared/agent-protocol'
import { useState } from 'react'

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
 * Create a thread in the current repo; refreshes the roster. `provider`/`model` are
 * optional — omit them to default to the last-used selection (see `createAgentThread`).
 */
export function useCreateAgentThread(): {
  create: (input: {
    provider?: AgentProvider
    model?: string
    mode: AgentMode
  }) => Promise<ThreadInfo | undefined>
  isPending: boolean
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.createAgentThread.useMutation({
    onSuccess: () => utils.agentThreads.invalidate(),
  })
  return {
    create: async (input) => {
      if (!repo) return undefined
      return mutation.mutateAsync({ repoPath: repo.path, ...input })
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

/** The cadence a config with no `limitsRefresh` set falls back to — the one place the default lives. */
export const DEFAULT_LIMITS_REFRESH: LimitsRefresh = '5m'

/** The chosen limits-refresh cadence, resolving the shared default when unset. */
export function useLimitsRefresh(): LimitsRefresh {
  const { data } = trpc.limitsRefresh.useQuery()
  return data ?? DEFAULT_LIMITS_REFRESH
}

/**
 * Set the limits-refresh cadence (global config); refreshes the config query. Fire-and-
 * forget from the settings row, so it's a sync `mutate` (never rejects) + an error toast
 * — the useSetTailnetBind shape.
 */
export function useSetLimitsRefresh(): { set: (value: LimitsRefresh) => void } {
  const utils = trpc.useUtils()
  const mutation = trpc.setLimitsRefresh.useMutation({
    onSuccess: () => utils.limitsRefresh.invalidate(),
    onError: onMutationError('Save limits refresh'),
  })
  return {
    set: (value) => mutation.mutate(value),
  }
}

// The poll cadence each choice maps to: [staleTime, refetchInterval] in ms. 'manual' fetches
// once on first mount (staleTime Infinity) and never auto-repolls (refetchInterval false) —
// the reload button is then the only refresh path. The 1/5/15-minute choices poll on a timer.
const LIMITS_POLL: Record<LimitsRefresh, { staleTime: number; refetchInterval: number | false }> = {
  '1m': { staleTime: 60_000, refetchInterval: 60_000 },
  '5m': { staleTime: 300_000, refetchInterval: 300_000 },
  '15m': { staleTime: 900_000, refetchInterval: 900_000 },
  manual: { staleTime: Number.POSITIVE_INFINITY, refetchInterval: false },
}

/**
 * The running provider's live quota windows + plan, for the Agent Quick Access Limits
 * group. Its poll cadence follows the user's `limitsRefresh` setting (Settings → Agents),
 * since some providers surface limits by spawning the codexbar CLI; 'manual' fetches once
 * then only refreshes via the reload button (useRefreshAgentLimits). Enabled only once a
 * repo is open and a provider is resolved. Returns null when the provider exposes no limits
 * (OpenCode) or isn't subscription-authed — the group then hides.
 */
export function useAgentLimits(provider: AgentProvider | null): ProviderLimits | null {
  const repo = useRepoStore((s) => s.repo)
  const cadence = LIMITS_POLL[useLimitsRefresh()]
  const { data } = trpc.agentLimits.useQuery(
    { provider: provider ?? 'claude' },
    {
      enabled: repo !== null && provider !== null,
      staleTime: cadence.staleTime,
      refetchInterval: cadence.refetchInterval,
    },
  )
  return data ?? null
}

/**
 * Force a fresh limits fetch on demand (the Limits group's reload button): the daemon
 * bypasses/overwrites its TTL cache, then we invalidate `agentLimits` so the auto query
 * re-reads the now-fresh cache. Fire-and-forget from the button, so it's a sync `mutate`
 * (never rejects) + an error toast; `isPending` drives the button's spinner.
 */
export function useRefreshAgentLimits(): {
  refresh: (provider: AgentProvider) => void
  isPending: boolean
} {
  const utils = trpc.useUtils()
  const mutation = trpc.agentLimitsRefresh.useMutation({
    onSuccess: () => utils.agentLimits.invalidate(),
    onError: onMutationError('Refresh limits'),
  })
  return {
    refresh: (provider) => mutation.mutate({ provider }),
    isPending: mutation.isPending,
  }
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
