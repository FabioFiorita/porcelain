import { join } from 'node:path'
import { projectEvidenceDir } from '@shared/project-porcelain'

/**
 * Loop evidence lives as a directory of files on disk under the project:
 *   <repo>/.porcelain/evidence/
 *     index.html
 *     meta.json
 *     *.png / …
 *
 * Agents write with normal file tools; Porcelain reads and renders. Default
 * `.porcelain/.gitignore` ignores this tree (can be un-ignored to share).
 *
 * Keep in lockstep with `apps/cli/src/evidence-file.ts`.
 */

export function evidenceDirForRepo(repoPath: string): string {
  return projectEvidenceDir(repoPath)
}

export function evidenceIndexPath(repoPath: string): string {
  return join(evidenceDirForRepo(repoPath), 'index.html')
}

export function evidenceMetaPath(repoPath: string): string {
  return join(evidenceDirForRepo(repoPath), 'meta.json')
}

/** @deprecated home loop-evidence root is no longer used for active packs. */
export function loopEvidenceRoot(): string {
  return process.env.PORCELAIN_LOOP_EVIDENCE_DIR ?? ''
}
