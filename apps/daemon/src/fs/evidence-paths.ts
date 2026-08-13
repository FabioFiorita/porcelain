import { join } from 'node:path'
import { projectEvidenceDir } from '@shared/project-porcelain'

/**
 * The evidence pack lives as a directory of files on disk under the project:
 *   <repo>/.porcelain/active-review/evidence/
 *     meta.json          — title + structured checks
 *     results/           — the Results document set (md / html)
 *     assets/            — the images the Assets gallery lists
 *     index.html         — READ-ONLY legacy: the single page from before Evidence
 *                          had sub-tabs, still rendered as "Report". REV-009
 *                          retires it with `loopEvidenceHtml`.
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
