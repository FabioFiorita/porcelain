import { onMutationError } from '@renderer/hooks/mutation-error'
import { exchangePairingCode, type PairFailure } from '@renderer/lib/pair-exchange'
import { parsePairingLink } from '@renderer/lib/pairing-link'
import { shellTrpc, trpc } from '@renderer/lib/trpc'
import { useCallback, useState } from 'react'

/**
 * The pairing window on THIS daemon: open one, read the pending code, close it.
 *
 * These are ordinary token-gated procedures — only a client the daemon already trusts
 * may open a pairing window. The unauthenticated half of the flow is the `/pair`
 * exchange the OTHER device performs (`lib/pair-exchange.ts`), which can do nothing
 * until `startPairing` has been called here.
 */

/** The code currently on offer, or null when no window is open. */
export function usePairingStatus(): { code: string; expiresAt: number } | null | undefined {
  const { data } = trpc.pairingStatus.useQuery(undefined, {
    // A pending code expires on the daemon's clock, so the card must find out that the
    // window closed without the human doing anything. Cheap query, short interval.
    refetchInterval: 15_000,
    staleTime: 0,
  })
  return data
}

export function useStartPairing(): { start: () => void; isPending: boolean } {
  const utils = trpc.useUtils()
  const mutation = trpc.startPairing.useMutation({
    onSuccess: async () => await utils.pairingStatus.invalidate(),
    onError: onMutationError('Start pairing'),
  })
  return { start: () => mutation.mutate(), isPending: mutation.isPending }
}

/**
 * The receiving end on the Mac: paste the link the other machine produced, and this
 * parses it, redeems the code for that daemon's token, and saves the environment —
 * one field instead of name + url + token.
 *
 * Deliberately a hook and not component code: the exchange is a real network call
 * with failure states, and components are supposed to consume, not orchestrate.
 */
export function usePairEnvironment(): {
  pair: (link: string) => void
  isPending: boolean
  error: string | null
} {
  const utils = shellTrpc.useUtils()
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const addEnvironment = shellTrpc.addRemoteEnvironment.useMutation()

  const pair = useCallback(
    (link: string) => {
      const parsed = parsePairingLink(link)
      if (parsed === null) {
        setError(
          'That does not look like a pairing link. Copy it from Settings → Environments on the other machine.',
        )
        return
      }
      setPending(true)
      setError(null)
      void (async () => {
        const outcome = await exchangePairingCode(parsed.url, parsed.code)
        if (!outcome.ok) {
          setPending(false)
          setError(PAIR_FAILURES[outcome.reason])
          return
        }
        try {
          // Blank name: the daemon reports its own host, so the environment names
          // itself (phase 1). connectThisWindow defaults true — main reloads us onto it.
          // A `merged: true` result (pairing a machine we already saved, over its other
          // address — phase 5) takes that same reload, so there is nothing extra to say
          // here: this hook shows no success copy that could claim a row was created.
          await addEnvironment.mutateAsync({ name: '', url: parsed.url, token: outcome.token })
          await utils.remoteEnvironments.invalidate()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Could not save that environment')
        } finally {
          setPending(false)
        }
      })()
    },
    [addEnvironment, utils],
  )

  return { pair, isPending, error }
}

// Each failure sends the human somewhere different, so they don't share a message.
const PAIR_FAILURES: Record<PairFailure, string> = {
  unreachable: 'Could not reach that daemon. Check the device is awake and on the same network.',
  none: 'That pairing window is closed. Start a new one on the other machine.',
  expired: 'That code expired. Start a new one on the other machine.',
  invalid: 'That code was rejected. Check it, or start a new one on the other machine.',
}

export function useCancelPairing(): { cancel: () => void } {
  const utils = trpc.useUtils()
  const mutation = trpc.cancelPairing.useMutation({
    onSuccess: async () => await utils.pairingStatus.invalidate(),
    onError: onMutationError('Cancel pairing'),
  })
  return { cancel: () => mutation.mutate() }
}
