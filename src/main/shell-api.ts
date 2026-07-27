import { randomUUID } from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { BrowserWindow, nativeTheme, shell, type WebContents } from 'electron'
import { z } from 'zod'
import {
  adoptRotatedToken,
  getDefaultEnvironmentId,
  localDaemonPair,
  reloadEnvironmentsCache,
  setDefaultEnvironmentId,
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
// calling window. The pure-Node procedures live in src/backend/api.ts.
export interface ShellTrpcContext {
  sender: WebContents
}
const t = initTRPC.context<ShellTrpcContext>().create({ isServer: true })

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
  if (res.status === 401) throw new Error('The daemon rejected that token (401)')
  if (!res.ok) throw new Error(`The daemon at ${url} responded with ${res.status}`)
}

/**
 * How a saved environment is doing right now. `unauthorized` is deliberately NOT
 * folded into `offline`: a box that answers but rejects the token needs a different
 * fix (re-pair) than one that's asleep, and collapsing them sends the human to the
 * wrong remedy.
 */
export type EnvironmentState = 'online' | 'unauthorized' | 'offline'

export interface EnvironmentStatus {
  /** null = This device (the local child daemon). */
  id: string | null
  state: EnvironmentState
  /** Which of the environment's endpoints answered; null when none did (phase 5). */
  endpoint: string | null
  /** Reported identity; null when the daemon is too old to announce it, or is down. */
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
      // Optional: a daemon older than the identity widening returns version alone.
      host: z.string().optional(),
      platform: z.string().optional(),
      arch: z.string().optional(),
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
 *
 * The old-daemon path is the subtle one: `daemonInfo` doesn't exist before 0.30, so
 * that url answers 404 while being a perfectly reachable Porcelain daemon. Falling
 * straight to `offline` there would grey out a working environment, so a non-401
 * failure re-probes with `recentRepos` (which every daemon has) and reports `online`
 * with an unknown identity.
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

  if (!res.ok) {
    // Reachable, but this procedure is missing (pre-0.30) or erroring. Confirm it's
    // really a live daemon before claiming online.
    try {
      await probeDaemon(url, token)
      return { state: 'online', ...UNKNOWN_IDENTITY }
    } catch {
      return { state: 'offline', ...UNKNOWN_IDENTITY }
    }
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { state: 'online', ...UNKNOWN_IDENTITY }
  }
  const parsed = daemonInfoResponseSchema.safeParse(body)
  if (!parsed.success) return { state: 'online', ...UNKNOWN_IDENTITY }
  const info = parsed.data.result.data
  return {
    state: 'online',
    host: info.host ?? null,
    platform: info.platform ?? null,
    version: info.version,
  }
}

/**
 * Status for an environment across ALL its endpoints (phase 5). Sequential within one
 * environment (same machine — see `resolveLiveEndpoint`) but the caller fans environments
 * out in parallel, so the worst case is one sleeping machine's endpoints, not everyone's.
 *
 * `unauthorized` short-circuits: the token is the same on every address, so re-probing the
 * rest would just spend four seconds each to learn the same thing.
 */
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
 * Find an endpoint of this environment that answers, in preference order (phase 5).
 *
 * Sequential on purpose, unlike `environmentStatuses`' parallel fan-out: these are the same
 * machine, so racing them would just pick whichever route replied first — which on the home
 * LAN is often the tailnet address, the slower one. Preference decides; reachability only
 * breaks ties. The probe is the same authed `recentRepos` hit `probeDaemon` uses, so a live
 * box that rejects the token still fails fast rather than being retried on every address.
 *
 * Returns null when nothing answered. Never throws — callers decide what a dead environment
 * means for them.
 */
