import {
  cp as defaultCp,
  lstat as defaultLstat,
  mkdir as defaultMkdir,
  readFile as defaultReadFile,
  rename as defaultRename,
  stat as defaultStat,
  writeFile as defaultWriteFile,
} from 'node:fs/promises'
import { dirname, relative } from 'node:path'
import { inlineLocalAssets } from '../../fs/evidence-assets'
import { imageMimeForPath, isBinaryBuffer } from '../../fs/image-mime'
import { moveToTrash as defaultMoveToTrash } from '../../fs/move-to-trash'
import { exceedsReadLimit } from '../../fs/read-limits'
import {
  joinLexical,
  resolveExisting,
  resolveMissingCapable,
  resolveProjectRoot,
} from './files-path-resolve'
import type { WorkspaceFiles } from './files-ports'
import { entryExists, uniqueDuplicatePath } from './unique-duplicate-path'

const MAX_DUPLICATE_CP_ATTEMPTS = 32

/**
 * Read-side cap on inlined HTML preview bytes — deliberately higher than the CLI
 * `evidence set` payload cap (1.5 MB), because sibling screenshots are inlined as
 * `data:` URIs here. Keep in lockstep with `READ_MAX_HTML_BYTES` in
 * `apps/cli/src/evidence-file.ts`, which warns against the same ceiling.
 */
const MAX_HTML_BYTES = 4_194_304

/** Host I/O surface used after containment — injectable for deterministic post-I/O errno tests. */
export type WorkspaceFilesHostIo = {
  writeFile: typeof defaultWriteFile
  mkdir: typeof defaultMkdir
  rename: typeof defaultRename
  cp: typeof defaultCp
  readFile: typeof defaultReadFile
  stat: typeof defaultStat
  lstat: typeof defaultLstat
  moveToTrash: typeof defaultMoveToTrash
}

function errnoCode(err: unknown): string | undefined {
  return err instanceof Error && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined
}

async function requireRoot(projectPath: string): Promise<string> {
  const root = await resolveProjectRoot(projectPath)
  if (!root.ok) {
    // Unusable project root is not a public Files code → ERR boundary → internal.unexpected.
    throw new Error(`files: unusable project root: ${projectPath}`)
  }
  return root.projectRootReal
}

