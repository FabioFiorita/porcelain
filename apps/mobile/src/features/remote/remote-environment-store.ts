import { randomUUID } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'

import { forgetDaemonClient } from '@/lib/daemon/client'

import {
  type ConnectionState,
  connectionFor,
  type EndpointAttempt,
  recordReachabilityFailure,
  recordReachabilitySuccess,
  setConnection,
} from './remote-connection'
import {
  EMPTY_ENVIRONMENTS_FILE,
  type Environment,
  type EnvironmentIcon,
  type EnvironmentId,
  type EnvironmentRecord,
  type EnvironmentsFile,
  normalizeBaseUrl,
  type PairedEnvironment,
  parseEnvironmentsFile,
} from './remote-environment'

/**
 * The index is one small non-secret blob; each token gets its own key. Secure-store values are
 * size-constrained, and a nickname edit must never rewrite a credential.
 */
const INDEX_KEY = 'porcelain.environments'
const CORRUPT_KEY = 'porcelain.environments.corrupt'
const tokenKey = (id: EnvironmentId): string => `porcelain.token.${id}`

export type EnvironmentsState = {
  environments: readonly Environment[]
  activeId: EnvironmentId | null
  connection: ConnectionState
  corrupt: boolean
}

export const environmentsStore = create<EnvironmentsState>()(() => ({
  activeId: null,
  connection: { kind: 'loading' },
  corrupt: false,
  environments: [],
}))

export function useEnvironments(): readonly Environment[] {
  return environmentsStore((state) => state.environments)
}

/** Imperative lookup for pairing / non-React callers. */
export function getEnvironment(id: EnvironmentId): Environment | null {
  return environmentsStore.getState().environments.find((candidate) => candidate.id === id) ?? null
}

export function useActiveEnvironment(): Environment | null {
  return environmentsStore(
    (state) => state.environments.find((candidate) => candidate.id === state.activeId) ?? null,
  )
}

/** True when stored environments could not be read — the app says so instead of looking empty. */
export function useEnvironmentsCorrupt(): boolean {
  return environmentsStore((state) => state.corrupt)
}

export function activeEnvironment(): Environment | null {
  const { activeId, environments } = environmentsStore.getState()
  return environments.find((candidate) => candidate.id === activeId) ?? null
}

/** Subscribe outside React (the provider drives bootstrap off this). */
export function subscribeToEnvironments(listener: (state: EnvironmentsState) => void): () => void {
  return environmentsStore.subscribe(listener)
}

function toRecord(environment: Environment): EnvironmentRecord {
  const { token: _token, ...record } = environment
  return record
}

async function persist(): Promise<void> {
  const { activeId, environments } = environmentsStore.getState()
  const file: EnvironmentsFile = {
    activeId,
    environments: environments.map(toRecord),
    version: 1,
  }
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(file))
}

async function readToken(id: EnvironmentId): Promise<string | null> {
  return await SecureStore.getItemAsync(tokenKey(id))
}

async function hydrate(): Promise<void> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY).catch(() => null)
  const stored = parseEnvironmentsFile(raw)
  // A hydrate that lands while a connection is already up and running is a re-read, not a cold
  // start: `add()`/`persist()` writes the index asynchronously, so a hydrate racing a
  // not-yet-flushed write can see corrupt or stale bytes for an environment this device is
  // actively, successfully talking to right now. Neither branch below may downgrade that live
  // connection — there is nothing left to promote it back once the bootstrap effect it depends
  // on has already fired for this identity.
  const live = environmentsStore.getState()
  const liveConnected = live.connection.kind === 'ready'

  if (stored.status === 'corrupt') {
    if (liveConnected) return
    // Kept, not discarded: a credential that vanishes without a word is worse than an error.
    if (raw !== null) await SecureStore.setItemAsync(CORRUPT_KEY, raw)
    environmentsStore.setState({ connection: { kind: 'no-environment' }, corrupt: true })
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
  environmentsStore.setState({
    activeId: active?.id ?? null,
    connection:
      liveConnected && active?.id === live.activeId ? live.connection : connectionFor(active),
    corrupt: false,
    environments,
  })
}

