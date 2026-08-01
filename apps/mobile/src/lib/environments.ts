import { create } from 'zustand'

/** A daemon this device knows about. One environment is one daemon plus the repos it exposes. */
export type Environment = {
  id: string
  /** What the human called this daemon. */
  nickname: string
  /** Origin the pairing link pointed at, e.g. `http://beelink.local:43117`. */
  baseUrl: string
}

/** What a pairing link carries: where the daemon is, and the one-shot grant to redeem there. */
export type PairingLink = {
  baseUrl: string
  credential: string
}

export type PairingLinkProblem = 'empty' | 'malformed' | 'missing-token' | 'foreign-token'

export type ParsedPairingLink =
  | { ok: true; link: PairingLink }
  | { ok: false; problem: PairingLinkProblem }

/** The daemon mints grants with this prefix; a client token (`pc_client_`) is not a pairing link. */
const GRANT_PREFIX = 'pc_pair_'

/**
 * Rejects userinfo in the authority: `http://beelink.local@evil.example` would otherwise store
 * the attacker's origin under a trusted-looking name, and redeeming a grant there hands out a
 * client token. A second `#` is rejected for the same reason — it would silently extend the
 * credential. Both are `malformed`, not best-effort repairs.
 */
const PAIRING_LINK = /^(https?:\/\/[^/?#\s@]+)(?:\/[^?#\s]*)?(?:\?[^#\s]*)?#([^#\s]*)$/i

/**
 * `<origin>/pair#token=pc_pair_<id>_<secret>`, the link the desktop's Share settings copy.
 * The grant rides in the fragment so it never reaches a server in a request line.
 *
 * Parsed by hand, not with `URL`: RN ships a regex shim whose `hash` getter stops at the
 * first `/`, and Vitest would exercise Node's real parser instead of the phone's.
 */
export function parsePairingLink(input: string): ParsedPairingLink {
  const trimmed = input.trim()
  if (trimmed === '') return { ok: false, problem: 'empty' }

  const parts = PAIRING_LINK.exec(trimmed)
  if (parts === null) return { ok: false, problem: 'malformed' }

  const [, origin, fragment] = parts
  if (origin === undefined || fragment === undefined) return { ok: false, problem: 'malformed' }

  const credential = readFragmentToken(fragment)
  if (credential === null) return { ok: false, problem: 'missing-token' }
  if (!credential.startsWith(GRANT_PREFIX)) return { ok: false, problem: 'foreign-token' }

  return { ok: true, link: { baseUrl: origin.toLowerCase(), credential } }
}

function readFragmentToken(fragment: string): string | null {
  for (const pair of fragment.split('&')) {
    const separator = pair.indexOf('=')
    if (separator === -1 || pair.slice(0, separator) !== 'token') continue
    try {
      // Throws `URIError` on a stray `%` — a paste is free text, so this is reachable.
      const value = decodeURIComponent(pair.slice(separator + 1).replace(/\+/g, ' '))
      return value === '' ? null : value
    } catch {
      return null
    }
  }
  return null
}

/** Human-readable reason a link was rejected, shown under the field that carried it. */
export function describePairingProblem(problem: PairingLinkProblem): string {
  switch (problem) {
    case 'empty':
      return 'Paste the pairing link from the desktop app.'
    case 'malformed':
      return 'That does not look like a pairing link. Copy it again from Settings → Share.'
    case 'missing-token':
      return 'That link’s pairing token is missing or damaged. Links expire 15 minutes after you create one.'
    case 'foreign-token':
      return 'That token is not a pairing grant. Use the link from “Pair a device”.'
  }
}

type EnvironmentsState = {
  environments: readonly Environment[]
  selectedId: string | null
}

/**
 * Paired environments.
 *
 * Deliberately in memory only: redeeming a grant against `POST /pair` and keeping the
 * resulting `pc_client_` token in `expo-secure-store` is plan 00's job, and persisting a
 * credential this build never exchanged would be a lie the next session has to unpick.
 */
const useEnvironmentsStore = create<EnvironmentsState>()(() => ({
  environments: [],
  selectedId: null,
}))

let lastId = 0

export function useEnvironments(): readonly Environment[] {
  return useEnvironmentsStore((state) => state.environments)
}

/** The one the header names. `null` until something is paired. */
export function useSelectedEnvironment(): Environment | null {
  return useEnvironmentsStore(
    (state) => state.environments.find((candidate) => candidate.id === state.selectedId) ?? null,
  )
}

export function addEnvironment(nickname: string, link: PairingLink): void {
  lastId += 1
  const environment: Environment = { baseUrl: link.baseUrl, id: `env-${lastId}`, nickname }
  useEnvironmentsStore.setState((state) => ({
    environments: [...state.environments, environment],
    selectedId: state.selectedId ?? environment.id,
  }))
}

export function removeEnvironment(id: string): void {
  useEnvironmentsStore.setState((state) => {
    const environments = state.environments.filter((candidate) => candidate.id !== id)
    return {
      environments,
      selectedId: state.selectedId === id ? (environments[0]?.id ?? null) : state.selectedId,
    }
  })
}

export function selectEnvironment(id: string): void {
  useEnvironmentsStore.setState({ selectedId: id })
}
