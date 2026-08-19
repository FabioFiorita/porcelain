import { z } from 'zod'
import { resolvedProfileSchema, worktreeProfileSchema } from '../worktree-profile'

export const dirEntrySchema = z
  .object({
    name: z.string(),
    path: z.string(),
    kind: z.enum(['file', 'dir']),
    hidden: z.boolean(),
    pinned: z.boolean(),
  })
  .strict()

export type DirEntry = z.infer<typeof dirEntrySchema>

export const fileViewSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }).strict(),
  z.object({ type: z.literal('image'), dataUrl: z.string().min(1) }).strict(),
  z.object({ type: z.literal('binary'), size: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal('too-large'), size: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal('not-found') }).strict(),
])

export type FileView = z.infer<typeof fileViewSchema>

export const repoScopeSchema = z
  .object({
    hiddenPaths: z.array(z.string()).default([]),
    pinnedPaths: z.array(z.string()).default([]),
  })
  .strict()

export type RepoScope = z.infer<typeof repoScopeSchema>

/**
 * Caller-nominated operation root for Files host-fs procedures.
 * POSIX absolute path string for Linux/macOS daemons. Not a repo-authorization grant:
 * any absolute directory the credential holder names is acceptable, including `/`.
 */
export function isFilesProjectPath(value: string): boolean {
  if (value.length < 1 || value.length > 4096) return false
  if (value.includes('\0')) return false
  if (!value.startsWith('/')) return false // relative roots are request.invalid
  if (value.includes('\\')) return false
  return true
}

export const filesProjectPathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(isFilesProjectPath, { message: 'invalid files projectPath' })

/**
 * Project-relative file target for the eight host-fs procedures.
 * Rejects absolute paths, Windows drive letters, backslashes, empty segments,
 * and `.` / `..` segments. Names like `..foo` are valid (not parent traversal).
 */
export function isFilesProjectRelativePath(value: string): boolean {
  if (value.length === 0 || value.length > 4096) return false
  if (value.includes('\0')) return false
  if (value.startsWith('/')) return false
  if (value.includes('\\')) return false
  if (/^[A-Za-z]:/.test(value)) return false
  const segments = value.split('/')
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') return false
  }
  return true
}

export const filesProjectRelativePathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(isFilesProjectRelativePath, { message: 'invalid project-relative path' })

export const readDirInputSchema = z
  .object({
    repoPath: z.string(),
    path: z.string(),
    showHidden: z.boolean(),
  })
  .strict()
export const readDirOutputSchema = z.array(dirEntrySchema)
export type ReadDirInput = z.infer<typeof readDirInputSchema>
export type ReadDirOutput = z.infer<typeof readDirOutputSchema>

const repoPathAndPathSchema = z
  .object({
    repoPath: z.string(),
    path: z.string(),
  })
  .strict()

export const hidePathInputSchema = repoPathAndPathSchema
export const hidePathOutputSchema = z.void()
export type HidePathInput = z.infer<typeof hidePathInputSchema>
export type HidePathOutput = z.infer<typeof hidePathOutputSchema>

export const unhidePathInputSchema = repoPathAndPathSchema
export const unhidePathOutputSchema = z.void()
export type UnhidePathInput = z.infer<typeof unhidePathInputSchema>
export type UnhidePathOutput = z.infer<typeof unhidePathOutputSchema>

export const pinPathInputSchema = repoPathAndPathSchema
export const pinPathOutputSchema = z.void()
export type PinPathInput = z.infer<typeof pinPathInputSchema>
export type PinPathOutput = z.infer<typeof pinPathOutputSchema>

export const unpinPathInputSchema = repoPathAndPathSchema
export const unpinPathOutputSchema = z.void()
export type UnpinPathInput = z.infer<typeof unpinPathInputSchema>
export type UnpinPathOutput = z.infer<typeof unpinPathOutputSchema>

export const pinnedEntriesInputSchema = z.string()
export const pinnedEntriesOutputSchema = z.array(dirEntrySchema)
export type PinnedEntriesInput = z.infer<typeof pinnedEntriesInputSchema>
export type PinnedEntriesOutput = z.infer<typeof pinnedEntriesOutputSchema>

export const readFileInputSchema = z
  .object({
    projectPath: filesProjectPathSchema,
    path: filesProjectRelativePathSchema,
  })
  .strict()
export const readFileOutputSchema = fileViewSchema
export type ReadFileInput = z.infer<typeof readFileInputSchema>
export type ReadFileOutput = z.infer<typeof readFileOutputSchema>

