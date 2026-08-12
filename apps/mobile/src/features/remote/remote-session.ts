import {
  orderRemoteEndpoints,
  parsePublicError,
  type RemoteEndpointGroup,
  type RemotePublicErrorParse,
  type RemoteSessionHealth,
} from '@porcelain/client-runtime/remote'
import { endpointKind } from '@porcelain/contracts'
import { remoteProcedures } from '@porcelain/contracts/remote'

import { openProjectProcedure, recentProjectsProcedure } from '@/features/projects'
import { createDaemonClient, type DaemonClient, PROBE_TIMEOUT_MS } from '@/lib/daemon/client'
import { type DaemonProcedure, namedContractProcedure } from '@/lib/daemon/procedure'
import {
  markSessionUpdateRequired,
  type SessionConnectionStatus,
  sessionHealth,
} from '@/lib/daemon/session'

import type { EndpointAttempt } from './remote-connection'
import { currentConnection } from './remote-connection'
import { activeProjectPathOf, isPaired, type PairedEnvironment } from './remote-environment'
import { activeEnvironment, environmentActions } from './remote-environment-store'
import { goUnauthorized } from './remote-unauthorized'

const UNREACHABLE_MESSAGE = 'The daemon could not be reached.'

const daemonInfoProcedure = namedContractProcedure('daemonInfo', remoteProcedures.daemonInfo)

const ADAPTER_HEALTH = {
  idle: 'idle',
  connecting: 'connecting',
  open: 'healthy',
  reconnecting: 'recovering',
  'update-required': 'update-required',
} as const satisfies Record<SessionConnectionStatus, RemoteSessionHealth>

export function orderMobileRemoteEndpoints(group: RemoteEndpointGroup): string[] {
  return orderRemoteEndpoints(group)
}

export function classifyRemoteFailure(value: unknown): RemotePublicErrorParse {
  return parsePublicError(value)
}

export function mapAdapterStatus(status: SessionConnectionStatus): RemoteSessionHealth {
  return ADAPTER_HEALTH[status]
}

type WalkStopKind = 'unauthorized' | 'update-required' | 'other' | 'exhausted'

class RemoteWalkStop extends Error {
  readonly stop: WalkStopKind
  readonly attempts: readonly EndpointAttempt[]

  constructor(stop: WalkStopKind, attempts: readonly EndpointAttempt[], message: string) {
    super(message)
    this.name = 'RemoteWalkStop'
    this.stop = stop
    this.attempts = attempts
  }
}

function walkStopFrom(cause: unknown, attempts: readonly EndpointAttempt[]): RemoteWalkStop | null {
  const parsed = classifyRemoteFailure(cause)
  if (parsed.kind === 'unreachable') return null
  if (parsed.kind === 'update-required') {
    return new RemoteWalkStop('update-required', attempts, parsed.error.message)
  }
  if (
    parsed.kind === 'public' &&
    (parsed.error.code === 'auth.unauthenticated' || parsed.error.code === 'auth.forbidden')
  ) {
    return new RemoteWalkStop('unauthorized', attempts, parsed.error.message)
  }
  return new RemoteWalkStop('other', attempts, parsed.error.message)
}

/**
 * The walk's own call: identical transport to `callDaemon`, minus the error wrap it applies.
 * REM-003 classifies the RAW cause with `parsePublicError`, and a wrapped error would read as
 * `unreachable` for every refusal the daemon took the trouble to explain.
 */
async function callProbe<TInput, TOutput>(
  client: DaemonClient,
  procedure: DaemonProcedure<TInput, TOutput>,
  input: TInput,
): Promise<TOutput> {
  const validated = procedure.input !== undefined ? procedure.input.parse(input) : input
  const raw =
    procedure.kind === 'query'
      ? await client.query(procedure.name, validated)
      : await client.mutation(procedure.name, validated)
  return procedure.output.parse(raw)
}

