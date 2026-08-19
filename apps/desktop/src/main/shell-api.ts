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
import { daemonHeaders } from './daemon-headers'
import {
  loadLocalTerminalPaths,
  localTerminalPathKey,
  updateLocalTerminalPaths,
} from './local-terminal-paths'
import {
  PLUGIN_VERSION,
  pluginInstallCommand,
  pluginMarketplaceCommands,
  pluginUpdateCommands,
} from './plugin-assets'
import {
  type EndpointKind,
  endpointKind,
  endpointsOf,
  loadRemoteEnvironmentState,
  orderedEndpoints,
  type RemoteEnvironment,
  updateRemoteEnvironmentState,
  withActiveUrl,
  withEndpoint,
  withoutEndpoint,
} from './remote-daemon'
import { readProjectActions } from './shell-actions'
import { probeEnvironment, readEnvironmentStatuses } from './shell-environments'
import { readHubInventories } from './shell-hub-inventory'
import { exchangePairingLink } from './shell-pairing'
import {
  environmentTaskMutationInput,
  environmentTasks,
  mutateEnvironmentTask,
} from './shell-tasks'
import { checkForUpdates, installUpdate, type UpdateStatus, updateStatus } from './updater'
import { closeQuickAddFrom } from './quick-add-window'
import { createWindow, switchWindowEnvironment, type WindowInit, windowInitFor } from './window'

// The Electron-side half of the router split: everything here needs the shell
// (native dialogs, window management, the updater) or the
// calling window. The pure-Node procedures live in apps/daemon/src/api.ts.
interface ShellTrpcContext {
  sender: WebContents
}
const t = initTRPC.context<ShellTrpcContext>().create({ isServer: true })

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
      headers: daemonHeaders(token),
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
        headers: daemonHeaders(token),
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

  /**
   * Dismiss the menu-bar quick-add popover from inside it (Task created, or Escape).
   * Scoped to the CALLING window: no other window can close the popover this way.
   */
  closeQuickAdd: t.procedure.mutation(({ ctx }): void => {
    closeQuickAddFrom(ctx.sender)
  }),

  refreshRemoteEnvironment: t.procedure.query(async ({ ctx }): Promise<void> => {
    const environmentId = windowEnvironmentId(ctx.sender)
    if (environmentId !== null) await refreshActiveEndpoint(environmentId)
  }),
  /**
   * The LOCAL child daemon's pair, plus whether this window is already bound to it.
   * Handing the renderer the local token is not a widening — the preload already gives
   * it to every LOCAL-bound window, and an Electron window always loads our own dist from
   * disk (the shell boundary records what would break that). It exists so a remote-bound
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

  // Electron's own clipboard, not the web Clipboard API: terminal text paste must work when
  // the PTY is on a remote Linux host with no GUI clipboard at all. A mutation, not a query —
  // TanStack caches a query's result, which would replay stale clipboard contents.
  readTerminalClipboard: t.procedure.mutation(() => {
    return { text: clipboard.readText() }
  }),

  // Deliberately stays in the shell router: Electron reliably writes the macOS system
  // clipboard even when the renderer's browser Clipboard API is unavailable or denied.
  writeTerminalClipboardText: t.procedure.input(z.string()).mutation(({ input }) => {
    clipboard.writeText(input)
  }),

  updateStatus: t.procedure.query((): UpdateStatus => updateStatus()),

  checkForUpdates: t.procedure.mutation(() => checkForUpdates()),

  installUpdate: t.procedure.mutation(() => {
    installUpdate()
  }),

  // The companion and remote skills ship inside the `porcelain` agent plugin. The app does
  // not install it — it hands over the commands. There is deliberately no upgrade prompt:
  // the app cannot see which version an agent has installed, and the marketplace route
  // refreshes on its own.
  pluginInfo: t.procedure.query(
    (): {
      version: string
      installCommand: string
      marketplaceCommands: readonly string[]
      updateCommands: readonly string[]
    } => ({
      version: PLUGIN_VERSION,
      installCommand: pluginInstallCommand(),
      marketplaceCommands: pluginMarketplaceCommands(),
      updateCommands: pluginUpdateCommands(),
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

  // Cross-Environment Tasks. Implementation lives in shell-tasks.ts; see the fan-out and
  // explicit-target rules there.
  environmentTasks: t.procedure.query(() => environmentTasks()),

  environmentTaskMutation: t.procedure
    .input(environmentTaskMutationInput)
    .mutation(({ input }) => mutateEnvironmentTask(input)),

  environmentStatuses: t.procedure.query(() => readEnvironmentStatuses()),

  /** One Project's saved commands on any connected Environment (read-only fan-out). */
  projectActions: t.procedure
    .input(z.object({ groupId: z.string().nullable(), projectId: z.string().min(1) }))
    .query(({ input }) => readProjectActions(input)),

  /** Live Hub inventory across This device and every saved Environment. */
  hubInventories: t.procedure.query(({ ctx }) =>
    readHubInventories(windowEnvironmentId(ctx.sender)),
  ),

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