async function resolveLiveEndpoint(env: RemoteEnvironment): Promise<string | null> {
  for (const url of orderedEndpoints(env)) {
    try {
      await probeDaemon(url, env.token)
      return url
    } catch (error) {
      // A rejected token is the same on every address — re-probing the rest is pointless
      // and only delays the error the human needs to see.
      if (error instanceof Error && error.message.includes('401')) return null
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

/**
 * Point an environment at whichever endpoint answered and persist it, so the next window
 * binds straight to the live address. Returns the url to use (the live one, or the stored
 * one when nothing answered — the caller's own probe then produces the real error message).
 */
async function refreshActiveEndpoint(id: string): Promise<string | null> {
  const env = (await loadRemoteEnvironmentState()).environments.find((e) => e.id === id)
  if (env === undefined) return null
  const live = await resolveLiveEndpoint(env)
  if (live === null || live === env.url) return live
  // Re-read inside the serializer: the probe above took seconds, and an add/remove that
  // landed meanwhile must not be undone by a stale snapshot.
  await updateRemoteEnvironmentState((state) => ({
    ...state,
    environments: state.environments.map((e) => (e.id === id ? withActiveUrl(e, live) : e)),
  }))
  await reloadEnvironmentsCache()
  return live
}

export const shellRouter = t.router({
  windowInit: t.procedure.query(({ ctx }): WindowInit => windowInitFor(ctx.sender)),

  /**
   * The LOCAL child daemon's pair, plus whether this window is already bound to it.
   *
   * Handing the renderer the local token is not a widening: the preload already gives it
   * to every LOCAL-bound window (`window.porcelain.daemon.token`), and an Electron window
   * always loads our own renderer dist from disk (`loadFile` in window.ts) — never a
   * remote daemon's HTML — so a remote-bound window is running exactly the same trusted
   * code on the same machine. It exists so that window can ALSO open a terminal here: the
   * repo is on the Beelink, but the iOS simulator is on this Mac. `isLocal` lets the UI
   * hide the whole affordance when the window is already local, where it would just be a
   * second way to spawn the same shell. The browser client never reaches this — the shell
   * router throws there — which is correct: an iPad has no local daemon.
   */
  localDaemon: t.procedure.query(({ ctx }): { url: string; token: string; isLocal: boolean } => ({
    ...localDaemonPair(),
    isLocal: windowEnvironmentId(ctx.sender) === null,
  })),

  /**
   * After the bound daemon's Revoke all rotation: adopt the new shared token so THIS
   * window (and local siblings, when the child rotated) keep working. Other clients
   * that still hold the old token are intentionally cut off.
   */
  adoptRotatedToken: t.procedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }): Promise<void> => {
      await adoptRotatedToken(ctx.sender, input.token)
    }),

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

  // Saved remote environments (remote-envs Phase 4 → per-window 2026-07): keep a
  // list of other machines' Porcelain daemons. Each WINDOW picks its own
  // environment (local child always running underneath). Tokens are deliberately
  // NOT returned to the renderer — the bound one already reaches the window via
  // the preload daemon getter; the settings UI only needs name + url.
  // `activeId` in the response is THIS window's binding (not a process-global).
  // Switching reloads only the calling window (see use-remote-daemon).
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
        /** Every known address for this machine, with its derived kind (phase 5). */
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
            preferred: env.preferredKind !== undefined && endpointKind(url) === env.preferredKind,
          })),
        })),
      }
    },
  ),

  /**
   * Live state + reported identity for This device and every saved environment, in
   * that order (local first, then `remoteEnvironments` order) so the switcher renders
   * one list without a second join.
   *
   * Probes fan out in parallel with a short timeout, so the slowest sleeping box
   * bounds the query instead of summing. It IS a network call per environment —
   * the consuming hook throttles it (see use-environment-status); don't call it
   * per render or drop its staleTime chasing freshness.
   */
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
    // Self-heal: this query runs on focus, so a machine that moved networks since the last
    // switch is already pointing at the live address by the time the human clicks it.
    // Keyed BY ID through the serializer, never by index into `state` — the probes above
    // took seconds, and an environment added or removed meanwhile would otherwise be
    // clobbered by this snapshot (a removed one would come back, token and all).
    const healed = new Map(
      state.environments
        .map((env, index) => [env.id, remoteStatuses[index].endpoint] as const)
        .filter(([, endpoint]) => endpoint !== null),
    )
    if (healed.size > 0) {
      await updateRemoteEnvironmentState((current) => ({
        ...current,
        environments: current.environments.map((env) => {
          const endpoint = healed.get(env.id)
          return endpoint === undefined || endpoint === null || endpoint === env.url
            ? env
            : withActiveUrl(env, endpoint)
        }),
      }))
      await reloadEnvironmentsCache()
    }
    return [
      { id: null, ...localStatus },
      ...remoteStatuses.map((status, index) => ({ id: state.environments[index].id, ...status })),
    ]
  }),

  addRemoteEnvironment: t.procedure
    .input(
      z.object({
        name: z.string(),
        url: z.string(),
        token: z.string(),
        /** When true (default), point THIS window at the new env and reload it. */
        connectThisWindow: z.boolean().optional(),
      }),
    )
    .mutation(
      async ({ ctx, input }): Promise<{ id: string; reloaded: boolean; merged: boolean }> => {
        const url = normalizeDaemonUrl(input.url)
        await probeDaemon(url, input.token)
        const { host } = await probeEnvironment(url, input.token)

        // ONE IDENTITY, MANY ENDPOINTS (phase 5). Pairing the same machine a second time —
        // over the LAN at home after doing it over the tailnet away — used to produce two
        // rows with the same name and no hint that they were one box. If this address is
        // the SAME MACHINE as one we already saved, it joins that environment instead.
        //
        // "Same machine" is NOT the reported hostname alone: that's a short label
        // (`shortHostname`), and `ubuntu` / `raspberrypi` / `MacBook-Pro` collide constantly
        // with no malice involved. A wrong merge would put two boxes' addresses in one entry
        // and then send one box's token to the other's address — exactly what the entry
        // boundary exists to prevent. So the host match only NOMINATES a twin; the proof is
        // that the twin's existing credential also authenticates at this new address. If it
        // doesn't, we make a separate environment: a duplicate row is a cosmetic annoyance,
        // a merged pair of machines is a leaked credential.
        if (host !== null && host !== '') {
          const twin = (await loadRemoteEnvironmentState()).environments.find(
            (env) => env.host === host,
          )
          if (twin !== undefined && (await sameMachine(url, twin))) {
            // The twin's token is kept, not replaced: it already works at this address (we
            // just proved it), and overwriting it would discard a credential the OTHER
            // endpoints may be the only ones still using.
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

        // Name it after the machine, not the address. The daemon reports its own host
        // (daemon-identity.ts), so leaving the field blank yields "beelink" rather than
        // "100.94.12.3" — the whole point of phase 1. Falls back to the url's hostname
        // for a daemon too old to announce identity.
        let name = input.name.trim()
        if (name === '') {
          name = host ?? ''
        }
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
              token: input.token,
              endpoints: [url],
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

  /**
   * Teach an existing environment another way in (phase 5) — the manual counterpart to the
   * identity merge in `addRemoteEnvironment`, for a machine whose daemon is too old to
   * report a host, or an address the human knows about before ever connecting over it.
   * Probed with the environment's OWN token before it is saved, so a typo can't silently
   * become a dead endpoint the failover walk wastes four seconds on — AND, when both sides
   * report a host, the answering daemon must BE this machine. Without that check one wrong
   * digit would persist a stranger's address inside the entry, and every later failover
   * walk and status refresh would re-send this environment's token to it. The first probe
   * is unavoidable (you cannot authenticate before authenticating); persisting the mistake
   * is not.
   */
  addEnvironmentEndpoint: t.procedure
    .input(z.object({ id: z.string(), url: z.string() }))
    .mutation(async ({ input }): Promise<void> => {
      const url = normalizeDaemonUrl(input.url)
      const env = (await loadRemoteEnvironmentState()).environments.find((e) => e.id === input.id)
      if (env === undefined) throw new Error('That environment no longer exists')
      await probeDaemon(url, env.token)
      const { host } = await probeEnvironment(url, env.token)
      if (env.host !== undefined && host !== null && host !== env.host) {
        throw new Error(`That address answered as "${host}", not "${env.host}"`)
      }
      await updateRemoteEnvironmentState((state) => ({
        ...state,
        environments: state.environments.map((e) => (e.id === input.id ? withEndpoint(e, url) : e)),
      }))
      await reloadEnvironmentsCache()
    }),

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

  /**
   * Pin which KIND of address this environment prefers — the setting that survives a
   * network change, unlike pinning the address itself (a DHCP lease is not a preference).
   * Failover still applies: preferring the LAN just means try it first, not only.
   */
  preferEnvironmentEndpoint: t.procedure
    .input(z.object({ id: z.string(), url: z.string() }))
    .mutation(async ({ input }): Promise<void> => {
      await updateRemoteEnvironmentState((state) => ({
        ...state,
        environments: state.environments.map((e) =>
          e.id === input.id ? { ...e, preferredKind: endpointKind(input.url) } : e,
        ),
      }))
      await reloadEnvironmentsCache()
    }),

  /** Point THIS window at a saved environment (other windows untouched). */
  connectRemoteEnvironment: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }): Promise<void> => {
      // Failover first (phase 5): the saved LAN address is unreachable from a café, so try
      // every known endpoint in preference order before telling the human it's down. It
      // persists the winner, so re-read the state afterwards rather than before.
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
