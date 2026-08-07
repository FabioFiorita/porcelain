import { randomUUID } from 'node:crypto'
import { createTRPCUntypedClient, httpLink } from '@trpc/client'
import { initTRPC } from '@trpc/server'
import { BrowserWindow, clipboard, nativeTheme, shell, type WebContents } from 'electron'
import { z } from 'zod'
import {
  getDefaultEnvironmentId,
  localDaemonPair,
  reloadEnvironmentsCache,
  setDefaultEnvironmentId,
  setWindowRemoteEndpoint,
  windowEnvironmentId,
} from './daemon'
import {
  loadLocalTerminalPaths,
  localTerminalPathKey,
  updateLocalTerminalPaths,
} from './local-terminal-paths'
import {
  type EndpointKind,
  endpointKind,
  endpointsOf,
  loadRemoteEnvironmentState,
  normalizeDaemonUrl,
  orderedEndpoints,
  type RemoteEnvironment,
  updateRemoteEnvironmentState,
  withActiveUrl,
  withEndpoint,
  withoutEndpoint,
} from './remote-daemon'
import { SKILLS_VERSION, skillsInstallCommand, skillsUpgradeCommand } from './skills-assets'
import { checkForUpdates, installUpdate, type UpdateStatus, updateStatus } from './updater'
import { createWindow, switchWindowEnvironment, type WindowInit, windowInitFor } from './window'

// The Electron-side half of the router split: everything here needs the shell
// (native dialogs, window management, the updater) or the
// calling window. The pure-Node procedures live in apps/daemon/src/api.ts.
interface ShellTrpcContext {
  sender: WebContents
}
const t = initTRPC.context<ShellTrpcContext>().create({ isServer: true })

const pairingResponseSchema = z.object({
  token: z.string().min(1),
  client: z.object({
    id: z.string(),
    label: z.string(),
    createdAt: z.string(),
  }),
})

