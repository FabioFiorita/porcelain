import { z } from 'zod'
import { isFilesProjectRelativePath } from './files.contract'

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
 * `paths` is required on the two path-detailed categories. Entries are project-relative
 * POSIX paths (or `'.'` for the project root itself), never host-absolute paths. A
 * category with no path detail (`files.scope-changed`) says so by not declaring the field,
 * rather than by sending an empty array that reads as "nothing changed".
 */

export const FILES_CHANGE_KINDS = [
  'files.scope-changed',
  'files.tree-changed',
  'files.content-changed',
] as const

const projectPathSchema = z.string().min(1)

/** Notification path: project-relative file/dir identity, or '.' for the project root. */
export function isFilesNotificationPath(value: string): boolean {
  if (value === '.') return true
  return isFilesProjectRelativePath(value)
}

export const filesNotificationPathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(isFilesNotificationPath, { message: 'invalid files notification path' })

export const changedPathsSchema = z.array(filesNotificationPathSchema).min(1)

/** Hidden/pinned project scope changed (current `scope` app event). */
export const filesScopeChangedSchema = z
  .object({
    kind: z.literal('files.scope-changed'),
    projectPath: projectPathSchema,
  })
  .strict()
export type FilesScopeChanged = z.infer<typeof filesScopeChangedSchema>

/** Entries appeared or disappeared under watched directories. */
export const filesTreeChangedSchema = z
  .object({
    kind: z.literal('files.tree-changed'),
    projectPath: projectPathSchema,
    paths: changedPathsSchema,
  })
  .strict()
export type FilesTreeChanged = z.infer<typeof filesTreeChangedSchema>

/** Watched file bodies changed on disk. */
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

/**
 * Representative Files change values used by boundary tests and client mocks.
 *
 * Typed per member rather than left to `as const`. A frozen literal is never checked against the
 * schema it claims to represent, and its `readonly` arrays are not assignable to the contract
 * type — so every consumer had to widen, and a fixture could drift from `filesChangeSchema`
 * without anything failing.
 */
export const filesNotificationFixtures: {
  'files.scope-changed': FilesScopeChanged
  'files.tree-changed': FilesTreeChanged
  'files.content-changed': FilesContentChanged
} = {
  'files.scope-changed': {
    kind: 'files.scope-changed',
    projectPath: '/synthetic/repo',
  },
  'files.tree-changed': {
    kind: 'files.tree-changed',
    projectPath: '/synthetic/repo',
    paths: ['src', 'src/added.ts'],
  },
  'files.content-changed': {
    kind: 'files.content-changed',
    projectPath: '/synthetic/repo',
    paths: ['src/open-document.ts'],
  },
}
