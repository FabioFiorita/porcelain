import { initTRPC } from '@trpc/server'
import { dialog, shell, type WebContents } from 'electron'
import { z } from 'zod'
import { type RepoInfo, recordRecent, toRepoInfo } from '../backend/api'
import { setWatchedDirs, setWatchedFiles } from '../backend/file-watch'
import { warmFileList } from '../backend/git'
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
  openRepo: t.procedure.query(async (): Promise<RepoInfo | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    const path = result.filePaths[0]
    if (!path) return null
    await recordRecent(path)
    warmFileList(path)
    return toRepoInfo(path)
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

  // The two watch procedures are shell-side only TEMPORARILY (Stage 1): they need
  // the calling window (ctx.sender) to target their app-events, and the WS session
  // that replaces it doesn't exist until Stage 2. The watchers themselves already
  // live Electron-free in src/backend/file-watch.ts.

  // The renderer pushes its open file-tab paths whenever the set changes; main
  // watches their dirs and emits `working-tree` so an external write (the coding
  // agent in the terminal) live-refreshes the open document. See `file-watch.ts`.
  watchFiles: t.procedure
    .input(z.array(z.string()))
    .mutation(({ input, ctx }) => setWatchedFiles(ctx.sender, input)),

  // The renderer pushes its expanded tree dirs whenever the set changes; main
  // watches them (non-recursively) and emits `file-tree` so an external add/remove
  // (the coding agent in the terminal) live-refreshes the tree. See `file-watch.ts`.
  watchDirs: t.procedure
    .input(z.array(z.string()))
    .mutation(({ input, ctx }) => setWatchedDirs(ctx.sender, input)),

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
