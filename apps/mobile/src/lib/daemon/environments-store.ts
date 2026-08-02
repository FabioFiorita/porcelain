import { type EndpointKind, endpointKind, orderedEndpointUrls } from '@porcelain/contracts'
import { randomUUID } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'

import { forgetDaemonClient } from './client'
import {
  EMPTY_ENVIRONMENTS_FILE,
  type Environment,
  type EnvironmentId,
  type EnvironmentRecord,
  type EnvironmentsFile,
  normalizeBaseUrl,
  type PairedEnvironment,
  parseEnvironmentsFile,
} from './environment'

/**
 * The index is one small non-secret blob; each token gets its own key. Secure-store values are
 * size-constrained, and a nickname edit must never rewrite a credential.
 */
const INDEX_KEY = 'porcelain.environments'
const CORRUPT_KEY = 'porcelain.environments.corrupt'
const tokenKey = (id: EnvironmentId): string => `porcelain.token.${id}`
const REACHABILITY_FAILURE_THRESHOLD = 2

export type EndpointAttempt = { url: string; kind: EndpointKind }
type Reachability = {
  state: 'reachable' | 'unreachable'
  source: 'endpoint-walk' | 'query'
  consecutiveFailures: number
  attempted: readonly EndpointAttempt[]
}

export type ConnectionState =
  | { kind: 'loading' }
  | { kind: 'no-environment' }
  | { kind: 'connecting' }
  | { kind: 'ready'; daemonVersion: string; reachability: Reachability }
  | { kind: 'unreachable'; message: string; reachability: Reachability }
  | { kind: 'unauthorized' }

type EnvironmentsState = {
  environments: readonly Environment[]
  activeId: EnvironmentId | null
  connection: ConnectionState
  corrupt: boolean
}

const useEnvironmentsStore = create<EnvironmentsState>()(() => ({
  activeId: null,
  connection: { kind: 'loading' },
  corrupt: false,
  environments: [],
}))

export function useEnvironments(): readonly Environment[] {
  return useEnvironmentsStore((state) => state.environments)
}

export function useActiveEnvironment(): Environment | null {
  return useEnvironmentsStore(
    (state) => state.environments.find((candidate) => candidate.id === state.activeId) ?? null,
  )
}

export function useConnectionState(): ConnectionState {
  return useEnvironmentsStore((state) => state.connection)
}

/** True when stored environments could not be read — the app says so instead of looking empty. */
export function useEnvironmentsCorrupt(): boolean {
  return useEnvironmentsStore((state) => state.corrupt)
}

export function activeEnvironment(): Environment | null {
  const { activeId, environments } = useEnvironmentsStore.getState()
  return environments.find((candidate) => candidate.id === activeId) ?? null
}

export function currentConnection(): ConnectionState {
  return useEnvironmentsStore.getState().connection
}

/** Subscribe outside React (the provider drives bootstrap off this). */
export function subscribeToEnvironments(listener: (state: EnvironmentsState) => void): () => void {
  return useEnvironmentsStore.subscribe(listener)
}

function toRecord(environment: Environment): EnvironmentRecord {
  const { token: _token, ...record } = environment
  return record
}

async function persist(): Promise<void> {
  const { activeId, environments } = useEnvironmentsStore.getState()
  const file: EnvironmentsFile = {
    activeId,
    environments: environments.map(toRecord),
    version: 3,
  }
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(file))
}

async function readToken(id: EnvironmentId): Promise<string | null> {
  return await SecureStore.getItemAsync(tokenKey(id))
}

async function hydrate(): Promise<void> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY).catch(() => null)
  const stored = parseEnvironmentsFile(raw)
  if (stored.status === 'corrupt') {
    // Kept, not discarded: a credential that vanishes without a word is worse than an error.
    if (raw !== null) await SecureStore.setItemAsync(CORRUPT_KEY, raw)
    useEnvironmentsStore.setState({ connection: { kind: 'no-environment' }, corrupt: true })
    return
  }

  const file = stored.status === 'ok' ? stored.file : EMPTY_ENVIRONMENTS_FILE
  const environments: Environment[] = []
  for (const record of file.environments) {
    // A record whose token key is gone is kept, not pruned: it names the daemon this device
    // was unpaired from, which is what makes "pair again" a sentence instead of a blank list.
    environments.push({ ...record, token: await readToken(record.id) })
  }
  const active =
    environments.find((candidate) => candidate.id === file.activeId) ?? environments[0] ?? null
  useEnvironmentsStore.setState({
    activeId: active?.id ?? null,
    connection: connectionFor(active),
    corrupt: false,
    environments,
  })
}

