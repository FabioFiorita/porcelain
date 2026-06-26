import { readFile, rename, writeFile } from 'node:fs/promises'
import { relative } from 'node:path'
import { applyTextEdits, type FileEdits } from './lsp'
import { isRepoContained } from './review-store'

// Apply a WorkspaceEdit (the normalized `FileEdits[]` from `toWorkspaceEdit`) to
// disk. Every target is re-clamped to the repo before any write — a rename's edit
// set can name files anywhere, and the language server is not a trust boundary, so
// we never write outside the repo even if it asks us to. Live editor buffers win
// over disk via `overrides` (keyed by abs path) so an edit applies to what the user
// currently sees, not a stale on-disk copy. Writes are atomic (tmp + rename) so a
// crash mid-write can't leave a half-written source file.
export async function applyWorkspaceEdit(
  repo: string,
  fileEdits: FileEdits[],
  overrides: Map<string, string>,
): Promise<{ changedPaths: string[]; updatedContent: Record<string, string> }> {
  const changedPaths: string[] = []
  const updatedContent: Record<string, string> = {}

  for (const { path, edits } of fileEdits) {
    // Guard every target with the repo-relative path — an absolute path outside the
    // repo yields a `..`-prefixed relative that `isRepoContained` rejects.
    if (!isRepoContained(repo, relative(repo, path))) continue

    let text: string
    const override = overrides.get(path)
    if (override !== undefined) {
      text = override
    } else {
      try {
        text = await readFile(path, 'utf8')
      } catch {
        continue // a target we can't read (vanished, permission) is skipped
      }
    }

    const next = applyTextEdits(text, edits)
    if (next === text) continue // a no-op edit set leaves the file (and git) untouched

    const tmp = `${path}.porcelain-tmp`
    await writeFile(tmp, next, 'utf8')
    await rename(tmp, path)
    changedPaths.push(path)
    updatedContent[path] = next
  }

  return { changedPaths, updatedContent }
}
