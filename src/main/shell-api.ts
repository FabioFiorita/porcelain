import { randomUUID } from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { shell, type WebContents } from 'electron'
import { z } from 'zod'
import { exportRepoSettings, type RepoSettings } from '../backend/repo-settings'
import {
  AGENT_NAMES,
  type AgentMcpResult,
  type AgentName,
  agentConfigPath,
  installMcpForAgents,
} from './agent-mcp'
import {
  getDefaultEnvironmentId,
  rebindWindowsOnRemovedEnvironment,
  reloadEnvironmentsCache,
  setDefaultEnvironmentId,
  setWindowEnvironment,
  windowEnvironmentId,
} from './daemon'
import {
  loadRemoteEnvironmentState,
  normalizeDaemonUrl,
  saveRemoteEnvironmentState,
} from './remote-daemon'
import { SKILLS_VERSION, skillsInstallCommand, skillsUpgradeCommand } from './skills-assets'
import { checkForUpdates, installUpdate, type UpdateStatus, updateStatus } from './updater'
import { createWindow, type WindowInit, windowInitFor } from './window'

// The Electron-side half of the router split: everything here needs the shell
// (native dialogs, window management, the updater, agent MCP installers) or the
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

export const shellRouter = t.router({
  windowInit: t.procedure.query(({ ctx }): WindowInit => windowInitFor(ctx.sender)),

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

  // Agent MCP config on the Mac shell (local agents). Prefer the daemon's
  // installAgentMcp when configuring the active environment — especially remote —
  // so the host that owns ~/.porcelain channel files is what gets configured.
  // Kept so a local-only install still works without a round-trip and so boot
  // ensureMcpServer (main/index.ts) can refresh the bundled server.
  agentMcpInfo: t.procedure.query((): { agents: { name: AgentName; configPath: string }[] } => ({
    agents: AGENT_NAMES.map((name) => ({ name, configPath: agentConfigPath(name) })),
  })),

  installAgentMcp: t.procedure
    .input(z.array(z.enum(AGENT_NAMES as [AgentName, ...AgentName[]])).optional())
    .mutation(async ({ input }): Promise<AgentMcpResult[]> => {
      return installMcpForAgents(input ?? AGENT_NAMES)
    }),

  // Read this Mac's channel snapshot for a repo path — used when the app is
  // pointed at a remote daemon and the human wants to seed that environment
  // from local setup (shell reads local ~/.porcelain; the renderer then imports
  // into the active daemon via importRepoSettings).
  exportLocalRepoSettings: t.procedure
    .input(z.string())
    .query(({ input }): Promise<RepoSettings> => exportRepoSettings(input)),

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

      const trimmedName = input.name.trim()
      let name = trimmedName
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
        setWindowEnvironment(ctx.sender, id)
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
      setWindowEnvironment(ctx.sender, env.id)
    }),

  /** Point THIS window back at the local child (other windows untouched). */
  disconnectRemoteEnvironment: t.procedure.mutation(async ({ ctx }): Promise<void> => {
    // Only clear the default when THIS window was on it — leave other windows' defaults alone.
    if (getDefaultEnvironmentId() === windowEnvironmentId(ctx.sender)) {
      await setDefaultEnvironmentId(null)
    } else {
      await reloadEnvironmentsCache()
    }
    setWindowEnvironment(ctx.sender, null)
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
      // Any open window on the removed env falls back to local and is reloaded
      // here (including the caller's window). Renderer onSuccess should NOT
      // reload again when wasActive — the main-process reload already ran.
      rebindWindowsOnRemovedEnvironment(input.id)
      return { wasActive: wasThisWindow, reloaded: wasThisWindow }
    }),
})

export type ShellRouter = typeof shellRouter