function connectionFor(environment: Environment | null): ConnectionState {
  if (environment === null) return { kind: 'no-environment' }
  return environment.token === null ? { kind: 'unauthorized' } : { kind: 'connecting' }
}

type EnvironmentActions = {
  add(input: { nickname: string; baseUrl: string; token: string }): Promise<PairedEnvironment>
  addEndpoint(id: EnvironmentId, baseUrl: string): Promise<void>
  restoreToken(id: EnvironmentId, baseUrl: string, token: string): Promise<void>
  rename(id: EnvironmentId, nickname: string): Promise<void>
  setActive(id: EnvironmentId): Promise<void>
  setActiveEndpoint(id: EnvironmentId, baseUrl: string): Promise<void>
  preferEndpoint(id: EnvironmentId, baseUrl: string): Promise<void>
  removeEndpoint(id: EnvironmentId, baseUrl: string): Promise<void>
  remove(id: EnvironmentId): Promise<void>
  forgetToken(id: EnvironmentId): Promise<void>
  setActiveRepoPath(id: EnvironmentId, path: string | null): Promise<void>
  recordReachabilityFailure(
    id: EnvironmentId,
    message: string,
    attempted?: readonly EndpointAttempt[],
  ): void
  recordReachabilitySuccess(id: EnvironmentId): void
  setConnection(connection: ConnectionState): void
  hydrate(): Promise<void>
}

