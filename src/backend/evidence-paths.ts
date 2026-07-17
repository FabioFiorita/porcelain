import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Loop evidence lives as a **directory of files on disk**, not as HTML shuttled
 * through MCP. Agents write `index.html` (+ screenshots as sibling files) with
 * normal file tools; Porcelain reads and renders. MCP only needs to return the
 * directory path (or optionally seed title / copy a small htmlFile).
 *
 * Layout:
 *   ~/.porcelain/loop-evidence/<sha256(repoPath)[0..16]>/
 *     index.html     — required for the opener to appear
 *     meta.json      — optional { title, repoPath, updatedAt }
 *     *.png / …      — relative assets referenced from index.html
 *
 * Keep this keying formula in lockstep with `src/mcp/evidence-file.ts`
 * (dependency-free MCP cannot import this module).
 */

export function loopEvidenceRoot(): string {
  return process.env.PORCELAIN_LOOP_EVIDENCE_DIR ?? join(homedir(), '.porcelain', 'loop-evidence')
}

/** Stable short directory name for an absolute repo path. */
export function repoEvidenceKey(repoPath: string): string {
  return createHash('sha256').update(repoPath).digest('hex').slice(0, 16)
}

export function evidenceDirForRepo(repoPath: string): string {
  return join(loopEvidenceRoot(), repoEvidenceKey(repoPath))
}

export function evidenceIndexPath(repoPath: string): string {
  return join(evidenceDirForRepo(repoPath), 'index.html')
}

export function evidenceMetaPath(repoPath: string): string {
  return join(evidenceDirForRepo(repoPath), 'meta.json')
}
