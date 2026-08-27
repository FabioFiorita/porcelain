import { settleBackground } from '@porcelain/shared/background'
import {
  type HubTarget,
  listCanvasesQuery,
  readCanvasQuery,
} from '@porcelain/client-runtime/projects'
import type { CanvasRecord, ReadCanvasOutput } from '@porcelain/contracts/projects'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { callProjectDaemon, projectsQueryKey, useHubTarget } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'

import {
  listCanvasesProcedure,
  mintCanvasAccessTokenProcedure,
  readCanvasProcedure,
} from './canvas-procedures'
import { canvasDocumentUrl } from './canvas-document'

/**
 * Mobile's Canvas reads.
 *
 * Everything is scoped to the selected Worktree's `HubTarget`, exactly as the web sidebar is:
 * a Canvas is owned by the Project, but the checkout is what merges its tracked `.porcelain/`
 * overlay over the private records, and the same id can name different bytes in two checkouts
 * (#26). So `worktreePath` is part of every call *and* of every cache identity.
 */

/** A stable identity for the disabled render, so the key does not churn while nothing is selected. */
const DISABLED_LIST = listCanvasesQuery('none', null)
const DISABLED_READ = readCanvasQuery('none', 'none', null)

function failureMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback
}

/** The wire input every Canvas procedure shares — `worktreePath` omitted, never sent as null. */
function canvasScope(target: HubTarget): { projectId: string; worktreePath: string } {
  return { projectId: target.projectId, worktreePath: target.path }
}

function canvasListScope(target: HubTarget): {
  projectId: string
  worktreeId: string
  worktreePath: string
} {
  return { ...canvasScope(target), worktreeId: target.worktreeId }
}

/** Every Canvas the selected Worktree resolves, newest daemon order preserved. */
export function useCanvasList(active: boolean): {
  canvases: readonly CanvasRecord[]
  isLoading: boolean
  loadError: string | null
} {
  const environment = useActiveEnvironment()
  const target = useHubTarget()
  const enabled = active && isPaired(environment) && target !== null
  const environmentId = environment?.id ?? 'none'
  const identity =
    target === null
      ? DISABLED_LIST
      : listCanvasesQuery(target.projectId, target.path, target.worktreeId)

  const query = useQuery({
    enabled,
    queryFn: async (): Promise<readonly CanvasRecord[]> => {
      if (target === null) throw new Error('listCanvases ran without a selected Worktree')
      return callProjectDaemon(environment, listCanvasesProcedure, canvasListScope(target))
    },
    queryKey: projectsQueryKey(environmentId, identity),
  })

  return {
    canvases: enabled ? (query.data ?? []) : [],
    isLoading: enabled && query.isPending,
    loadError:
      enabled && query.isError ? failureMessage(query.error, 'Could not load Canvases.') : null,
  }
}

/**
 * One Canvas record plus its content.
 *
 * A Markdown Canvas is rendered straight from `content`; an HTML one takes the token route
 * instead ({@link useCanvasDocumentUrl}) and only reads the record here — for the title, and
 * for the `kind` that decides which of the two it is.
 */
export function useCanvas(
  canvasId: string,
  active: boolean,
): { canvas: ReadCanvasOutput | undefined; isLoading: boolean; loadError: string | null } {
  const environment = useActiveEnvironment()
  const target = useHubTarget()
  const enabled = active && isPaired(environment) && target !== null && canvasId !== ''
  const environmentId = environment?.id ?? 'none'
  const identity =
    target === null ? DISABLED_READ : readCanvasQuery(target.projectId, canvasId, target.path)

  const query = useQuery({
    enabled,
    queryFn: async (): Promise<ReadCanvasOutput> => {
      if (target === null) throw new Error('readCanvas ran without a selected Worktree')
      return callProjectDaemon(environment, readCanvasProcedure, {
        canvasId,
        ...canvasScope(target),
      })
    },
    queryKey: projectsQueryKey(environmentId, identity),
  })

  return {
    canvas: enabled ? query.data : undefined,
    isLoading: enabled && query.isPending,
    loadError:
      enabled && query.isError ? failureMessage(query.error, 'Could not open this Canvas.') : null,
  }
}

/**
 * The URL an HTML Canvas is loaded from, minted on demand.
 *
 * Not a cached query: the grant is a few minutes long and single-purpose, so it is worth
 * nothing after the screen closes and must not be replayed from a cache into a WebView that
 * would then fail to load. `null` is the loading state, never a broken document — the same
 * shape web's `CanvasHtmlFrame` uses.
 */
export function useCanvasDocumentUrl(
  canvasId: string,
  active: boolean,
): { url: string | null; mintError: string | null } {
  const environment = useActiveEnvironment()
  const target = useHubTarget()
  // The target object is rebuilt every render, so the effect depends on its two fields rather
  // than on the object — the Environment record comes straight out of the store and is stable.
  const projectId = target?.projectId ?? null
  const worktreePath = target?.path ?? null
  const enabled =
    active &&
    isPaired(environment) &&
    projectId !== null &&
    worktreePath !== null &&
    canvasId !== ''
  const [state, setState] = useState<{ url: string | null; mintError: string | null }>({
    mintError: null,
    url: null,
  })

  useEffect(() => {
    if (!enabled || projectId === null || worktreePath === null || !isPaired(environment)) {
      setState({ mintError: null, url: null })
      return
    }
    let cancelled = false
    setState({ mintError: null, url: null })
    const { baseUrl } = environment
    // An async body rather than `.then(…)`: the transport can refuse before it ever returns a
    // promise (an unpaired Environment throws on the spot), and a synchronous throw inside an
    // effect escapes React entirely instead of reaching the failed state below.
    settleBackground(
      (async () => {
        try {
          const minted = await callProjectDaemon(environment, mintCanvasAccessTokenProcedure, {
            canvasId,
            projectId,
            worktreePath,
          })
          if (!cancelled) {
            setState({ mintError: null, url: canvasDocumentUrl(baseUrl, minted.token) })
          }
        } catch (error) {
          if (!cancelled) {
            setState({ mintError: failureMessage(error, 'Could not open this Canvas.'), url: null })
          }
        }
      })(),
      'fallback',
    )
    return () => {
      cancelled = true
    }
  }, [canvasId, enabled, environment, projectId, worktreePath])

  return state
}
