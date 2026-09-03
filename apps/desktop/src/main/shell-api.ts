import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import {
  ENVIRONMENT_NAME_MAX_LENGTH,
  environmentIdentitySchema,
} from '@porcelain/contracts/projects'
import { createPairingBundleLink, remoteProcedures } from '@porcelain/contracts/remote'
import { createTRPCUntypedClient, httpLink } from '@trpc/client'
import { initTRPC } from '@trpc/server'
import { BrowserWindow, clipboard, nativeTheme, shell, type WebContents } from 'electron'
import { z } from 'zod'
import { installCodexPlugin, readCodexPluginStatus } from './codex-plugin'
import {
  localDaemonPair,
  environmentDaemonPairs as readEnvironmentDaemonPairs,
  reloadEnvironmentsCache,
  setWindowRemoteEndpoint,
  windowEnvironmentId,
} from './daemon'
import { daemonHeaders } from './daemon-headers'
import {
  loadLocalTerminalPaths,
  localTerminalPathKey,
  updateLocalTerminalPaths,
} from './local-terminal-paths'
import { agentPluginRepository, claudePluginCommands, PLUGIN_VERSION } from './plugin-assets'
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
import { renameEnvironment } from './shell-environment-name'
import {
  probeEnvironment,
  readEnvironmentConnections,
  readEnvironmentStatuses,
} from './shell-environments'
import { readCurrentHubInventory, readHubInventories } from './shell-hub-inventory'
import { exchangePairingLink } from './shell-pairing'
import { checkForUpdates, installUpdate, type UpdateStatus, updateStatus } from './updater'
import { createWindow, type WindowInit, windowInitFor } from './window'
import {
  forgetManagedWslEnvironment,
  managedWslAdminConnections,
  managedWslDistributions,
  prepareWslEnvironment,
  rememberWslEnvironment,
} from './wsl-environments'

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

type PairEnvironmentInput = {
  connectionLink: string
  groupId?: string | null
}

async function pairEnvironmentConnection(
  _ctx: ShellTrpcContext,
  input: PairEnvironmentInput,
): Promise<{ id: string; merged: boolean }> {
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

    await revokeClientCredential(url, token)
    await updateRemoteEnvironmentState((state) => ({
      ...state,
      environments: state.environments.map((env) =>
        env.id === group.id ? withEndpoint(env, url) : env,
      ),
    }))
    await reloadEnvironmentsCache()
    return { id: group.id, merged: true }
  }

  if (host !== null && host !== '') {
    const twin = (await loadRemoteEnvironmentState()).environments.find((env) => env.host === host)
    if (twin !== undefined && (await sameMachine(url, twin))) {
      await revokeClientCredential(url, token)
      await updateRemoteEnvironmentState((state) => ({
        ...state,
        environments: state.environments.map((env) =>
          env.id === twin.id ? withActiveUrl(withEndpoint(env, url), url) : env,
        ),
      }))
      await reloadEnvironmentsCache()
      return { id: twin.id, merged: true }
    }
  }

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

  return { id, merged: false }
}

async function setupWslEnvironment(
  ctx: ShellTrpcContext,
  distribution: string,
): Promise<{ id: string }> {
  const prepared = await prepareWslEnvironment(distribution)
  if (prepared.existingEnvironmentId !== null) {
    const existing = (await loadRemoteEnvironmentState()).environments.find(
      (environment) => environment.id === prepared.existingEnvironmentId,
    )
    if (existing !== undefined) {
      await probeDaemon(existing.url, existing.token)
      await renameEnvironment({ environmentId: existing.id, name: 'WSL' })
      return { id: existing.id }
    }
    await forgetManagedWslEnvironment(prepared.existingEnvironmentId)
    return setupWslEnvironment(ctx, distribution)
  }

  const paired = await pairEnvironmentConnection(ctx, {
    connectionLink: prepared.connectionLink,
  })
  await rememberWslEnvironment(distribution, prepared.port, paired.id)
  // Name the daemon-owned Environment, not just this desktop's saved connection. That keeps
  // Windows and WSL distinct everywhere the shared Hub renders the daemon identity.
  await renameEnvironment({ environmentId: paired.id, name: 'WSL' })
  return { id: paired.id }
}

function adminClient(url: string, token: string): ReturnType<typeof createTRPCUntypedClient> {
  return createTRPCUntypedClient({
    links: [httpLink({ url: `${url}/trpc`, headers: daemonHeaders(token) })],
  })
}

/**
 * Create one mobile import link for this Windows daemon and every Windows-managed WSL daemon.
 * Each daemon still mints its own grant; administrator credentials stay inside Electron main.
 */