async function bootstrapAtEndpoint(
  environment: PairedEnvironment,
  baseUrl: string,
): Promise<{ daemonVersion: string }> {
  const client = createDaemonClient(baseUrl, environment.token, { timeoutMs: PROBE_TIMEOUT_MS })
  const daemonVersion = (await callProbe(client, daemonInfoProcedure, undefined)).version
  await callProbe(client, recentProjectsProcedure, { includeWorktrees: true })

  const projectPath = activeProjectPathOf(environment)
  if (projectPath !== null) {
    try {
      await callProbe(client, openProjectProcedure, projectPath)
    } catch (cause) {
      const parsed = classifyRemoteFailure(cause)
      if (parsed.kind === 'unreachable' || parsed.kind === 'update-required') throw cause
      if (
        parsed.kind === 'public' &&
        (parsed.error.code === 'auth.unauthenticated' || parsed.error.code === 'auth.forbidden')
      ) {
        throw cause
      }
      await environmentActions.setActiveProjectPath(environment.id, null)
    }
  }
  return { daemonVersion }
}

async function bootstrap(
  environment: PairedEnvironment,
): Promise<{ daemonVersion: string; attempts: readonly EndpointAttempt[] }> {
  const attempts: EndpointAttempt[] = []
  const endpoints = orderMobileRemoteEndpoints({
    endpoints: environment.endpoints,
    preferredEndpoint: environment.preferredEndpoint,
    url: environment.baseUrl,
  })

  for (const baseUrl of endpoints) {
    attempts.push({ kind: endpointKind(baseUrl), url: baseUrl })
    try {
      const ready = await bootstrapAtEndpoint(environment, baseUrl)
      if (baseUrl !== environment.baseUrl) {
        await environmentActions.setActiveEndpoint(environment.id, baseUrl)
      }
      return { ...ready, attempts }
    } catch (error) {
      const stop = walkStopFrom(error, attempts)
      if (stop !== null) throw stop
    }
  }

  throw new RemoteWalkStop('exhausted', attempts, UNREACHABLE_MESSAGE)
}

export async function connect(environment: PairedEnvironment): Promise<void> {
  const previous = currentConnection()
  environmentActions.setConnection({ kind: 'connecting' })
  try {
    const ready = await bootstrap(environment)
    environmentActions.setConnection({
      daemonVersion: ready.daemonVersion,
      kind: 'ready',
      reachability: {
        attempted: ready.attempts,
        consecutiveFailures: 0,
        source: 'endpoint-walk',
        state: 'reachable',
      },
    })
  } catch (error) {
    if (error instanceof RemoteWalkStop && error.stop === 'unauthorized') {
      await goUnauthorized(environment)
      return
    }
    if (error instanceof RemoteWalkStop && error.stop === 'update-required') {
      markSessionUpdateRequired()
      environmentActions.setConnection({ kind: 'update-required' })
      return
    }
    if (error instanceof RemoteWalkStop && error.stop === 'exhausted') {
      sessionHealth().apply({ type: 'walk-exhausted' })
    }
    const previousFailures =
      previous.kind === 'unreachable' ? previous.reachability.consecutiveFailures : 0
    environmentActions.setConnection({
      kind: 'unreachable',
      message: error instanceof Error ? error.message : UNREACHABLE_MESSAGE,
      reachability: {
        attempted:
          error instanceof RemoteWalkStop
            ? error.attempts
            : [{ kind: endpointKind(environment.baseUrl), url: environment.baseUrl }],
        consecutiveFailures: previousFailures + 1,
        source: 'endpoint-walk',
        state: 'unreachable',
      },
    })
  }
}

/** Re-run the bootstrap sequence against the active environment — the gate's Retry. */
export async function retryConnection(): Promise<void> {
  const current = activeEnvironment()
  if (isPaired(current)) await connect(current)
}

/**
 * Climb back to the preferred route once it might be reachable again — `bootstrap` always tries
 * `preferredEndpoint` first, so replaying it is the whole mechanism. Only worth it once we've
 * actually settled on a fallback (nothing to climb back from otherwise) and only while healthy: a
 * connection already mid-failure has its own walk in flight from `recordReachabilityFailure`.
 */
export async function recoverToPreferredEndpoint(): Promise<void> {
  const current = activeEnvironment()
  if (!isPaired(current)) return
  if (current.baseUrl === current.preferredEndpoint) return
  if (currentConnection().kind !== 'ready') return
  await connect(current)
}
