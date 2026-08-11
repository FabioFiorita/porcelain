import { z } from 'zod'

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

export const readFileInputSchema = z.string()
export const readFileOutputSchema = fileViewSchema
export type ReadFileInput = z.infer<typeof readFileInputSchema>
export type ReadFileOutput = z.infer<typeof readFileOutputSchema>

export const previewHtmlInputSchema = z.string()
export const previewHtmlOutputSchema = z.string().nullable()
export type PreviewHtmlInput = z.infer<typeof previewHtmlInputSchema>
export type PreviewHtmlOutput = z.infer<typeof previewHtmlOutputSchema>

export const writeTextFileInputSchema = z
  .object({
    path: z.string(),
    content: z.string(),
  })
  .strict()
export const writeTextFileOutputSchema = z.void()
export type WriteTextFileInput = z.infer<typeof writeTextFileInputSchema>
export type WriteTextFileOutput = z.infer<typeof writeTextFileOutputSchema>

export const createFileInputSchema = z.object({ path: z.string() }).strict()
export const createFileOutputSchema = z.void()
export type CreateFileInput = z.infer<typeof createFileInputSchema>
export type CreateFileOutput = z.infer<typeof createFileOutputSchema>

export const createFolderInputSchema = z.object({ path: z.string() }).strict()
export const createFolderOutputSchema = z.void()
export type CreateFolderInput = z.infer<typeof createFolderInputSchema>
export type CreateFolderOutput = z.infer<typeof createFolderOutputSchema>

export const renamePathInputSchema = z
  .object({
    from: z.string(),
    to: z.string(),
  })
  .strict()
export const renamePathOutputSchema = z.void()
export type RenamePathInput = z.infer<typeof renamePathInputSchema>
export type RenamePathOutput = z.infer<typeof renamePathOutputSchema>

export const duplicatePathInputSchema = z.object({ path: z.string() }).strict()
export const duplicatePathOutputSchema = z.string()
export type DuplicatePathInput = z.infer<typeof duplicatePathInputSchema>
export type DuplicatePathOutput = z.infer<typeof duplicatePathOutputSchema>

export const trashPathInputSchema = z.string()
export const trashPathOutputSchema = z.void()
export type TrashPathInput = z.infer<typeof trashPathInputSchema>
export type TrashPathOutput = z.infer<typeof trashPathOutputSchema>

export const repoScopeInputSchema = z.string()
export const repoScopeOutputSchema = repoScopeSchema
export type RepoScopeInput = z.infer<typeof repoScopeInputSchema>
export type RepoScopeOutput = z.infer<typeof repoScopeOutputSchema>

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
    input: '/synthetic/repo/README.md',
    output: fileViewFixtures.text,
  },
  previewHtml: {
    input: '/synthetic/repo/docs/index.html',
    output: '<!doctype html><html><body>synthetic preview</body></html>',
  },
  writeTextFile: {
    input: { path: 'docs/notes.txt', content: 'line one\nline two\n' },
    output: undefined,
  },
  createFile: {
    input: { path: '/synthetic/repo/docs/empty.txt' },
    output: undefined,
  },
  createFolder: {
    input: { path: '/synthetic/repo/docs/generated' },
    output: undefined,
  },
  renamePath: {
    input: { from: '/synthetic/repo/docs/draft.md', to: '/synthetic/repo/docs/final.md' },
    output: undefined,
  },
  duplicatePath: {
    input: { path: '/synthetic/repo/docs/guide.md' },
    output: '/synthetic/repo/docs/guide copy.md',
  },
  trashPath: {
    input: '/synthetic/repo/docs/old.md',
    output: undefined,
  },
  repoScope: {
    input: '/synthetic/repo',
    output: {
      hiddenPaths: ['/synthetic/repo/src/generated'],
      pinnedPaths: ['/synthetic/repo/README.md'],
    },
  },
} as const