export const environmentActions: EnvironmentActions = {
  async add(input: {
    nickname: string
    baseUrl: string
    token: string
  }): Promise<PairedEnvironment> {
    // SecureStore keys allow `[A-Za-z0-9._-]`, which a UUID satisfies.
    const baseUrl = normalizeBaseUrl(input.baseUrl)
    const environment: PairedEnvironment = {
      activeRepoPath: null,
      baseUrl,
      createdAt: Date.now(),
      endpoints: [baseUrl],
      id: randomUUID(),
      nickname: input.nickname,
      preferredEndpoint: baseUrl,
      token: input.token,
    }
    await SecureStore.setItemAsync(tokenKey(environment.id), environment.token)
    useEnvironmentsStore.setState((state) => ({
      activeId: state.activeId ?? environment.id,
      environments: [...state.environments, environment],
    }))
    await persist()
    return environment
  },

  async addEndpoint(id: EnvironmentId, inputUrl: string): Promise<void> {
    const baseUrl = normalizeBaseUrl(inputUrl)
    const environment = useEnvironmentsStore
      .getState()
      .environments.find((candidate) => candidate.id === id)
    if (environment === undefined) throw new Error('That environment no longer exists')
    if (environment.endpoints.includes(baseUrl)) return
    useEnvironmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id
          ? { ...candidate, endpoints: [...candidate.endpoints, baseUrl] }
          : candidate,
      ),
    }))
    await persist()
  },

  async restoreToken(id: EnvironmentId, inputUrl: string, token: string): Promise<void> {
    const baseUrl = normalizeBaseUrl(inputUrl)
    const environment = useEnvironmentsStore
      .getState()
      .environments.find((candidate) => candidate.id === id)
    if (environment === undefined) throw new Error('That environment no longer exists')
    const endpoints = environment.endpoints.includes(baseUrl)
      ? environment.endpoints
      : [...environment.endpoints, baseUrl]
    await SecureStore.setItemAsync(tokenKey(id), token)
    useEnvironmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              baseUrl,
              endpoints,
              token,
              preferredEndpoint: candidate.preferredEndpoint,
            }
          : candidate,
      ),
      connection: state.activeId === id ? { kind: 'connecting' } : state.connection,
    }))
    await persist()
  },

  async rename(id: EnvironmentId, nickname: string): Promise<void> {
    useEnvironmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id ? { ...candidate, nickname } : candidate,
      ),
    }))
    await persist()
  },

  async setActive(id: EnvironmentId): Promise<void> {
    const next = useEnvironmentsStore
      .getState()
      .environments.find((candidate) => candidate.id === id)
    useEnvironmentsStore.setState({ activeId: id, connection: connectionFor(next ?? null) })
    await persist()
  },

  async setActiveEndpoint(id: EnvironmentId, inputUrl: string): Promise<void> {
    const baseUrl = normalizeBaseUrl(inputUrl)
    const environment = useEnvironmentsStore
      .getState()
      .environments.find((candidate) => candidate.id === id)
    if (environment === undefined || !environment.endpoints.includes(baseUrl)) return
    useEnvironmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id ? { ...candidate, baseUrl } : candidate,
      ),
    }))
    await persist()
  },

  async preferEndpoint(id: EnvironmentId, inputUrl: string): Promise<void> {
    const baseUrl = normalizeBaseUrl(inputUrl)
    const environment = useEnvironmentsStore
      .getState()
      .environments.find((candidate) => candidate.id === id)
    if (environment === undefined || !environment.endpoints.includes(baseUrl)) return
    useEnvironmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id ? { ...candidate, preferredEndpoint: baseUrl } : candidate,
      ),
    }))
    await persist()
  },

  async removeEndpoint(id: EnvironmentId, inputUrl: string): Promise<void> {
    const baseUrl = normalizeBaseUrl(inputUrl)
    const environment = useEnvironmentsStore
      .getState()
      .environments.find((candidate) => candidate.id === id)
    if (environment === undefined || environment.endpoints.length === 1) return
    const endpoints = environment.endpoints.filter((endpoint) => endpoint !== baseUrl)
    if (endpoints.length === environment.endpoints.length) return
    const nextBaseUrl = endpoints.includes(environment.baseUrl)
      ? environment.baseUrl
      : (endpoints[0] ?? environment.baseUrl)
    const preferredEndpoint =
      environment.preferredEndpoint === baseUrl
        ? (endpoints[0] ?? environment.preferredEndpoint)
        : environment.preferredEndpoint
    useEnvironmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id
          ? { ...candidate, baseUrl: nextBaseUrl, endpoints, preferredEndpoint }
          : candidate,
      ),
    }))
    await persist()
  },

  async remove(id: EnvironmentId): Promise<void> {
    forgetDaemonClient(id)
    useEnvironmentsStore.setState((state) => {
      const environments = state.environments.filter((candidate) => candidate.id !== id)
      if (state.activeId !== id) return { environments }
      const next = environments[0] ?? null
      return { activeId: next?.id ?? null, connection: connectionFor(next), environments }
    })
    await SecureStore.deleteItemAsync(tokenKey(id))
    await persist()
  },

  /** The token was revoked host-side: keep the nickname and routes, drop the dead credential. */
  async forgetToken(id: EnvironmentId): Promise<void> {
    forgetDaemonClient(id)
    useEnvironmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id ? { ...candidate, token: null } : candidate,
      ),
    }))
    await SecureStore.deleteItemAsync(tokenKey(id))
  },

  async setActiveRepoPath(id: EnvironmentId, path: string | null): Promise<void> {
    useEnvironmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id ? { ...candidate, activeRepoPath: path } : candidate,
      ),
    }))
    await persist()
  },

  recordReachabilityFailure(
    id: EnvironmentId,
    message: string,
    attempted?: readonly EndpointAttempt[],
  ): void {
    const state = useEnvironmentsStore.getState()
    if (state.activeId !== id) return
    const environment = state.environments.find((candidate) => candidate.id === id)
    if (environment === undefined || environment.token === null) return
    const routes =
      attempted ??
      orderedEndpointUrls({
        endpoints: environment.endpoints,
        preferredEndpoint: environment.preferredEndpoint,
        url: environment.baseUrl,
      }).map((url) => ({ kind: endpointKind(url), url }))
    const previousFailures =
      state.connection.kind === 'ready' || state.connection.kind === 'unreachable'
        ? state.connection.reachability.consecutiveFailures
        : 0
    const consecutiveFailures = previousFailures + 1
    if (consecutiveFailures < REACHABILITY_FAILURE_THRESHOLD) {
      if (state.connection.kind !== 'ready') return
      useEnvironmentsStore.setState({
        connection: {
          ...state.connection,
          reachability: {
            attempted: routes,
            consecutiveFailures,
            source: 'query',
            state: 'reachable',
          },
        },
      })
      return
    }
    useEnvironmentsStore.setState({
      connection: {
        kind: 'unreachable',
        message,
        reachability: {
          attempted: routes,
          consecutiveFailures,
          source: 'query',
          state: 'unreachable',
        },
      },
    })
  },

  recordReachabilitySuccess(id: EnvironmentId): void {
    const state = useEnvironmentsStore.getState()
    if (state.activeId !== id) return
    if (state.connection.kind === 'ready') {
      useEnvironmentsStore.setState({
        connection: {
          ...state.connection,
          reachability: {
            ...state.connection.reachability,
            consecutiveFailures: 0,
            source: 'endpoint-walk',
            state: 'reachable',
          },
        },
      })
    }
  },

  setConnection(connection: ConnectionState): void {
    useEnvironmentsStore.setState({ connection })
  },

  hydrate,
}
