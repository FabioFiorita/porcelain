import type { AuthorizedClient, PairingGrant } from '@backend/access-store'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'

export interface AccessStatus {
  pairings: PairingGrant[]
  clients: AuthorizedClient[]
  connected: number
  adminTokenPath: string
}

export function useAccessStatus(): AccessStatus | undefined {
  const { data } = trpc.accessStatus.useQuery(undefined, {
    refetchInterval: 15_000,
    staleTime: 0,
  })
  return data
}

export function useIssuePairingLink(): {
  issue: (input: { label: string; baseUrl: string }) => Promise<{ url: string }>
  isPending: boolean
} {
  const utils = trpc.useUtils()
  const mutation = trpc.issuePairingLink.useMutation({
    onSuccess: async () => {
      await utils.accessStatus.invalidate()
    },
    onError: onMutationError('Create connection link'),
  })
  return {
    issue: async (input: { label: string; baseUrl: string }): Promise<{ url: string }> =>
      mutation.mutateAsync(input),
    isPending: mutation.isPending,
  }
}

export function useRevokePairingLink(): {
  revoke: (id: string) => void
  pendingId: string | null
} {
  const utils = trpc.useUtils()
  const mutation = trpc.revokePairingLink.useMutation({
    onSuccess: async () => {
      await utils.accessStatus.invalidate()
    },
    onError: onMutationError('Revoke connection link'),
  })
  return {
    revoke: (id: string): void => mutation.mutate(id),
    pendingId: mutation.isPending ? (mutation.variables ?? null) : null,
  }
}

export function useRevokeAuthorizedClient(): {
  revoke: (id: string) => void
  pendingId: string | null
} {
  const utils = trpc.useUtils()
  const mutation = trpc.revokeAuthorizedClient.useMutation({
    onSuccess: async () => {
      await utils.accessStatus.invalidate()
    },
    onError: onMutationError('Revoke device'),
  })
  return {
    revoke: (id: string): void => mutation.mutate(id),
    pendingId: mutation.isPending ? (mutation.variables ?? null) : null,
  }
}
