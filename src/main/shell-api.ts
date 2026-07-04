import { initTRPC } from '@trpc/server'
import { dialog, shell, type WebContents } from 'electron'
import { z } from 'zod'
import { type CodexInstallResult, installCodex } from './codex'
import { codexInstallCommands, codexMarketplaceDir, codexPluginVersion } from './codex-assets'
import { installCursorPlugin, installPlugin, type PluginInstallResult } from './plugin'
import {
  cursorInstallCommands,
  cursorPluginLocalDir,
  installCommands,
  PLUGIN_VERSION,
  pluginMarketplaceDir,
} from './plugin-assets'
import { checkForUpdates, installUpdate, type UpdateStatus, updateStatus } from './updater'
import { createWindow, type WindowInit, windowInitFor } from './window'

// The Electron-side half of the router split: everything here needs the shell
// (native dialogs, window management, the updater, plugin installers) or the
// calling window. The pure-Node procedures live in src/backend/api.ts.
export interface ShellTrpcContext {
  sender: WebContents
}
const t = initTRPC.context<ShellTrpcContext>().create({ isServer: true })

export const shellRouter = t.router({
  // Only the native folder dialog is shell work; the config side effects
  // (recording the recent, warming the file list) live daemon-side now, so the
  // renderer follows up by opening the returned path over the appRouter
  // (`openRepoPath` — see stores/repo.ts).
  openRepo: t.procedure.query(async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.filePaths[0] ?? null
  }),

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

  // The Claude Code plugin (bundles the feature-review MCP server + skill).
  pluginInfo: t.procedure.query(
    (): { marketplaceDir: string; commands: string[]; version: string } => ({
      marketplaceDir: pluginMarketplaceDir(),
      commands: installCommands(),
      version: PLUGIN_VERSION,
    }),
  ),

  installPlugin: t.procedure.mutation((): Promise<PluginInstallResult> => installPlugin()),

  cursorPluginInfo: t.procedure.query(
    (): { installDir: string; commands: string[]; version: string } => ({
      installDir: cursorPluginLocalDir(),
      commands: cursorInstallCommands(),
      version: PLUGIN_VERSION,
    }),
  ),

  installCursorPlugin: t.procedure.mutation(
    (): Promise<PluginInstallResult> => installCursorPlugin(),
  ),

  // The Codex plugin (same local MCP server + skills, packaged as a Codex marketplace).
  codexInfo: t.procedure.query(
    (): { marketplaceDir: string; commands: string[]; version: string } => ({
      marketplaceDir: codexMarketplaceDir(),
      commands: codexInstallCommands(),
      version: codexPluginVersion(),
    }),
  ),

  installCodex: t.procedure.mutation((): Promise<CodexInstallResult> => installCodex()),
})

export type ShellRouter = typeof shellRouter