export const previewHtmlInputSchema = z
  .object({
    projectPath: filesProjectPathSchema,
    path: filesProjectRelativePathSchema,
  })
  .strict()
export const previewHtmlOutputSchema = z.string().nullable()
export type PreviewHtmlInput = z.infer<typeof previewHtmlInputSchema>
export type PreviewHtmlOutput = z.infer<typeof previewHtmlOutputSchema>

/**
 * Capability grant for the daemon's scripts-enabled preview route
 * (`GET /file-preview/<token>`). Same file scope as `previewHtml`; the token is
 * the credential an iframe navigation can carry, and it expires in minutes.
 */
export const mintFilePreviewTokenInputSchema = z
  .object({
    projectPath: filesProjectPathSchema,
    path: filesProjectRelativePathSchema,
  })
  .strict()
export const mintFilePreviewTokenOutputSchema = z.object({ token: z.string().min(1) }).strict()
export type MintFilePreviewTokenInput = z.infer<typeof mintFilePreviewTokenInputSchema>
export type MintFilePreviewTokenOutput = z.infer<typeof mintFilePreviewTokenOutputSchema>

export const writeTextFileInputSchema = z
  .object({
    projectPath: filesProjectPathSchema,
    path: filesProjectRelativePathSchema,
    content: z.string(),
  })
  .strict()
export const writeTextFileOutputSchema = z.void()
export type WriteTextFileInput = z.infer<typeof writeTextFileInputSchema>
export type WriteTextFileOutput = z.infer<typeof writeTextFileOutputSchema>

export const createFileInputSchema = z
  .object({
    projectPath: filesProjectPathSchema,
    path: filesProjectRelativePathSchema,
  })
  .strict()
export const createFileOutputSchema = z.void()
export type CreateFileInput = z.infer<typeof createFileInputSchema>
export type CreateFileOutput = z.infer<typeof createFileOutputSchema>

export const createFolderInputSchema = createFileInputSchema
export const createFolderOutputSchema = z.void()
export type CreateFolderInput = z.infer<typeof createFolderInputSchema>
export type CreateFolderOutput = z.infer<typeof createFolderOutputSchema>

export const renamePathInputSchema = z
  .object({
    projectPath: filesProjectPathSchema,
    from: filesProjectRelativePathSchema,
    to: filesProjectRelativePathSchema,
  })
  .strict()
export const renamePathOutputSchema = z.void()
export type RenamePathInput = z.infer<typeof renamePathInputSchema>
export type RenamePathOutput = z.infer<typeof renamePathOutputSchema>

export const duplicatePathInputSchema = z
  .object({
    projectPath: filesProjectPathSchema,
    path: filesProjectRelativePathSchema,
  })
  .strict()
export const duplicatePathOutputSchema = filesProjectRelativePathSchema
export type DuplicatePathInput = z.infer<typeof duplicatePathInputSchema>
export type DuplicatePathOutput = z.infer<typeof duplicatePathOutputSchema>

export const trashPathInputSchema = z
  .object({
    projectPath: filesProjectPathSchema,
    path: filesProjectRelativePathSchema,
  })
  .strict()
export const trashPathOutputSchema = z.void()
export type TrashPathInput = z.infer<typeof trashPathInputSchema>
export type TrashPathOutput = z.infer<typeof trashPathOutputSchema>

export const repoScopeInputSchema = z.string()
export const repoScopeOutputSchema = repoScopeSchema
export type RepoScopeInput = z.infer<typeof repoScopeInputSchema>
export type RepoScopeOutput = z.infer<typeof repoScopeOutputSchema>

/**
 * The worktree profile for one checkout, BROKEN OUT rather than merged.
 *
 * `repoScope` answers "what does this tree apply"; this answers "and where did
 * each part come from". Settings → Personalization is the caller, and it exists
 * to show a human which of their focus is the project baseline and which this
 * worktree added — a single merged list cannot say that, and a reader who
 * cannot tell the two apart cannot decide which one to ask their agent to fix.
 */
export const worktreeProfileViewSchema = z
  .object({
    /** Null when this checkout is not registered with the Hub yet. */
    worktreeId: z.string().min(1).nullable(),
    base: resolvedProfileSchema,
    /** Null on the ordinary worktree: no override, pure inheritance. */
    override: worktreeProfileSchema.nullable(),
    resolved: resolvedProfileSchema,
  })
  .strict()
