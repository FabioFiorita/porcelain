import { randomUUID } from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { shell, type WebContents } from 'electron'
import { z } from 'zod'
import {
  AGENT_NAMES,
  type AgentMcpResult,
  type AgentName,
  agentConfigPath,
  installMcpForAgents,
} from './agent-mcp'
import { pushDaemonInfo, setRemoteOverride } from './daemon'
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
    .input(z.object({ repoPath: z.string().optional() }).optional())
    .mutation(({ input }) => {
      createWindow(
        input?.repoPath ? { mode: 'open', repoPath: input.repoPath } : { mode: 'welcome' },
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

  // Agent MCP config: one button writes the Porcelain MCP server into Claude Code,
  // Codex, and OpenCode's user-global config files.
  agentMcpInfo: t.procedure.query((): { agents: { name: AgentName; configPath: string }[] } => ({
    agents: AGENT_NAMES.map((name) => ({ name, configPath: agentConfigPath(name) })),
  })),

  installAgentMcp: t.procedure
    .input(z.array(z.enum(AGENT_NAMES as [AgentName, ...AgentName[]])).optional())
    .mutation(async ({ input }): Promise<AgentMcpResult[]> => {
      return installMcpForAgents(input ?? AGENT_NAMES)
    }),

  // Saved remote environments (remote-envs Phase 4): keep a list of other
  // machines' Porcelain daemons and switch this app between them. Tokens are
  // deliberately NOT returned to the renderer — the active one already reaches the
  // window via the preload daemon getter; the settings UI only needs name + url.
  // Each mutation is load→mutate→save; the shell is single-process so no lock is
  // needed. Windows re-point via a full reload (see use-remote-daemon), so these
  // just persist, flip the override, and push the new daemonInfo.
  remoteEnvironments: t.procedure.query(
    async (): Promise<{
      activeId: string | null
      environments: { id: string; name: string; url: string }[]
    }> => {
      const state = await loadRemoteEnvironmentState()
      return {
        activeId: state.activeId,
        environments: state.environments.map(({ id, name, url }) => ({ id, name, url })),
      }
    },
  ),

  addRemoteEnvironment: t.procedure
    .input(z.object({ name: z.string(), url: z.string(), token: z.string() }))
    .mutation(async ({ input }): Promise<{ id: string }> => {
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
      state.activeId = id
      await saveRemoteEnvironmentState(state)
      setRemoteOverride({ url, token: input.token })
      pushDaemonInfo()
      return { id }
    }),

  connectRemoteEnvironment: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }): Promise<void> => {
      const state = await loadRemoteEnvironmentState()
      const env = state.environments.find((e) => e.id === input.id)
      if (env === undefined) throw new Error('That environment no longer exists')

      await probeDaemon(env.url, env.token)
      state.activeId = env.id
      await saveRemoteEnvironmentState(state)
      setRemoteOverride({ url: env.url, token: env.token })
      pushDaemonInfo()
    }),

  disconnectRemoteEnvironment: t.procedure.mutation(async (): Promise<void> => {
    const state = await loadRemoteEnvironmentState()
    state.activeId = null
    await saveRemoteEnvironmentState(state)
    setRemoteOverride(null)
    // Push the LOCAL daemonInfo back to every window (the child kept running).
    pushDaemonInfo()
  }),

  removeRemoteEnvironment: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }): Promise<{ wasActive: boolean }> => {
      const state = await loadRemoteEnvironmentState()
      const wasActive = state.activeId === input.id
      state.environments = state.environments.filter((e) => e.id !== input.id)
      if (wasActive) {
        state.activeId = null
        setRemoteOverride(null)
      }
      await saveRemoteEnvironmentState(state)
      // Only the active environment's removal changes what windows point at.
      if (wasActive) pushDaemonInfo()
      return { wasActive }
    }),
})

export type ShellRouter = typeof shellRouter