type EnvironmentActions = {
  add(input: { nickname: string; baseUrl: string; token: string }): Promise<PairedEnvironment>
  addEndpoint(id: EnvironmentId, baseUrl: string): Promise<void>
  restoreToken(id: EnvironmentId, baseUrl: string, token: string): Promise<void>
  setIcon(id: EnvironmentId, icon: EnvironmentIcon): Promise<void>
  rename(id: EnvironmentId, nickname: string): Promise<void>
  setActive(id: EnvironmentId): Promise<void>
  setActiveEndpoint(id: EnvironmentId, baseUrl: string): Promise<void>
  preferEndpoint(id: EnvironmentId, baseUrl: string): Promise<void>
  removeEndpoint(id: EnvironmentId, baseUrl: string): Promise<void>
  /** Reorder residual fallbacks; preferredEndpoint still wins the probe first. */
  setEndpointOrder(id: EnvironmentId, endpoints: readonly string[]): Promise<void>
  remove(id: EnvironmentId): Promise<void>
  forgetToken(id: EnvironmentId): Promise<void>
  setActiveProjectPath(id: EnvironmentId, path: string | null): Promise<void>
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
      icon: 'desktop',
      nickname: input.nickname,
      preferredEndpoint: baseUrl,
      token: input.token,
    }
    await SecureStore.setItemAsync(tokenKey(environment.id), environment.token)
    environmentsStore.setState((state) => ({
      activeId: state.activeId ?? environment.id,
      // A pairing that just succeeded is proof the index is readable again: the corrupt
      // banner from a stale on-device blob must not survive next to a working environment.
      corrupt: false,
      environments: [...state.environments, environment],
    }))
    await persist()
    return environment
  },

  async addEndpoint(id: EnvironmentId, inputUrl: string): Promise<void> {
    const baseUrl = normalizeBaseUrl(inputUrl)
    const environment = environmentsStore
      .getState()
      .environments.find((candidate) => candidate.id === id)
    if (environment === undefined) throw new Error('That environment no longer exists')
    if (environment.endpoints.includes(baseUrl)) return
    environmentsStore.setState((state) => ({
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
    const environment = environmentsStore
      .getState()
      .environments.find((candidate) => candidate.id === id)
    if (environment === undefined) throw new Error('That environment no longer exists')
    const endpoints = environment.endpoints.includes(baseUrl)
      ? environment.endpoints
      : [...environment.endpoints, baseUrl]
    await SecureStore.setItemAsync(tokenKey(id), token)
    environmentsStore.setState((state) => ({
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

  async setIcon(id: EnvironmentId, icon: EnvironmentIcon): Promise<void> {
    const environment = environmentsStore
      .getState()
      .environments.find((candidate) => candidate.id === id)
    if (environment === undefined) throw new Error('That environment no longer exists')
    environmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id ? { ...candidate, icon } : candidate,
      ),
    }))
    await persist()
  },

  async rename(id: EnvironmentId, nickname: string): Promise<void> {
    environmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id ? { ...candidate, nickname } : candidate,
      ),
    }))
    await persist()
  },

  async setActive(id: EnvironmentId): Promise<void> {
    const next = environmentsStore.getState().environments.find((candidate) => candidate.id === id)
    environmentsStore.setState({ activeId: id, connection: connectionFor(next ?? null) })
    await persist()
  },

  async setActiveEndpoint(id: EnvironmentId, inputUrl: string): Promise<void> {
    const baseUrl = normalizeBaseUrl(inputUrl)
    const environment = environmentsStore
      .getState()
      .environments.find((candidate) => candidate.id === id)
    if (environment === undefined || !environment.endpoints.includes(baseUrl)) return
    environmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id ? { ...candidate, baseUrl } : candidate,
      ),
    }))
    await persist()
  },

  async preferEndpoint(id: EnvironmentId, inputUrl: string): Promise<void> {
    const baseUrl = normalizeBaseUrl(inputUrl)
    const environment = environmentsStore
      .getState()
      .environments.find((candidate) => candidate.id === id)
    if (environment === undefined || !environment.endpoints.includes(baseUrl)) return
    environmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id ? { ...candidate, preferredEndpoint: baseUrl } : candidate,
      ),
    }))
    await persist()
  },

  async removeEndpoint(id: EnvironmentId, inputUrl: string): Promise<void> {
    const baseUrl = normalizeBaseUrl(inputUrl)
    const environment = environmentsStore
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
    environmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id
          ? { ...candidate, baseUrl: nextBaseUrl, endpoints, preferredEndpoint }
          : candidate,
      ),
    }))
    await persist()
  },

  async setEndpointOrder(id: EnvironmentId, next: readonly string[]): Promise<void> {
    const environment = environmentsStore
      .getState()
      .environments.find((candidate) => candidate.id === id)
    if (environment === undefined) return
    const normalized = next.map(normalizeBaseUrl)
    if (normalized.length !== environment.endpoints.length) return
    const sameSet =
      normalized.every((url) => environment.endpoints.includes(url)) &&
      environment.endpoints.every((url) => normalized.includes(url))
    if (!sameSet) return
    environmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id ? { ...candidate, endpoints: normalized } : candidate,
      ),
    }))
    await persist()
  },

  async remove(id: EnvironmentId): Promise<void> {
    forgetDaemonClient(id)
    environmentsStore.setState((state) => {
      const environments = state.environments.filter((candidate) => candidate.id !== id)
      if (state.activeId !== id) return { environments }
      const next = environments[0] ?? null
      return { activeId: next?.id ?? null, connection: connectionFor(next), environments }
    })
    await SecureStore.deleteItemAsync(tokenKey(id))
    await persist()
  },

  /** Revoked host-side: clear memory first, then secure-store (caller owns delete rejection). */
  async forgetToken(id: EnvironmentId): Promise<void> {
    forgetDaemonClient(id)
    environmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id ? { ...candidate, token: null } : candidate,
      ),
    }))
    await SecureStore.deleteItemAsync(tokenKey(id))
  },

  async setActiveProjectPath(id: EnvironmentId, path: string | null): Promise<void> {
    environmentsStore.setState((state) => ({
      environments: state.environments.map((candidate) =>
        candidate.id === id ? { ...candidate, activeRepoPath: path } : candidate,
      ),
    }))
    await persist()
  },

  recordReachabilityFailure,
  recordReachabilitySuccess,
  setConnection,
  hydrate,
}
