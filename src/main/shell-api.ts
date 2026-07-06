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
  deleteRemoteDaemon,
  loadRemoteDaemon,
  normalizeDaemonUrl,
  saveRemoteDaemon,
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

  // Remote daemon (remote-envs Phase 4): point every window at a REMOTE daemon
  // over the tailnet instead of the local child. The token is deliberately NOT
  // returned to the renderer — it already reaches the window via the preload
  // daemon getter; the settings UI only needs the url to display.
  remoteDaemon: t.procedure.query(async (): Promise<{ url: string } | null> => {
    const remote = await loadRemoteDaemon()
    return remote ? { url: remote.url } : null
  }),

  setRemoteDaemon: t.procedure
    .input(z.object({ url: z.string(), token: z.string() }))
    .mutation(async ({ input }): Promise<{ url: string }> => {
      const url = normalizeDaemonUrl(input.url)
      // Probe before accepting: hit a cheap authed query so we distinguish a
      // wrong/dead url from a rejected token before pointing windows at it. The
      // token is sent ONLY to the user-typed url; never log it.
      let res: Response
      try {
        res = await fetch(`${url}/trpc/recentRepos`, {
          headers: { authorization: `Bearer ${input.token}` },
          signal: AbortSignal.timeout(5000),
        })
      } catch {
        throw new Error(`Could not reach a daemon at ${url}`)
      }
      if (res.status === 401) throw new Error('The daemon rejected that token (401)')
      if (!res.ok) throw new Error(`The daemon at ${url} responded with ${res.status}`)

      const remote = { url, token: input.token }
      await saveRemoteDaemon(remote)
      setRemoteOverride(remote)
      pushDaemonInfo()
      return { url }
    }),

  clearRemoteDaemon: t.procedure.mutation(async (): Promise<void> => {
    await deleteRemoteDaemon()
    setRemoteOverride(null)
    // Push the LOCAL daemonInfo back to every window (the child kept running).
    pushDaemonInfo()
  }),
})

export type ShellRouter = typeof shellRouter
