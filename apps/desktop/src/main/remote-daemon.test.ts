import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { testUserData } = vi.hoisted(() => ({
  testUserData: `/tmp/porcelain-remote-daemon-${process.pid}`,
}))

vi.mock('electron', () => ({
  app: { getPath: (): string => testUserData },
  safeStorage: {
    isEncryptionAvailable: (): boolean => true,
    getSelectedStorageBackend: (): string => 'gnome_libsecret',
    encryptString: (value: string): Buffer => Buffer.from(`protected:${value}`),
    decryptString: (value: Buffer): string => value.toString('utf8').replace(/^protected:/, ''),
  },
}))

import {
  activeRemoteDaemon,
  configureRemoteTokenProtector,
  endpointKind,
  loadRemoteEnvironmentState,
  normalizeDaemonUrl,
  orderedEndpoints,
  parseRemoteEnvironmentState,
  type RemoteEnvironment,
  RemoteEnvironmentStateError,
  saveRemoteEnvironmentState,
  updateRemoteEnvironmentState,
  withActiveUrl,
  withEndpoint,
  withoutEndpoint,
} from './remote-daemon'
import {
  electronRemoteTokenProtector,
  isSecureStorageBackend,
  RemoteCredentialStoreError,
} from './remote-token-store'

const statePath = join(testUserData, 'remote-daemon.json')

beforeEach(async () => {
  await rm(testUserData, { recursive: true, force: true })
  await mkdir(testUserData, { recursive: true })
  configureRemoteTokenProtector(electronRemoteTokenProtector)
})

