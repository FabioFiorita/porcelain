import { z } from 'zod'
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
    .input(z.string())
    .query(({ input }): Promise<ActionView[]> => readActionViews(input)),

  trustActions: publicProcedure
    .input(z.object({ repoPath: z.string(), ids: z.array(z.string()).min(1) }))
    .mutation(({ input }) => trustActions(input.repoPath, input.ids)),

  addAction: publicProcedure
    .input(
      z.object({
        repoPath: z.string(),
        title: z.string().trim().min(1),
        command: z.string().trim().min(1),
        where: z.enum(['primary', 'local']).optional(),
      }),
    )
    .mutation(({ input }): Promise<Action> => {
      const { repoPath, ...action } = input
      return addAction(repoPath, action)
    }),

  updateAction: publicProcedure
    .input(
      z.object({
        repoPath: z.string(),
        id: z.string(),
        title: z.string().trim().min(1).optional(),
        command: z.string().trim().min(1).optional(),
        where: z.enum(['primary', 'local']).optional(),
      }),
    )
    .mutation(({ input }) =>
      updateAction(input.repoPath, input.id, {
        title: input.title,
        command: input.command,
        where: input.where,
      }),
    ),

  moveAction: publicProcedure
    .input(
      z.object({
        repoPath: z.string(),
        id: z.string(),
        direction: z.enum(['up', 'down']),
      }),
    )
    .mutation(({ input }) => moveAction(input.repoPath, input.id, input.direction)),

  deleteAction: publicProcedure
    .input(z.object({ repoPath: z.string(), id: z.string() }))
    .mutation(({ input }) => deleteAction(input.repoPath, input.id)),

  // The daemon-owned terminal roster — every live/exited PTY with its name, cwd, and
  // status. The renderer hydrates its sidebar list from this (filtered to the current
  // repo) on repo open and on daemon reconnect, so a still-running session reappears
  // after a reload. Create/attach/write ride the WS session (byte streams); list/rename
  // are plain request/response, so they live here.
  terminalSessions: publicProcedure.query((): TerminalInfo[] => listTerminals()),

  renameTerminal: publicProcedure
    .input(z.object({ id: z.string(), name: z.string() }))
    .mutation(({ input }) => {
      renameTerminal(input.id, input.name)
    }),
})
