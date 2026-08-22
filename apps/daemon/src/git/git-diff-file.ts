import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { isBinaryBuffer, imageMimeForPath, isGitBinaryDiff } from '../fs/image-mime'
import { exceedsReadLimit } from '../fs/read-limits'
import { type DiffFileResult, parseStatus, parseUnifiedDiff, synthesizeAddDiff } from './diff'
import { runGit } from './git-exec'

/**
 * Read a path as an image data URL when the extension is a known image type and
 * the file fits the viewer size cap. Returns null when the file is missing,
 * oversized, or not an image — callers fall through to binary/text handling.
 * Shared with the range readers, which preview committed images the same way.
 */
export async function imagePreview(absPath: string, mime: string): Promise<string | null> {
  try {
    const info = await stat(absPath)
    if (exceedsReadLimit(info.size)) return null
    const buffer = await readFile(absPath)
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * `git diff -U<n>` flags for a requested context width. Omitted context keeps
 * git's default of 3 lines, so every existing caller diffs exactly as before.
 */
export function contextArgs(context: number | undefined): string[] {
  return context === undefined ? [] : [`-U${context}`]
}

export async function gitDiffFile(
  repoPath: string,
  filePath: string,
  context?: number,
): Promise<DiffFileResult> {
  const status = await runGit(repoPath, ['status', '--porcelain=v1', '-uall', '-z', '--', filePath])
  const probed = parseStatus(status)[0]?.status
  const abs = join(repoPath, filePath)
  const mime = imageMimeForPath(filePath)

  if (probed === 'untracked') {
    // Images first — never UTF-8-decode a PNG into a synthetic add hunk (that
    // was the �PNG dump in the Changes→diff viewer).
    if (mime) {
      const dataUrl = await imagePreview(abs, mime)
      if (dataUrl) return { hunks: [], status: 'untracked', image: { dataUrl } }
      return { hunks: [], status: 'untracked', binary: true }
    }
    const buffer = await readFile(abs)
    if (isBinaryBuffer(buffer)) {
      return { hunks: [], status: 'untracked', binary: true }
    }
    return { hunks: synthesizeAddDiff(buffer.toString('utf8')), status: 'untracked' }
  }

  const raw = await runGit(repoPath, [
    'diff',
    'HEAD',
    '--no-color',
    ...contextArgs(context),
    '--',
    filePath,
  ])
  const fileStatus = probed ?? 'modified'

  // Known image types (and git's own "Binary files differ" marker): never try to
  // render binary bytes as a text diff. Preview the working-tree image when present.
  if (mime || isGitBinaryDiff(raw)) {
    if (mime && fileStatus !== 'deleted') {
      const dataUrl = await imagePreview(abs, mime)
      if (dataUrl) return { hunks: [], status: fileStatus, image: { dataUrl } }
    }
    return { hunks: [], status: fileStatus, binary: true }
  }

  return { hunks: parseUnifiedDiff(raw), status: fileStatus }
}