async function exchangePairingLink(link: string): Promise<{ url: string; token: string }> {
  let parsed: URL
  try {
    parsed = new URL(link.trim())
  } catch {
    throw new Error('That is not a valid Porcelain connection link')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Connection links must use HTTP or HTTPS')
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error('Connection links cannot contain URL credentials')
  }
  if (parsed.pathname !== '/pair' || parsed.search !== '') {
    throw new Error('That is not a valid Porcelain connection link')
  }
  const credential = new URLSearchParams(parsed.hash.slice(1)).get('token')
  if (credential === null || credential === '') {
    throw new Error('That connection link has no pairing credential')
  }
  parsed.hash = ''
  parsed.search = ''
  parsed.pathname = ''
  const url = normalizeDaemonUrl(parsed.toString())
  let response: Response
  try {
    response = await fetch(`${url}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new Error(`Could not reach the daemon in that connection link`)
  }
  if (response.status === 401) {
    throw new Error('That connection link is expired, already used, or revoked')
  }
  if (!response.ok) throw new Error(`Pairing failed with status ${response.status}`)
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('The daemon returned an invalid pairing response')
  }
  return { url, token: pairingResponseSchema.parse(body).token }
}

/** Thrown by `probeDaemon` when the daemon is reachable but rejects the token. */
class DaemonUnauthorizedError extends Error {}

/**
 * Probe a daemon before pointing windows at it: hit a cheap authed query so we
 * distinguish a wrong/dead url from a rejected token. The token is sent ONLY to
 * the given url (the one the user typed or that we already stored); never log it.
 */
async function probeDaemon(url: string, token: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${url}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new Error(`Could not reach a daemon at ${url}`)
  }
  if (res.status === 401) throw new DaemonUnauthorizedError('The daemon rejected that token (401)')
  if (!res.ok) throw new Error(`The daemon at ${url} responded with ${res.status}`)
}

async function revokeClientCredential(url: string, token: string): Promise<void> {
  const client = createTRPCUntypedClient({
    links: [
      httpLink({
        url: `${url}/trpc`,
        headers: { authorization: `Bearer ${token}` },
      }),
    ],
  })
  await client.mutation('revokeCurrentClient')
}

/** Best-effort cleanup for a pairing credential that failed group verification. */
async function discardTemporaryCredential(url: string, token: string): Promise<void> {
  try {
    await revokeClientCredential(url, token)
  } catch {
    // The endpoint may disappear between pairing and cleanup; never hide the original error.
  }
}

/**
 * How a saved environment is doing right now. `unauthorized` is deliberately NOT
 * folded into `offline`: a box that answers but rejects the token needs a different
 * fix (re-pair) than one that's asleep, and collapsing them sends the human to the
 * wrong remedy.
 */
type EnvironmentState = 'online' | 'unauthorized' | 'offline'

export interface EnvironmentStatus {
  /** null = This device (the local child daemon). */
  id: string | null
  state: EnvironmentState
  /** Which of the environment group's endpoints answered; null when none did. */
  endpoint: string | null
  /** Reported identity; null when the daemon is down or returned an invalid response. */
  host: string | null
  platform: string | null
  version: string | null
}

// tRPC's HTTP GET envelope for a query result. Validated because it's an external
// response — a saved url could be answering with anything.
const daemonInfoResponseSchema = z.object({
  result: z.object({
    data: z.object({
      version: z.string(),
      host: z.string(),
      platform: z.string(),
      arch: z.string(),
    }),
  }),
})

// Short enough that a sleeping box doesn't stall the switcher behind the app's own
// boot, long enough for a tailnet round-trip on a phone hotspot.
const STATUS_PROBE_TIMEOUT_MS = 4000

const UNKNOWN_IDENTITY = { host: null, platform: null, version: null }

/**
 * Ask one daemon who it is. Never throws — a switcher row must render for an
 * environment that is asleep, and an unreachable box is a *state*, not an error.
 */
async function probeEnvironment(
  url: string,
  token: string,
): Promise<Omit<EnvironmentStatus, 'id' | 'endpoint'>> {
  const authed = { authorization: `Bearer ${token}` }
  let res: Response
  try {
    res = await fetch(`${url}/trpc/daemonInfo`, {
      headers: authed,
      signal: AbortSignal.timeout(STATUS_PROBE_TIMEOUT_MS),
    })
  } catch {
    return { state: 'offline', ...UNKNOWN_IDENTITY }
  }
  if (res.status === 401) return { state: 'unauthorized', ...UNKNOWN_IDENTITY }

  if (!res.ok) return { state: 'offline', ...UNKNOWN_IDENTITY }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { state: 'offline', ...UNKNOWN_IDENTITY }
  }
  const parsed = daemonInfoResponseSchema.safeParse(body)
  if (!parsed.success) return { state: 'offline', ...UNKNOWN_IDENTITY }
  const info = parsed.data.result.data
  return {
    state: 'online',
    host: info.host,
    platform: info.platform,
    version: info.version,
  }
}

/** Probe a group's endpoints sequentially; unauthorized is shared by every route. */
async function probeEnvironmentEndpoints(
  env: RemoteEnvironment,
): Promise<Omit<EnvironmentStatus, 'id'>> {
  let firstFailure: Omit<EnvironmentStatus, 'id' | 'endpoint'> | null = null
  for (const url of orderedEndpoints(env)) {
    const status = await probeEnvironment(url, env.token)
    if (status.state === 'online') return { ...status, endpoint: url }
    if (status.state === 'unauthorized') return { ...status, endpoint: null }
    firstFailure ??= status
  }
  return { ...(firstFailure ?? { state: 'offline', ...UNKNOWN_IDENTITY }), endpoint: null }
}

/**
 * Find an endpoint of this environment that answers, in preference order. Sequential on
 * purpose, unlike `environmentStatuses`' parallel fan-out: these are the same machine, so
 * racing would just pick whichever route replied first — on the home LAN often the slower
 * tailnet address. Preference decides; reachability only breaks ties. The probe is the
 * authed `recentRepos` hit `probeDaemon` uses, so a live box that rejects the token fails
 * fast instead of being retried on every address. Null when nothing answered; never throws.
 */
async function resolveLiveEndpoint(env: RemoteEnvironment): Promise<string | null> {
  for (const url of orderedEndpoints(env)) {
    try {
      await probeDaemon(url, env.token)
      return url
    } catch (error) {
      // A rejected token is the same on every address — re-probing the rest is pointless
      // and only delays the error the human needs to see.
      if (error instanceof DaemonUnauthorizedError) return null
    }
  }
  return null
}

/**
 * Is `url` the same machine as an environment we already have? Proven by the environment's
 * OWN credential authenticating there — a self-reported hostname is a label, not an
 * identity, and this is the guard that keeps two machines' addresses out of one entry (and
 * therefore one machine's token off another machine's wire). Never throws.
 */
async function sameMachine(url: string, env: RemoteEnvironment): Promise<boolean> {
  try {
    await probeDaemon(url, env.token)
    return true
  } catch {
    return false
  }
}

/** Persist the live endpoint and re-point open windows bound to this group. */
async function refreshActiveEndpoint(id: string): Promise<string | null> {
  const env = (await loadRemoteEnvironmentState()).environments.find((e) => e.id === id)
  if (env === undefined) return null
  const live = await resolveLiveEndpoint(env)
  if (live === null || live === env.url) return live
  // Re-read inside the serializer so a concurrent add/remove is preserved.
  await updateRemoteEnvironmentState((state) => ({
    ...state,
    environments: state.environments.map((e) =>
      e.id === id && e.endpoints.includes(live) ? withActiveUrl(e, live) : e,
    ),
  }))
  const refreshed = await reloadEnvironmentsCache()
  if (refreshed.environments.some((e) => e.id === id && e.endpoints.includes(live))) {
    setWindowRemoteEndpoint(id, { token: env.token, url: live })
  }
  return live
}

export const shellRouter = t.router({
  windowInit: t.procedure.query(async ({ ctx }): Promise<WindowInit> => {
    const environmentId = windowEnvironmentId(ctx.sender)
    if (environmentId !== null) {
      try {
        await refreshActiveEndpoint(environmentId)
      } catch {}
    }
    return windowInitFor(ctx.sender)
  }),

  refreshRemoteEnvironment: t.procedure.query(async ({ ctx }): Promise<void> => {
    const environmentId = windowEnvironmentId(ctx.sender)
    if (environmentId !== null) await refreshActiveEndpoint(environmentId)
  }),
  /**
   * The LOCAL child daemon's pair, plus whether this window is already bound to it.
   * Handing the renderer the local token is not a widening — the preload already gives
   * it to every LOCAL-bound window, and an Electron window always loads our own dist from
   * disk (the audit skill records what would break that). It exists so a remote-bound
   * window can ALSO open a terminal here: repo on the Beelink, simulator on this Mac.
   * `isLocal` hides the affordance when the window is already local.
   */
  localDaemon: t.procedure.query(({ ctx }): { url: string; token: string; isLocal: boolean } => ({
    ...localDaemonPair(),
    isLocal: windowEnvironmentId(ctx.sender) === null,
  })),

  /**
   * The local directory a "This device" terminal should open in for `repoPath` on THIS
   * window's environment, or null when the human hasn't mapped it yet (the UI then asks).
   */
  localTerminalPath: t.procedure
    .input(z.object({ repoPath: z.string() }))
    .query(async ({ ctx, input }): Promise<string | null> => {
      const state = await loadLocalTerminalPaths()
      const key = localTerminalPathKey(windowEnvironmentId(ctx.sender), input.repoPath)
      return state.paths[key] ?? null
    }),

  /** Remember (or, with an empty path, forget) the local cwd for a repo on this environment. */
  setLocalTerminalPath: t.procedure
    .input(z.object({ repoPath: z.string(), localPath: z.string() }))
    .mutation(async ({ ctx, input }): Promise<void> => {
      const key = localTerminalPathKey(windowEnvironmentId(ctx.sender), input.repoPath)
      const localPath = input.localPath.trim()
      await updateLocalTerminalPaths((state) => {
        const paths = { ...state.paths }
        if (localPath === '') delete paths[key]
        else paths[key] = localPath
        return { paths }
      })
    }),

  // Frameless-chrome window controls (Linux/Windows): the renderer draws its own
  // min/maximize/close cluster, so these act on the CALLING window via
  // BrowserWindow.fromWebContents(ctx.sender) — the sanctioned per-call handle to
  // a shell procedure's own window, same as windowInit. Each null-guards (a window
  // mid-teardown can return null). macOS keeps native traffic lights and never
  // calls these.
  windowMinimize: t.procedure.mutation(({ ctx }) => {
    BrowserWindow.fromWebContents(ctx.sender)?.minimize()
  }),

  windowToggleMaximize: t.procedure.mutation(({ ctx }) => {
    const window = BrowserWindow.fromWebContents(ctx.sender)
    if (window === null) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  }),

  windowClose: t.procedure.mutation(({ ctx }) => {
    BrowserWindow.fromWebContents(ctx.sender)?.close()
  }),

  windowIsMaximized: t.procedure.query(
    ({ ctx }): boolean => BrowserWindow.fromWebContents(ctx.sender)?.isMaximized() ?? false,
  ),

  newWindow: t.procedure
    .input(
      z
        .object({
          repoPath: z.string().optional(),
          // Omit = inherit the calling window's environment (so "open in new
          // window" on a remote stays on that remote). Pass null for local.
          environmentId: z.string().nullable().optional(),
        })
        .optional(),
    )
    .mutation(({ ctx, input }) => {
      const environmentId =
        input?.environmentId !== undefined ? input.environmentId : windowEnvironmentId(ctx.sender)
      createWindow(
        input?.repoPath
          ? { mode: 'open', repoPath: input.repoPath, environmentId }
          : { mode: 'welcome', environmentId },
      )
    }),

  // Keep the OS chrome in step with the renderer's appearance: set the native
  // theme source (drives macOS traffic lights / native menus / scrollbars) and
  // repaint every window's backgroundColor so a theme switch never flashes the
  // stale color behind the renderer. The renderer sends its RESOLVED mode
  // ('light'/'dark') on every change; 'system' is accepted too (nativeTheme's
  // own type) and falls back to shouldUseDarkColors. Dark #090b0c / light
  // #ffffff match the `--background` tokens (window.ts keeps #090b0c as boot
  // default). nativeTheme is used only here — keep it contained.
  setThemeSource: t.procedure.input(z.enum(['system', 'light', 'dark'])).mutation(({ input }) => {
    nativeTheme.themeSource = input
    const dark = input === 'system' ? nativeTheme.shouldUseDarkColors : input === 'dark'
    const backgroundColor = dark ? '#090b0c' : '#ffffff'
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.setBackgroundColor(backgroundColor)
    }
  }),

  revealInFinder: t.procedure.input(z.string()).mutation(({ input }) => {
    shell.showItemInFolder(input)
  }),

  // Electron's own clipboard, not the web Clipboard API: the terminal pane's paste-image
  // chord (Cmd/Ctrl+Shift+V) needs this to work regardless of secure-context, and it's the
  // more reliable of the two on desktop. A mutation, not a query — TanStack caches a
  // query's result, which would replay the FIRST screenshot on every later paste.
  readClipboardImage: t.procedure.mutation(() => {
    const image = clipboard.readImage()
    if (image.isEmpty()) return null
    return { dataBase64: image.toPNG().toString('base64'), mime: 'image/png' as const }
  }),

  updateStatus: t.procedure.query((): UpdateStatus => updateStatus()),

  checkForUpdates: t.procedure.mutation(() => checkForUpdates()),

  installUpdate: t.procedure.mutation(() => {
    installUpdate()
  }),

  // Skills are distributed via skills.sh (`npx skills add FabioFiorita/porcelain -g`).
  // The app does not install them directly; it only tells the user the command and
  // tracks the bundled skills version to prompt for `npx skills upgrade -g`.
  skillsInfo: t.procedure.query(
    (): { version: string; installCommand: string; upgradeCommand: string } => ({
      version: SKILLS_VERSION,
      installCommand: skillsInstallCommand(),
      upgradeCommand: skillsUpgradeCommand(),
    }),
  ),

  // Tokens stay in the shell; the renderer receives group names and verified routes only.
  remoteEnvironments: t.procedure.query(
    async ({
      ctx,
    }): Promise<{
      activeId: string | null
      defaultId: string | null
      environments: {
        id: string
        name: string
        url: string
        /** Every verified address for this machine, with its derived kind. */
        endpoints: { url: string; kind: EndpointKind; preferred: boolean }[]
      }[]
    }> => {
      const state = await loadRemoteEnvironmentState()
      return {
        activeId: windowEnvironmentId(ctx.sender),
        defaultId: state.activeId,
        environments: state.environments.map((env) => ({
          id: env.id,
          name: env.name,
          url: env.url,
          endpoints: endpointsOf(env).map((url) => ({
            url,
            kind: endpointKind(url),
            preferred: env.preferredEndpoint === url,
          })),
        })),
      }
    },
  ),

  /** Live state for This device and every group; group probes run in parallel. */
  environmentStatuses: t.procedure.query(async (): Promise<EnvironmentStatus[]> => {
    const state = await loadRemoteEnvironmentState()
    const local = localDaemonPair()
    const [localStatus, ...remoteStatuses] = await Promise.all([
      probeEnvironment(local.url, local.token).then((status) => ({
        ...status,
        endpoint: local.url,
      })),
      ...state.environments.map(probeEnvironmentEndpoints),
    ])
    // Heal routes on focus, keyed by group id through the serializer.
    const healed = new Map(
      state.environments
        .map((env, index) => [env.id, remoteStatuses[index]?.endpoint ?? null] as const)
        .filter(([, endpoint]) => endpoint !== null),
    )
    if (healed.size > 0) {
      await updateRemoteEnvironmentState((current) => ({
        ...current,
        environments: current.environments.map((env) => {
          const endpoint = healed.get(env.id)
          return endpoint === undefined ||
            endpoint === null ||
            endpoint === env.url ||
            !env.endpoints.includes(endpoint)
            ? env
            : withActiveUrl(env, endpoint)
        }),
      }))
      const refreshed = await reloadEnvironmentsCache()
      for (const env of refreshed.environments) {
        const endpoint = healed.get(env.id)
        if (endpoint !== undefined && endpoint !== null && env.endpoints.includes(endpoint)) {
          setWindowRemoteEndpoint(env.id, { token: env.token, url: endpoint })
        }
      }
    }
    return [
      { id: null, ...localStatus },
      ...remoteStatuses.map((status, index) => ({
        id: state.environments[index]?.id ?? null,
        ...status,
      })),
    ]
  }),

  pairEnvironmentConnection: t.procedure
    .input(
      z.object({
        connectionLink: z.string(),
        /** Add this endpoint to an existing group instead of creating a new group. */
        groupId: z.string().nullable().optional(),
        /** Point THIS window at the resulting group and reload it when true. */
        connectThisWindow: z.boolean().optional(),
      }),
    )
    .mutation(
      async ({ ctx, input }): Promise<{ id: string; reloaded: boolean; merged: boolean }> => {
        const { url, token } = await exchangePairingLink(input.connectionLink)
        await probeDaemon(url, token)
        const { host } = await probeEnvironment(url, token)

        if (input.groupId !== undefined && input.groupId !== null) {
          const group = (await loadRemoteEnvironmentState()).environments.find(
            (env) => env.id === input.groupId,
          )
          if (group === undefined) {
            await discardTemporaryCredential(url, token)
            throw new Error('That environment group no longer exists')
          }
          if (!(await sameMachine(url, group))) {
            await discardTemporaryCredential(url, token)
            throw new Error('That connection does not belong to the selected environment')
          }

          // The existing group credential proved the endpoint belongs to this daemon. Keep
          // one credential for the group and remove the one-shot pairing credential immediately.
          await revokeClientCredential(url, token)
          await updateRemoteEnvironmentState((state) => ({
            ...state,
            environments: state.environments.map((env) =>
              env.id === group.id ? withEndpoint(env, url) : env,
            ),
          }))
          await reloadEnvironmentsCache()
          const connectGroup = input.connectThisWindow === true
          if (connectGroup) switchWindowEnvironment(ctx.sender, group.id)
          return { id: group.id, reloaded: connectGroup, merged: true }
        }

        // A reported host only nominates a group; its existing credential must authenticate
        // at the new URL before the endpoint is merged.
        if (host !== null && host !== '') {
          const twin = (await loadRemoteEnvironmentState()).environments.find(
            (env) => env.host === host,
          )
          if (twin !== undefined && (await sameMachine(url, twin))) {
            // The twin's token is kept: we proved it works at this address. Revoke the
            // newly issued credential before merging so repeated endpoint discovery never
            // leaves an invisible authorized-device entry behind.
            await revokeClientCredential(url, token)
            await updateRemoteEnvironmentState((state) => ({
              ...state,
              activeId: twin.id,
              environments: state.environments.map((env) =>
                env.id === twin.id ? withActiveUrl(withEndpoint(env, url), url) : env,
              ),
            }))
            await reloadEnvironmentsCache()
            const connectTwin = input.connectThisWindow !== false
            if (connectTwin) switchWindowEnvironment(ctx.sender, twin.id)
            return { id: twin.id, reloaded: connectTwin, merged: true }
          }
        }

        // Name it after the daemon's reported host, falling back to the URL hostname.
        let name = host ?? ''
        if (name === '') {
          try {
            name = new URL(url).hostname || url
          } catch {
            name = url
          }
        }

        const id = randomUUID()
        await updateRemoteEnvironmentState((state) => ({
          ...state,
          // New env becomes the default for future bare New Window / app restore.
          activeId: id,
          environments: [
            ...state.environments,
            {
              id,
              name,
              url,
              token,
              endpoints: [url],
              preferredEndpoint: url,
              ...(host !== null && host !== '' ? { host } : {}),
            },
          ],
        }))
        await reloadEnvironmentsCache()

        const connectThis = input.connectThisWindow !== false
        if (connectThis) {
          // Reloads THIS window onto the new env (welcome page of that daemon).
          switchWindowEnvironment(ctx.sender, id)
        }
        return { id, reloaded: connectThis, merged: false }
      },
    ),

  removeEnvironmentEndpoint: t.procedure
    .input(z.object({ id: z.string(), url: z.string() }))
    .mutation(async ({ input }): Promise<void> => {
      await updateRemoteEnvironmentState((state) => ({
        ...state,
        environments: state.environments.map((e) =>
          e.id === input.id ? withoutEndpoint(e, input.url) : e,
        ),
      }))
      await reloadEnvironmentsCache()
    }),

  /** Pin one exact route; failover still tries the remaining routes. */
  preferEnvironmentEndpoint: t.procedure
    .input(z.object({ id: z.string(), url: z.string() }))
    .mutation(async ({ input }): Promise<void> => {
      await updateRemoteEnvironmentState((state) => ({
        ...state,
        environments: state.environments.map((e) =>
          e.id === input.id && e.endpoints.includes(input.url)
            ? { ...e, preferredEndpoint: input.url }
            : e,
        ),
      }))
      await reloadEnvironmentsCache()
    }),

  /** Point THIS window at a saved environment (other windows untouched). */
  connectRemoteEnvironment: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }): Promise<void> => {
      // Try every known endpoint in preference order before reporting the group down.
      const live = await refreshActiveEndpoint(input.id)
      const state = await loadRemoteEnvironmentState()
      const env = state.environments.find((e) => e.id === input.id)
      if (env === undefined) throw new Error('That environment no longer exists')

      // The walk already probed every address; re-probing the winner is a wasted round trip
      // and re-probing a dead environment doubles a wait that is already seconds long. Only
      // probe when the walk found nothing — that call is purely to raise the real error.
      if (live === null) await probeDaemon(env.url, env.token)
      // Remember as default for new windows / app restore.
      await updateRemoteEnvironmentState((current) => ({ ...current, activeId: env.id }))
      await reloadEnvironmentsCache()
      // Main-process reload onto the remote (welcome) — see switchWindowEnvironment.
      switchWindowEnvironment(ctx.sender, env.id)
    }),

  /** Point THIS window back at the local child (other windows untouched). */
  disconnectRemoteEnvironment: t.procedure.mutation(async ({ ctx }): Promise<void> => {
    // Only clear the default when THIS window was on it — leave other windows' defaults alone.
    if (getDefaultEnvironmentId() === windowEnvironmentId(ctx.sender)) {
      await setDefaultEnvironmentId(null)
    } else {
      await reloadEnvironmentsCache()
    }
    // Main-process reload onto This device (welcome) — renderer must not also reload.
    switchWindowEnvironment(ctx.sender, null)
  }),

  /**
   * Open a fresh window on an environment without touching the caller's binding.
   * `environmentId: null` = This device (local).
   */
  openWindowInEnvironment: t.procedure
    .input(
      z.object({
        environmentId: z.string().nullable(),
        repoPath: z.string().optional(),
      }),
    )
    .mutation(({ input }) => {
      createWindow(
        input.repoPath
          ? { mode: 'open', repoPath: input.repoPath, environmentId: input.environmentId }
          : { mode: 'welcome', environmentId: input.environmentId },
      )
    }),

  removeRemoteEnvironment: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }): Promise<{ wasActive: boolean; reloaded: boolean }> => {
      const wasThisWindow = windowEnvironmentId(ctx.sender) === input.id
      await updateRemoteEnvironmentState((state) => ({
        activeId: state.activeId === input.id ? null : state.activeId,
        environments: state.environments.filter((e) => e.id !== input.id),
      }))
      await reloadEnvironmentsCache()
      // Any open window on the removed env falls back to local + welcome and is
      // reloaded here (including the caller's window). Renderer onSuccess must
      // NOT reload again when wasActive — main-process already did.
      for (const window of BrowserWindow.getAllWindows()) {
        if (window.isDestroyed()) continue
        if (windowEnvironmentId(window.webContents) === input.id) {
          switchWindowEnvironment(window.webContents, null)
        }
      }
      return { wasActive: wasThisWindow, reloaded: wasThisWindow }
    }),
})

export type ShellRouter = typeof shellRouter