export function createNodeWorkspaceFiles(
  hostIo: Partial<WorkspaceFilesHostIo> = {},
): WorkspaceFiles {
  const writeFile = hostIo.writeFile ?? defaultWriteFile
  const mkdir = hostIo.mkdir ?? defaultMkdir
  const rename = hostIo.rename ?? defaultRename
  const cp = hostIo.cp ?? defaultCp
  const readFile = hostIo.readFile ?? defaultReadFile
  const stat = hostIo.stat ?? defaultStat
  const lstat = hostIo.lstat ?? defaultLstat
  const moveToTrash = hostIo.moveToTrash ?? defaultMoveToTrash

  return {
    async readFile(input) {
      const projectRootReal = await requireRoot(input.projectPath)
      const resolved = await resolveExisting(projectRootReal, input.path)
      if (!resolved.ok) {
        if (resolved.error.code === 'path-outside-project') {
          return { ok: false, error: resolved.error }
        }
        // Soft success for truly missing — FileView not-found, not files.not-found.
        return { ok: true, value: { type: 'not-found' } }
      }

      const { resolvedAbsolute, lexicalAbsolute } = resolved.value
      try {
        const info = await stat(resolvedAbsolute)
        if (exceedsReadLimit(info.size)) {
          return { ok: true, value: { type: 'too-large', size: info.size } }
        }
        // MIME from lexical filename (symlink entry name), not the outside target name.
        const imageMime = imageMimeForPath(lexicalAbsolute)
        if (imageMime) {
          const buffer = await readFile(resolvedAbsolute)
          return {
            ok: true,
            value: {
              type: 'image',
              dataUrl: `data:${imageMime};base64,${buffer.toString('base64')}`,
            },
          }
        }
        const buffer = await readFile(resolvedAbsolute)
        if (isBinaryBuffer(buffer)) {
          return { ok: true, value: { type: 'binary', size: buffer.length } }
        }
        return { ok: true, value: { type: 'text', content: buffer.toString('utf8') } }
      } catch (err) {
        // Post-I/O ENOENT after successful containment → soft FileView not-found.
        if (errnoCode(err) === 'ENOENT') {
          return { ok: true, value: { type: 'not-found' } }
        }
        throw err
      }
    },

    async previewHtml(input) {
      const projectRootReal = await requireRoot(input.projectPath)
      const resolved = await resolveExisting(projectRootReal, input.path)
      if (!resolved.ok) {
        if (resolved.error.code === 'path-outside-project') {
          return { ok: false, error: resolved.error }
        }
        return { ok: true, value: null }
      }

      const { resolvedAbsolute, lexicalAbsolute } = resolved.value
      try {
        const info = await stat(resolvedAbsolute)
        if (exceedsReadLimit(info.size) || info.size > MAX_HTML_BYTES) {
          return { ok: true, value: null }
        }
        const raw = await readFile(resolvedAbsolute, 'utf8')
        if (raw.length === 0) return { ok: true, value: null }
        if (Buffer.byteLength(raw, 'utf8') > MAX_HTML_BYTES) return { ok: true, value: null }
        const html = await inlineLocalAssets(
          dirname(lexicalAbsolute), // resolution base — lexical document directory
          raw,
          projectRootReal, // containment root
        )
        if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) return { ok: true, value: null }
        return { ok: true, value: html }
      } catch (err) {
        if (errnoCode(err) === 'ENOENT') return { ok: true, value: null }
        throw err
      }
    },

    async writeTextFile(input) {
      const projectRootReal = await requireRoot(input.projectPath)
      const dest = await resolveMissingCapable(projectRootReal, input.path)
      if (!dest.ok) return { ok: false, error: dest.error }

      // Always write lexicalAbsolute after containment proof; ioAbsolute is authorization evidence only.
      try {
        await writeFile(dest.value.lexicalAbsolute, input.content, 'utf8')
        return { ok: true, value: undefined }
      } catch (err) {
        if (errnoCode(err) === 'ENOENT') {
          return { ok: false, error: { code: 'not-found', path: input.path } }
        }
        throw err
      }
    },

    async createFile(input) {
      const projectRootReal = await requireRoot(input.projectPath)
      const dest = await resolveMissingCapable(projectRootReal, input.path)
      if (!dest.ok) return { ok: false, error: dest.error }

      try {
        await writeFile(dest.value.lexicalAbsolute, '', { flag: 'wx' })
        return { ok: true, value: undefined }
      } catch (err) {
        const code = errnoCode(err)
        if (code === 'EEXIST') {
          return { ok: false, error: { code: 'already-exists', path: input.path } }
        }
        if (code === 'ENOENT') {
          return { ok: false, error: { code: 'not-found', path: input.path } }
        }
        throw err
      }
    },

    async createFolder(input) {
      const projectRootReal = await requireRoot(input.projectPath)
      const dest = await resolveMissingCapable(projectRootReal, input.path)
      if (!dest.ok) return { ok: false, error: dest.error }

      try {
        await mkdir(dest.value.lexicalAbsolute)
        return { ok: true, value: undefined }
      } catch (err) {
        const code = errnoCode(err)
        if (code === 'EEXIST') {
          return { ok: false, error: { code: 'already-exists', path: input.path } }
        }
        if (code === 'ENOENT') {
          return { ok: false, error: { code: 'not-found', path: input.path } }
        }
        throw err
      }
    },

    async renamePath(input) {
      const projectRootReal = await requireRoot(input.projectPath)
      const fromResolved = await resolveExisting(projectRootReal, input.from)
      if (!fromResolved.ok) return { ok: false, error: fromResolved.error }
      const toResolved = await resolveMissingCapable(projectRootReal, input.to)
      if (!toResolved.ok) return { ok: false, error: toResolved.error }

      // Best-effort non-clobber precheck. Node/POSIX cannot provide portable atomic
      // no-replace rename — a race can still overwrite between precheck and rename.
      // Do not claim “never overwrite.”
      if (input.from !== input.to && entryExists(toResolved.value.lexicalAbsolute)) {
        return { ok: false, error: { code: 'destination-exists' } }
      }

      try {
        await rename(fromResolved.value.lexicalAbsolute, toResolved.value.lexicalAbsolute)
        return { ok: true, value: undefined }
      } catch (err) {
        const code = errnoCode(err)
        if (code === 'ENOENT') {
          // Recheck: missing from → not-found(from); missing dirname(to) → not-found(to); else throw.
          let fromMissing = false
          try {
            await lstat(fromResolved.value.lexicalAbsolute)
          } catch (fromErr) {
            if (errnoCode(fromErr) === 'ENOENT') fromMissing = true
            else throw fromErr
          }
          if (fromMissing) {
            return { ok: false, error: { code: 'not-found', path: input.from } }
          }
          let toParentMissing = false
          try {
            await lstat(dirname(toResolved.value.lexicalAbsolute))
          } catch (toErr) {
            if (errnoCode(toErr) === 'ENOENT') toParentMissing = true
            else throw toErr
          }
          if (toParentMissing) {
            return { ok: false, error: { code: 'not-found', path: input.to } }
          }
          throw err
        }
        if (code === 'EEXIST') {
          return { ok: false, error: { code: 'destination-exists' } }
        }
        throw err
      }
    },

    async duplicatePath(input) {
      const projectRootReal = await requireRoot(input.projectPath)
      const source = await resolveExisting(projectRootReal, input.path)
      if (!source.ok) return { ok: false, error: source.error }

      // isDir from stat(resolvedAbsolute) — follow contained symlink-to-directory for naming
      // while cp still acts on lexicalAbsolute (the entry).
      let isDir: boolean
      try {
        isDir = (await stat(source.value.resolvedAbsolute)).isDirectory()
      } catch (err) {
        if (errnoCode(err) === 'ENOENT') {
          return { ok: false, error: { code: 'not-found', path: input.path } }
        }
        throw err
      }

      for (let attempt = 1; attempt <= MAX_DUPLICATE_CP_ATTEMPTS; attempt++) {
        const dest = uniqueDuplicatePath(source.value.lexicalAbsolute, isDir, entryExists)
        const destRelative = relative(projectRootReal, dest)
        const destJoined = joinLexical(projectRootReal, destRelative)
        if (!destJoined.ok) {
          return { ok: false, error: { code: 'path-outside-project', path: input.path } }
        }

        try {
          await cp(source.value.lexicalAbsolute, dest, {
            recursive: isDir,
            force: false,
            errorOnExist: true,
          })
          // Project-relative wire path (POSIX relative string).
          return { ok: true, value: destRelative }
        } catch (err) {
          const code = errnoCode(err)
          if (code === 'ERR_FS_CP_EEXIST' || code === 'EEXIST') {
            continue // reselect next free name via entryExists
          }
          if (code === 'ENOENT') {
            return { ok: false, error: { code: 'not-found', path: input.path } }
          }
          throw err
        }
      }
      throw new Error('duplicatePath: collision retries exhausted')
    },

    async trashPath(input) {
      const projectRootReal = await requireRoot(input.projectPath)
      const resolved = await resolveExisting(projectRootReal, input.path)
      if (!resolved.ok) return { ok: false, error: resolved.error }

      try {
        // Trash the entry, not the outside target of a symlink.
        await moveToTrash(resolved.value.lexicalAbsolute)
        return { ok: true, value: undefined }
      } catch (err) {
        if (errnoCode(err) === 'ENOENT') {
          return { ok: false, error: { code: 'not-found', path: input.path } }
        }
        throw err
      }
    },
  }
}
