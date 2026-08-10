import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../daemon-composition/expected-failure'
import { toTrpcError } from '../daemon-composition/public-error'
import { inlineLocalAssets } from '../fs/evidence-assets'
import { uniqueDuplicatePath } from '../fs/fs-ops'
import { imageMimeForPath, isBinaryBuffer } from '../fs/image-mime'
import { moveToTrash } from '../fs/move-to-trash'
import { expandUserPath } from '../fs/path-expand'
import { exceedsReadLimit } from '../fs/read-limits'
import { gitGrep, gitListSearchFiles, gitSearchCode } from '../git/git'
import { fuzzySearch, type SearchResult } from '../search/fuzzy'
import { searchCandidates } from '../search/search-candidates'
import { MAX_HTML_BYTES } from '../stores/evidence-store'
import { hiddenPathsForRepo } from '../stores/scope-store'
import { publicProcedure, t } from '../trpc'

export type FileView =
  | { type: 'text'; content: string }
  | { type: 'image'; dataUrl: string }
  | { type: 'binary'; size: number }
  | { type: 'too-large'; size: number }
  | { type: 'not-found' }

export const filesRouter = t.router({
  readFile: publicProcedure
    .input(procedureCatalog.readFile.input)
    .output(procedureCatalog.readFile.output)
    .query(async ({ input }): Promise<FileView> => {
      // Agents (and humans pasting paths) use ~/… and file://…; expand on the daemon
      // host so a remote environment resolves its own home, not the client's.
      const path = expandUserPath(input)
      try {
        const info = await stat(path)
        if (exceedsReadLimit(info.size)) {
          return { type: 'too-large', size: info.size }
        }
        const imageMime = imageMimeForPath(path)
        if (imageMime) {
          const buffer = await readFile(path)
          return { type: 'image', dataUrl: `data:${imageMime};base64,${buffer.toString('base64')}` }
        }
        const buffer = await readFile(path)
        if (isBinaryBuffer(buffer)) {
          return { type: 'binary', size: buffer.length }
        }
        return { type: 'text', content: buffer.toString('utf8') }
      } catch (err) {
        // The file vanished (deleted on disk while a stale tree row still points at
        // it) — surface a clean state instead of a raw ENOENT; the viewer refreshes
        // the tree so the phantom row drops.
        if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
          return { type: 'not-found' }
        }
        throw err
      }
    }),

  // HTML preview for the built-in viewer: read a .html/.htm file and inline
  // sibling relative images as data URIs so a sandboxed srcdoc can show them
  // under the app CSP (same helper and size cap as loop evidence).
  previewHtml: publicProcedure
    .input(procedureCatalog.previewHtml.input)
    .output(procedureCatalog.previewHtml.output)
    .query(async ({ input }): Promise<string | null> => {
      try {
        const info = await stat(input)
        if (exceedsReadLimit(info.size) || info.size > MAX_HTML_BYTES) return null
        const raw = await readFile(input, 'utf8')
        if (raw.length === 0) return null
        if (Buffer.byteLength(raw, 'utf8') > MAX_HTML_BYTES) return null
        const html = await inlineLocalAssets(dirname(input), raw)
        if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) return null
        return html
      } catch (err) {
        if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return null
        throw err
      }
    }),

  writeTextFile: publicProcedure
    .input(procedureCatalog.writeTextFile.input)
    .output(procedureCatalog.writeTextFile.output)
    .mutation(async ({ input }) => {
      await writeFile(input.path, input.content, 'utf8')
    }),

  // Create an empty file at an absolute path. `wx` fails if it already exists, so a
  // collision surfaces as an error instead of silently clobbering the file.
  createFile: publicProcedure
    .input(procedureCatalog.createFile.input)
    .output(procedureCatalog.createFile.output)
    .mutation(async ({ input }) => {
      await writeFile(input.path, '', { flag: 'wx' })
    }),

  // Create a directory; throws (EEXIST) if one is already there — no recursive so a
  // typo can't quietly conjure a whole path.
  createFolder: publicProcedure
    .input(procedureCatalog.createFolder.input)
    .output(procedureCatalog.createFolder.output)
    .mutation(async ({ input }) => {
      await mkdir(input.path)
    }),

  // Move/rename within the repo. `rename` overwrites an existing target on POSIX, so we
  // guard first — a rename should never destroy the file it lands on.
  renamePath: publicProcedure
    .input(procedureCatalog.renamePath.input)
    .output(procedureCatalog.renamePath.output)
    .mutation(async ({ input }) => {
      if (input.to !== input.from && existsSync(input.to)) {
        throw toTrpcError(expectedFailure('state.conflict'))
      }
      await rename(input.from, input.to)
    }),

  // Copy a file or directory to a free "… copy" sibling and return the new path so the
  // caller can reveal it.
  duplicatePath: publicProcedure
    .input(procedureCatalog.duplicatePath.input)
    .output(procedureCatalog.duplicatePath.output)
    .mutation(async ({ input }): Promise<string> => {
      const info = await stat(input.path)
      const target = uniqueDuplicatePath(input.path, info.isDirectory(), existsSync)
      await cp(input.path, target, { recursive: info.isDirectory() })
      return target
    }),

  searchText: publicProcedure
    .input(procedureCatalog.searchText.input)
    .output(procedureCatalog.searchText.output)
    .query(({ input }) => gitGrep(input.repoPath, input.query)),

  searchCode: publicProcedure
    .input(procedureCatalog.searchCode.input)
    .output(procedureCatalog.searchCode.output)
    .query(({ input }) =>
      gitSearchCode(input.repoPath, {
        query: input.query,
        regex: input.regex,
        caseSensitive: input.caseSensitive,
        include: input.include,
        exclude: input.exclude,
      }),
    ),

  trashPath: publicProcedure
    .input(procedureCatalog.trashPath.input)
    .output(procedureCatalog.trashPath.output)
    .mutation(async ({ input }) => {
      await moveToTrash(input)
    }),

  searchFiles: publicProcedure
    .input(procedureCatalog.searchFiles.input)
    .output(procedureCatalog.searchFiles.output)
    .query(async ({ input }): Promise<SearchResult[]> => {
      if (input.query.trim() === '') return []
      const [files, hidden] = await Promise.all([
        gitListSearchFiles(input.repoPath),
        hiddenPathsForRepo(input.repoPath),
      ])
      const { paths, dirs } = searchCandidates(input.repoPath, files, hidden)
      return fuzzySearch(input.query, paths, 50).map((r) => ({
        path: r.path,
        kind: dirs.has(r.path) ? 'dir' : 'file',
      }))
    }),
})
