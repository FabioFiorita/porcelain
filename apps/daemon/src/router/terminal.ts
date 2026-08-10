import { procedureCatalog } from '@porcelain/contracts'
import {
  type Action,
  type ActionView,
  addAction,
  deleteAction,
  moveAction,
  readActionViews,
  trustActions,
  updateAction,
} from '../stores/actions-store'
import { listTerminals, renameTerminal, type TerminalInfo } from '../terminal/terminal-manager'
import { publicProcedure, t } from '../trpc'

export const terminalRouter = t.router({
  // Saved actions — named commands the human runs in the embedded terminal with one
  // click, stored in <repo>/.porcelain/actions.json (see `actions-store.ts`); a two-way
  // channel the agent reads (`actions list`) and curates (`actions create/update/delete`)
  // via the CLI. The agent never EXECUTES one — running is human-only (see the audit skill).
  // `trusted` says whether this machine's human has accepted the command text.
  // Shared actions can arrive from a clone or an agent write, so the Run button
  // is gated on it in the UI — see `action-trust-store.ts` for what that does and
  // does not defend.
  actions: publicProcedure
    .input(procedureCatalog.actions.input)
    .output(procedureCatalog.actions.output)
    .query(({ input }): Promise<ActionView[]> => readActionViews(input)),

  trustActions: publicProcedure
    .input(procedureCatalog.trustActions.input)
    .output(procedureCatalog.trustActions.output)
    .mutation(({ input }) => trustActions(input.repoPath, input.ids)),

  addAction: publicProcedure
    .input(procedureCatalog.addAction.input)
    .output(procedureCatalog.addAction.output)
    .mutation(({ input }): Promise<Action> => {
      const { repoPath, ...action } = input
      return addAction(repoPath, action)
    }),

  updateAction: publicProcedure
    .input(procedureCatalog.updateAction.input)
    .output(procedureCatalog.updateAction.output)
    .mutation(({ input }) =>
      updateAction(input.repoPath, input.id, {
        title: input.title,
        command: input.command,
        where: input.where,
      }),
    ),

  moveAction: publicProcedure
    .input(procedureCatalog.moveAction.input)
    .output(procedureCatalog.moveAction.output)
    .mutation(({ input }) => moveAction(input.repoPath, input.id, input.direction)),

  deleteAction: publicProcedure
    .input(procedureCatalog.deleteAction.input)
    .output(procedureCatalog.deleteAction.output)
    .mutation(({ input }) => deleteAction(input.repoPath, input.id)),

  // The daemon-owned terminal roster — every live/exited PTY with its name, cwd, and
  // status. The renderer hydrates its sidebar list from this (filtered to the current
  // repo) on repo open and on daemon reconnect, so a still-running session reappears
  // after a reload. Create/attach/write ride the WS session (byte streams); list/rename
  // are plain request/response, so they live here.
  terminalSessions: publicProcedure
    .input(procedureCatalog.terminalSessions.input)
    .output(procedureCatalog.terminalSessions.output)
    .query((): TerminalInfo[] => listTerminals()),

  renameTerminal: publicProcedure
    .input(procedureCatalog.renameTerminal.input)
    .output(procedureCatalog.renameTerminal.output)
    .mutation(({ input }) => {
      renameTerminal(input.id, input.name)
    }),
})