async function issueManagedEnvironmentBundle(label: string): Promise<{
  count: number
  url: string
}> {
  if (process.platform !== 'win32') throw new Error('Environment bundles are managed on Windows')
  const local = localDaemonPair()
  const wsl = await managedWslAdminConnections()
  if (wsl.length === 0) throw new Error('Set up a WSL Environment before pairing both Environments')
  const targets = [
    { fallbackName: 'Windows', ...local },
    ...wsl.map((entry) => ({
      fallbackName: 'WSL',
      token: entry.token,
      url: entry.url,
    })),
  ]

  const issued: {
    client: ReturnType<typeof createTRPCUntypedClient>
    id: string
    name: string
    url: string
  }[] = []
  try {
    for (const target of targets) {
      const client = adminClient(target.url, target.token)
      const [identity, lan] = await Promise.all([
        client.query('environmentIdentity').then((value) => environmentIdentitySchema.parse(value)),
        client
          .mutation('setLanBind', true)
          .then((value) => remoteProcedures.setLanBind.output.parse(value)),
      ])
      const baseUrl = lan.numericUrl ?? lan.url
      if (baseUrl === null)
        throw new Error(`${identity.name || target.fallbackName} has no LAN address`)
      const grant = remoteProcedures.issuePairingLink.output.parse(
        await client.mutation('issuePairingLink', { baseUrl, label }),
      )
      issued.push({
        client,
        id: grant.id,
        name: identity.name || target.fallbackName,
        url: grant.url,
      })
    }
    return {
      count: issued.length,
      url: createPairingBundleLink(issued.map(({ name, url }) => ({ name, url }))),
    }
  } catch (error) {
    await Promise.allSettled(
      issued.map(({ client, id }) => client.mutation('revokePairingLink', id)),
    )
    throw error
  }
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
   * disk (the shell boundary records what would break that). It exists so a remote-bound
   * window can ALSO open a terminal here: repo on the Beelink, simulator on this Mac.
   * `isLocal` hides the affordance when the window is already local.
   */
  localDaemon: t.procedure.query(
    ({ ctx }): { url: string; token: string; isLocal: boolean; home: string } => ({
      ...localDaemonPair(),
      isLocal: windowEnvironmentId(ctx.sender) === null,
      // This machine's home directory: the only folder a remote-bound window can be sure
      // exists HERE, so it is the last-resort suggestion when the local terminal folder
      // has never been mapped (the remote repo path would not exist on this disk).
      home: homedir(),
    }),
  ),

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

  // The companion and remote skills ship inside the `porcelain` agent plugin.
  pluginInfo: t.procedure.query(
    (): {
      version: string
      agentPluginRepository: string
      claudePluginCommands: readonly string[]
    } => ({
      version: PLUGIN_VERSION,
      agentPluginRepository: agentPluginRepository(),
      claudePluginCommands: claudePluginCommands(),
    }),
  ),

  codexPluginStatus: t.procedure.query(() => readCodexPluginStatus()),

  // This intentionally targets the machine running Electron, not whichever daemon Environment
  // the current window is viewing. The human triggers the external Codex configuration change.
  installCodexPlugin: t.procedure.mutation(() => installCodexPlugin()),

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

  // Widens the renderer's held credentials from one token (today's `localDaemon`) to N
  // (every saved environment, plus This device when THIS window's primary is a saved
  // Environment) — not a new trust category, since the renderer already always holds one
  // live daemon token in-process. Every `RemoteEnvironment.token` returned here must be a
  // pairing-issued `pc_client_…` client credential, never the host administrator token —
  // this daemon deliberately never issues the admin token through pairing.
  environmentDaemonPairs: t.procedure.query(({ ctx }) =>
    readEnvironmentDaemonPairs(windowEnvironmentId(ctx.sender)),
  ),

  environmentStatuses: t.procedure.query(() => readEnvironmentStatuses()),

  /** Candidate Linux Environments discovered through the Windows WSL host boundary. */
  wslDistributions: t.procedure.query(() => managedWslDistributions()),

  setupWslEnvironment: t.procedure
    .input(z.object({ distribution: z.string().min(1) }))
    .mutation(({ ctx, input }) => setupWslEnvironment(ctx, input.distribution)),

  issueManagedEnvironmentBundle: t.procedure
    .input(z.object({ label: z.string().trim().min(1).max(80) }))
    .mutation(({ input }) => issueManagedEnvironmentBundle(input.label)),

  /**
   * Name one Environment — This device (`null`) or a saved group. The nickname is written on
   * the daemon that owns it; a blank name clears it back to that daemon's machine name.
   * Bounded by the contract, so an over-long name is rejected rather than truncated.
   */
  renameEnvironment: t.procedure
    .input(
      z.object({
        environmentId: z.string().min(1).nullable(),
        name: z.string().max(ENVIRONMENT_NAME_MAX_LENGTH),
      }),
    )
    .mutation(({ input }) => renameEnvironment(input)),

  /** One Project's saved commands on any connected Environment (read-only fan-out). */
  projectActions: t.procedure
    .input(z.object({ groupId: z.string().nullable(), projectId: z.string().min(1) }))
    .query(({ input }) => readProjectActions(input)),

  /** Live Hub inventory across This device and every saved Environment. */
  hubInventories: t.procedure.query(({ ctx }) =>
    readHubInventories(windowEnvironmentId(ctx.sender)),
  ),

  /** The current window's Hub source only; used to refresh a local mutation without fan-out. */
  currentHubInventory: t.procedure.query(({ ctx }) =>
    readCurrentHubInventory(windowEnvironmentId(ctx.sender)),
  ),

  /**
   * Endpoints + credentials for every reachable Environment this window is NOT bound to, so
   * the renderer can hold a session to each one instead of asking the shell to relay every
   * read, spawn, and terminal byte. `localDaemon` above has handed the same pair over since
   * local terminals shipped; this generalizes it from one extra daemon to all of them.
   */
  environmentConnections: t.procedure.query(({ ctx }) =>
    readEnvironmentConnections(windowEnvironmentId(ctx.sender)),
  ),

  pairEnvironmentConnection: t.procedure
    .input(
      z.object({
        connectionLink: z.string(),
        /** Add this endpoint to an existing group instead of creating a new group. */
        groupId: z.string().nullable().optional(),
      }),
    )
    .mutation(({ ctx, input }) => pairEnvironmentConnection(ctx, input)),

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
    .mutation(async ({ input }): Promise<void> => {
      await forgetManagedWslEnvironment(input.id)
      await updateRemoteEnvironmentState((state) => ({
        activeId: state.activeId === input.id ? null : state.activeId,
        environments: state.environments.filter((e) => e.id !== input.id),
      }))
      await reloadEnvironmentsCache()
    }),
})

export type ShellRouter = typeof shellRouter