export type WorktreeProfileView = z.infer<typeof worktreeProfileViewSchema>

export const worktreeProfileInputSchema = z.string()
export type WorktreeProfileInput = z.infer<typeof worktreeProfileInputSchema>

/** Representative contract-valid FileView values used by boundary tests and client mocks. */
export const fileViewFixtures = {
  text: { type: 'text', content: 'synthetic text content' },
  image: { type: 'image', dataUrl: 'data:image/png;base64,AA==' },
  binary: { type: 'binary', size: 12 },
  tooLarge: { type: 'too-large', size: 10_485_761 },
  notFound: { type: 'not-found' },
} as const

/** Representative contract-valid Files values used by boundary tests and client mocks. */
export const filesContractFixtures = {
  readDir: {
    input: { repoPath: '/synthetic/repo', path: '/synthetic/repo/src', showHidden: false },
    output: [
      {
        name: 'components',
        path: '/synthetic/repo/src/components',
        kind: 'dir',
        hidden: false,
        pinned: false,
      },
      {
        name: 'main.ts',
        path: '/synthetic/repo/src/main.ts',
        kind: 'file',
        hidden: false,
        pinned: true,
      },
    ],
  },
  hidePath: {
    input: { repoPath: '/synthetic/repo', path: 'src/generated' },
    output: undefined,
  },
  unhidePath: {
    input: { repoPath: '/synthetic/repo', path: '/synthetic/repo/src/generated' },
    output: undefined,
  },
  pinPath: {
    input: { repoPath: '/synthetic/repo', path: 'README.md' },
    output: undefined,
  },
  unpinPath: {
    input: { repoPath: '/synthetic/repo', path: '/synthetic/repo/README.md' },
    output: undefined,
  },
  pinnedEntries: {
    input: '/synthetic/repo',
    output: [
      {
        name: 'README.md',
        path: '/synthetic/repo/README.md',
        kind: 'file',
        hidden: false,
        pinned: true,
      },
    ],
  },
  readFile: {
    input: { projectPath: '/synthetic/repo', path: 'README.md' },
    output: fileViewFixtures.text,
  },
  previewHtml: {
    input: { projectPath: '/synthetic/repo', path: 'docs/index.html' },
    output: '<!doctype html><html><body>synthetic preview</body></html>',
  },
  mintFilePreviewToken: {
    input: { projectPath: '/synthetic/repo', path: 'docs/index.html' },
    output: { token: 'synthetic-file-preview-token' },
  },
  writeTextFile: {
    input: {
      projectPath: '/synthetic/repo',
      path: 'docs/notes.txt',
      content: 'line one\nline two\n',
    },
    output: undefined,
  },
  createFile: {
    input: { projectPath: '/synthetic/repo', path: 'docs/empty.txt' },
    output: undefined,
  },
  createFolder: {
    input: { projectPath: '/synthetic/repo', path: 'docs/generated' },
    output: undefined,
  },
  renamePath: {
    input: {
      projectPath: '/synthetic/repo',
      from: 'docs/draft.md',
      to: 'docs/final.md',
    },
    output: undefined,
  },
  duplicatePath: {
    input: { projectPath: '/synthetic/repo', path: 'docs/guide.md' },
    output: 'docs/guide copy.md',
  },
  trashPath: {
    input: { projectPath: '/synthetic/repo', path: 'docs/old.md' },
    output: undefined,
  },
  repoScope: {
    input: '/synthetic/repo',
    output: {
      hiddenPaths: ['/synthetic/repo/src/generated'],
      pinnedPaths: ['/synthetic/repo/README.md'],
    },
  },
  // A worktree that HAS an override, so the fixture exercises the interesting
  // shape; the common case is `override: null` and `resolved` equal to `base`.
  worktreeProfile: {
    input: '/synthetic/repo',
    output: {
      worktreeId: 'wt-synthetic',
      base: {
        hiddenPaths: ['src/generated'],
        pinnedPaths: ['README.md'],
        layers: [{ label: 'Docs', pattern: '(^|/)docs/' }],
      },
      override: {
        pinnedPaths: ['src/checkout/total.ts'],
        hiddenPaths: [],
        unhiddenPaths: ['src/generated'],
        layers: null,
      },
      resolved: {
        hiddenPaths: [],
        pinnedPaths: ['README.md', 'src/checkout/total.ts'],
        layers: [{ label: 'Docs', pattern: '(^|/)docs/' }],
      },
    },
  },
} as const