describe('normalizeDaemonUrl', () => {
  it('accepts http and https urls', () => {
    expect(normalizeDaemonUrl('http://beelink:43117')).toBe('http://beelink:43117')
    expect(normalizeDaemonUrl('https://beelink.tailnet.ts.net')).toBe(
      'https://beelink.tailnet.ts.net',
    )
  })

  it('strips a trailing slash on the path', () => {
    expect(normalizeDaemonUrl('http://beelink:43117/')).toBe('http://beelink:43117')
    expect(normalizeDaemonUrl('http://beelink:43117/porcelain/')).toBe(
      'http://beelink:43117/porcelain',
    )
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeDaemonUrl('  http://beelink:43117  ')).toBe('http://beelink:43117')
  })

  it('rejects a url without an http(s) scheme', () => {
    expect(() => normalizeDaemonUrl('beelink:43117')).toThrow(/http:\/\/ or https:\/\//)
    expect(() => normalizeDaemonUrl('ws://beelink:43117')).toThrow(/http:\/\/ or https:\/\//)
    expect(() => normalizeDaemonUrl('')).toThrow(/http:\/\/ or https:\/\//)
  })
})

describe('remote token protection', () => {
  it('rejects Linux backends that do not use an OS credential store', () => {
    expect(isSecureStorageBackend('linux', 'basic_text')).toBe(false)
    expect(isSecureStorageBackend('linux', 'unknown')).toBe(false)
    expect(isSecureStorageBackend('linux', 'gnome_libsecret')).toBe(true)
    expect(isSecureStorageBackend('linux', 'kwallet6')).toBe(true)
  })

  it('does not apply Linux backend names to Windows or macOS secure storage', () => {
    expect(isSecureStorageBackend('win32', 'unknown')).toBe(true)
    expect(isSecureStorageBackend('darwin', 'unknown')).toBe(true)
  })
})

describe('parseRemoteEnvironmentState', () => {
  it('passes a valid environment-group state straight through', () => {
    const state = {
      activeId: 'a',
      environments: [
        {
          endpoints: ['http://beelink:43117'],
          id: 'a',
          name: 'Beelink',
          preferredEndpoint: 'http://beelink:43117',
          token: 't1',
          url: 'http://beelink:43117',
        },
        {
          endpoints: ['https://mac.ts.net'],
          id: 'b',
          name: 'Mac',
          preferredEndpoint: 'https://mac.ts.net',
          token: 't2',
          url: 'https://mac.ts.net',
        },
      ],
    }
    expect(parseRemoteEnvironmentState(state)).toEqual(state)
  })

  it('refuses garbage, future versions, and obsolete single-url shapes', () => {
    expect(() => parseRemoteEnvironmentState(null)).toThrow()
    expect(() => parseRemoteEnvironmentState({ nope: true })).toThrow()
    expect(() => parseRemoteEnvironmentState('string')).toThrow()
    expect(() =>
      parseRemoteEnvironmentState({ version: 2, activeId: null, environments: [] }),
    ).toThrow()
    // A group must declare its endpoint list; re-pair a single-url record.
    expect(() =>
      parseRemoteEnvironmentState({
        url: 'http://beelink.tailnet.ts.net:43117',
        token: 'secret',
      }),
    ).toThrow()
  })

  it('accepts the versioned persisted shape without leaking its version into runtime state', () => {
    expect(parseRemoteEnvironmentState({ version: 1, activeId: null, environments: [] })).toEqual({
      activeId: null,
      environments: [],
    })
  })
})

describe('remote environment persistence', () => {
  it('treats only an absent file as empty', async () => {
    await expect(loadRemoteEnvironmentState()).resolves.toEqual({
      activeId: null,
      environments: [],
    })
  })

  it('writes an OS-keychain encrypted versioned document and enforces owner-only permissions', async () => {
    await saveRemoteEnvironmentState({
      activeId: null,
      environments: [env({ token: 'pc_client_secret' })],
    })

    expect(JSON.parse(await readFile(statePath, 'utf8'))).toEqual({
      version: 2,
      activeId: null,
      environments: [
        expect.objectContaining({
          tokenCiphertext: Buffer.from('protected:pc_client_secret').toString('base64'),
        }),
      ],
    })
    expect(await readFile(statePath, 'utf8')).not.toContain('pc_client_secret')
    if (process.platform !== 'win32') expect((await stat(statePath)).mode & 0o777).toBe(0o600)
  })

  it('reads a legacy plaintext document then migrates it to encrypted storage', async () => {
    await writeFile(
      statePath,
      JSON.stringify({
        version: 1,
        activeId: 'e1',
        environments: [env({ token: 'pc_client_old' })],
      }),
    )

    await expect(loadRemoteEnvironmentState()).resolves.toEqual({
      activeId: 'e1',
      environments: [env({ token: 'pc_client_old' })],
    })
    const migrated = await readFile(statePath, 'utf8')
    expect(migrated).toContain('"version": 2')
    expect(migrated).not.toContain('pc_client_old')
  })

  it('preserves a valid encrypted document when the OS credential store is unavailable', async () => {
    const protectedEnvironment = env({ token: 'pc_client_saved' })
    await saveRemoteEnvironmentState({ activeId: 'e1', environments: [protectedEnvironment] })
    const original = await readFile(statePath, 'utf8')
    configureRemoteTokenProtector({
      available: () => false,
      encrypt: () => {
        throw new Error('unreachable')
      },
      decrypt: () => {
        throw new Error('unreachable')
      },
    })

    await expect(loadRemoteEnvironmentState()).rejects.toBeInstanceOf(RemoteCredentialStoreError)
    expect(await readFile(statePath, 'utf8')).toBe(original)
    await expect(readFile(`${statePath}.recovery`, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('leaves a legacy document intact when migration cannot reach the OS credential store', async () => {
    const original = JSON.stringify({ version: 1, activeId: 'e1', environments: [env()] })
    await writeFile(statePath, original)
    configureRemoteTokenProtector({
      available: () => false,
      encrypt: () => {
        throw new Error('unreachable')
      },
      decrypt: () => {
        throw new Error('unreachable')
      },
    })

    await expect(loadRemoteEnvironmentState()).rejects.toBeInstanceOf(RemoteCredentialStoreError)
    expect(await readFile(statePath, 'utf8')).toBe(original)
    await expect(readFile(`${statePath}.recovery`, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('repairs an existing final file mode while loading the legacy group shape', async () => {
    await writeFile(statePath, JSON.stringify({ activeId: null, environments: [] }), {
      mode: 0o644,
    })
    await chmod(statePath, 0o644)

    await expect(loadRemoteEnvironmentState()).resolves.toEqual({
      activeId: null,
      environments: [],
    })
    if (process.platform !== 'win32') expect((await stat(statePath)).mode & 0o777).toBe(0o600)
  })

  it('preserves corrupt state and refuses a mutation instead of overwriting it', async () => {
    const raw = '{not-json'
    await writeFile(statePath, raw)

    await expect(loadRemoteEnvironmentState()).rejects.toBeInstanceOf(RemoteEnvironmentStateError)
    expect(await readFile(`${statePath}.recovery`, 'utf8')).toBe(raw)
    if (process.platform !== 'win32') {
      expect((await stat(`${statePath}.recovery`)).mode & 0o777).toBe(0o600)
    }

    await expect(
      updateRemoteEnvironmentState(() => ({ activeId: null, environments: [] })),
    ).rejects.toBeInstanceOf(RemoteEnvironmentStateError)
    expect(await readFile(statePath, 'utf8')).toBe(raw)
  })

  it('preserves and refuses a future document version', async () => {
    const raw = JSON.stringify({ version: 3, activeId: null, environments: [] })
    await writeFile(statePath, raw)

    await expect(loadRemoteEnvironmentState()).rejects.toBeInstanceOf(RemoteEnvironmentStateError)
    expect(await readFile(`${statePath}.recovery`, 'utf8')).toBe(raw)
    expect(await readFile(statePath, 'utf8')).toBe(raw)
  })
})

describe('activeRemoteDaemon', () => {
  it('resolves the active environment to its url+token pair', () => {
    const state = {
      activeId: 'b',
      environments: [
        {
          endpoints: ['http://beelink:43117'],
          id: 'a',
          name: 'Beelink',
          preferredEndpoint: 'http://beelink:43117',
          token: 't1',
          url: 'http://beelink:43117',
        },
        {
          endpoints: ['https://mac.ts.net'],
          id: 'b',
          name: 'Mac',
          preferredEndpoint: 'https://mac.ts.net',
          token: 't2',
          url: 'https://mac.ts.net',
        },
      ],
    }
    expect(activeRemoteDaemon(state)).toEqual({ url: 'https://mac.ts.net', token: 't2' })
  })

  it('returns null when nothing is active', () => {
    const state = {
      activeId: null,
      environments: [
        {
          endpoints: ['http://beelink:43117'],
          id: 'a',
          name: 'Beelink',
          preferredEndpoint: 'http://beelink:43117',
          token: 't1',
          url: 'http://beelink:43117',
        },
      ],
    }
    expect(activeRemoteDaemon(state)).toBeNull()
  })

  it('returns null when activeId dangles', () => {
    const state = {
      activeId: 'gone',
      environments: [
        {
          endpoints: ['http://beelink:43117'],
          id: 'a',
          name: 'Beelink',
          preferredEndpoint: 'http://beelink:43117',
          token: 't1',
          url: 'http://beelink:43117',
        },
      ],
    }
    expect(activeRemoteDaemon(state)).toBeNull()
  })
})

const LAN = 'http://192.168.1.50:43117'
const TAILNET = 'http://100.94.12.3:43117'
const NAMED = 'http://beelink:43117'

const env = (overrides: Partial<RemoteEnvironment> = {}): RemoteEnvironment => ({
  id: 'e1',
  name: 'Beelink',
  url: LAN,
  token: 't',
  endpoints: [LAN, TAILNET],
  preferredEndpoint: LAN,
  ...overrides,
})

describe('endpointKind', () => {
  it('recognizes the tailnet CGNAT range and the RFC1918 ranges', () => {
    expect(endpointKind(TAILNET)).toBe('tailnet')
    expect(endpointKind(LAN)).toBe('lan')
    expect(endpointKind('http://10.0.0.4:43117')).toBe('lan')
    expect(endpointKind('http://172.20.0.4:43117')).toBe('lan')
  })

  it('does not mistake neighbours of 100.64/10 for the tailnet', () => {
    expect(endpointKind('http://100.63.0.1:43117')).toBe('other')
    expect(endpointKind('http://100.128.0.1:43117')).toBe('other')
    // 172.32 is outside 172.16/12 — a classic off-by-one in private-range checks.
    expect(endpointKind('http://172.32.0.1:43117')).toBe('other')
  })

  it('recognizes local and direct MagicDNS hostnames without guessing public HTTPS', () => {
    expect(endpointKind(NAMED)).toBe('other')
    expect(endpointKind('http://beelink.local:43117')).toBe('lan')
    expect(endpointKind('http://beelink.ts.net:43117')).toBe('tailnet')
    expect(endpointKind('https://beelink.ts.net:43117')).toBe('other')
    expect(endpointKind('https://random-words-here.trycloudflare.com')).toBe('other')
    expect(endpointKind('not a url')).toBe('other')
  })
})

describe('orderedEndpoints', () => {
  it('tries LAN before Tailscale even when the last-known-good url is the tailnet', () => {
    expect(orderedEndpoints(env({ url: TAILNET, preferredEndpoint: TAILNET }))).toEqual([
      LAN,
      TAILNET,
    ])
  })

  it('never yields an address the environment no longer knows', () => {
    const stale = env({ url: 'http://192.168.9.9:43117', endpoints: [TAILNET] })
    expect(orderedEndpoints(stale)).toEqual([TAILNET])
  })
})

describe('endpoint edits', () => {
  it('adds an address once', () => {
    expect(withEndpoint(env(), TAILNET).endpoints).toEqual([LAN, TAILNET])
    expect(withEndpoint(env(), NAMED).endpoints).toEqual([LAN, TAILNET, NAMED])
  })

  it('records the live address WITHOUT moving the preference — reachability is not a choice', () => {
    const moved = withActiveUrl(env({ preferredEndpoint: LAN }), TAILNET)
    expect(moved.url).toBe(TAILNET)
    expect(moved.preferredEndpoint).toBe(LAN)
  })

  it('adds an unknown live address to the list rather than dangling', () => {
    expect(withActiveUrl(env({ endpoints: [LAN] }), TAILNET).endpoints).toEqual([LAN, TAILNET])
  })

  it('removes an address and re-points the url when it was the active one', () => {
    const dropped = withoutEndpoint(env({ url: LAN }), LAN)
    expect(dropped.endpoints).toEqual([TAILNET])
    expect(dropped.url).toBe(TAILNET)
  })

  it('selects a remaining endpoint when the primary route is removed', () => {
    expect(withoutEndpoint(env({ preferredEndpoint: LAN }), LAN).preferredEndpoint).toBe(TAILNET)
  })

  it('refuses to remove the last way in', () => {
    const only = env({ endpoints: [LAN] })
    expect(withoutEndpoint(only, LAN)).toEqual(only)
  })
})
