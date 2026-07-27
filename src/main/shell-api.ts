import { randomUUID } from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { BrowserWindow, nativeTheme, shell, type WebContents } from 'electron'
import { z } from 'zod'
import {
  getDefaultEnvironmentId,
  localDaemonPair,
  reloadEnvironmentsCache,
  setDefaultEnvironmentId,
  windowEnvironmentId,
} from './daemon'
import {
  loadRemoteEnvironmentState,
  normalizeDaemonUrl,
  saveRemoteEnvironmentState,
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
): Promise<Omit<EnvironmentStatus, 'id'>> {
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

export const shellRouter = t.router({
  windowInit: t.procedure.query(({ ctx }): WindowInit => windowInitFor(ctx.sender)),

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

  // Skills are distributed via skills.sh (`npx skills add FabioFiorita/porcelain`).
  // The app does not install them directly; it only tells the user the command and
  // tracks the bundled skills version to prompt for `npx skills upgrade`.
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
      environments: { id: string; name: string; url: string }[]
    }> => {
      const state = await loadRemoteEnvironmentState()
      return {
        activeId: windowEnvironmentId(ctx.sender),
        defaultId: state.activeId,
        environments: state.environments.map(({ id, name, url }) => ({ id, name, url })),
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
      probeEnvironment(local.url, local.token),
      ...state.environments.map((env) => probeEnvironment(env.url, env.token)),
    ])
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
    .mutation(async ({ ctx, input }): Promise<{ id: string; reloaded: boolean }> => {
      const url = normalizeDaemonUrl(input.url)
      await probeDaemon(url, input.token)

      // Name it after the machine, not the address. The daemon reports its own host
      // (daemon-identity.ts), so leaving the field blank yields "beelink" rather than
      // "100.94.12.3" — the whole point of phase 1. Falls back to the url's hostname
      // for a daemon too old to announce identity.
      let name = input.name.trim()
      if (name === '') {
        const { host } = await probeEnvironment(url, input.token)
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
      const state = await loadRemoteEnvironmentState()
      state.environments.push({ id, name, url, token: input.token })
      // New env becomes the default for future bare New Window / app restore.
      state.activeId = id
      await saveRemoteEnvironmentState(state)
      await reloadEnvironmentsCache()

      const connectThis = input.connectThisWindow !== false
      if (connectThis) {
        // Reloads THIS window onto the new env (welcome page of that daemon).
        switchWindowEnvironment(ctx.sender, id)
      }
      return { id, reloaded: connectThis }
    }),

  /** Point THIS window at a saved environment (other windows untouched). */
  connectRemoteEnvironment: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }): Promise<void> => {
      const state = await loadRemoteEnvironmentState()
      const env = state.environments.find((e) => e.id === input.id)
      if (env === undefined) throw new Error('That environment no longer exists')

      await probeDaemon(env.url, env.token)
      // Remember as default for new windows / app restore.
      state.activeId = env.id
      await saveRemoteEnvironmentState(state)
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
      const state = await loadRemoteEnvironmentState()
      const wasDefault = state.activeId === input.id
      const wasThisWindow = windowEnvironmentId(ctx.sender) === input.id
      state.environments = state.environments.filter((e) => e.id !== input.id)
      if (wasDefault) {
        state.activeId = null
      }
      await saveRemoteEnvironmentState(state)
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
