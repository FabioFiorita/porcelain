import { z } from 'zod'

/**
 * Files change notifications — the domain-owned replacement for the coarse `scope`,
 * `file-tree`, and file-content half of `working-tree` entries in `appEventSchema`
 * (formerly the horizontal session protocol; RT-005 deleted that dual path).
 *
 * A notification states that daemon-owned Files data changed; it never carries the
 * authoritative entity, so a consumer stays free to recover through queries and may
 * process the same notification twice. Every notification is `.strict()` and carries
 * `projectPath`: a change signal a client cannot scope to a project is a signal it can
 * only answer by refetching everything.
 *
 * `paths` is required on the two path-detailed categories. The current daemon events are
 * bare enums, so a renderer re-reads every open document on any watched write; carrying
 * the changed paths is what lets a consumer narrow that. A category with no path detail
 * (`files.scope-changed`) says so by not declaring the field, rather than by sending an
 * empty array that reads as "nothing changed".
 */

export const FILES_CHANGE_KINDS = [
  'files.scope-changed',
  'files.tree-changed',
  'files.content-changed',
] as const

const projectPathSchema = z.string().min(1)
const changedPathsSchema = z.array(z.string().min(1)).min(1)

/** Hidden/pinned project scope changed (current `scope` app event). */
export const filesScopeChangedSchema = z
  .object({
    kind: z.literal('files.scope-changed'),
    projectPath: projectPathSchema,
  })
  .strict()
export type FilesScopeChanged = z.infer<typeof filesScopeChangedSchema>

/** Entries appeared or disappeared under watched directories (current `file-tree`). */
export const filesTreeChangedSchema = z
  .object({
    kind: z.literal('files.tree-changed'),
    projectPath: projectPathSchema,
    paths: changedPathsSchema,
  })
  .strict()
export type FilesTreeChanged = z.infer<typeof filesTreeChangedSchema>

/** Watched file bodies changed on disk (the file half of the current `working-tree`). */
export const filesContentChangedSchema = z
  .object({
    kind: z.literal('files.content-changed'),
    projectPath: projectPathSchema,
    paths: changedPathsSchema,
  })
  .strict()
export type FilesContentChanged = z.infer<typeof filesContentChangedSchema>

export const filesChangeSchema = z.discriminatedUnion('kind', [
  filesScopeChangedSchema,
  filesTreeChangedSchema,
  filesContentChangedSchema,
])
export type FilesChange = z.infer<typeof filesChangeSchema>

/** Representative Files change values used by boundary tests and client mocks. */
export const filesNotificationFixtures = {
  'files.scope-changed': {
    kind: 'files.scope-changed',
    projectPath: '/synthetic/repo',
  },
  'files.tree-changed': {
    kind: 'files.tree-changed',
    projectPath: '/synthetic/repo',
    paths: ['/synthetic/repo/src', '/synthetic/repo/src/added.ts'],
  },
  'files.content-changed': {
    kind: 'files.content-changed',
    projectPath: '/synthetic/repo',
    paths: ['/synthetic/repo/src/open-document.ts'],
  },
} as const
