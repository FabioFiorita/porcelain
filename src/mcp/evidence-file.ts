import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { htmlPreview } from './html-input'

// Builtins only — see protocol.ts. Loop evidence is a **directory of files**:
//
//   ~/.porcelain/loop-evidence/<sha256(repoPath)[0..16]>/
//     index.html   — the document Porcelain renders
//     meta.json    — { title, repoPath, updatedAt }
//     *.png / …    — screenshots with relative <img src>
//
// Agents SHOULD write those files with normal Write tools (no MCP payload limits).
// set_loop_evidence with title only prepares the dir and returns the path.
// Optional html / htmlFile still write index.html for small docs / automation.
// Keep the keying formula in lockstep with src/backend/evidence-paths.ts.

/** Keep in sync with MAX_HTML_BYTES in src/backend/evidence-store.ts. */
export const MAX_HTML_BYTES = 1_572_864

export interface Evidence {
  title: string
  html: string
  updatedAt: string
  dir: string
}

export interface EvidenceMeta {
  title: string
  repoPath: string
  updatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function loopEvidenceRoot(): string {
  return process.env.PORCELAIN_LOOP_EVIDENCE_DIR ?? join(homedir(), '.porcelain', 'loop-evidence')
}

export function repoEvidenceKey(repoPath: string): string {
  return createHash('sha256').update(repoPath).digest('hex').slice(0, 16)
}

export function evidenceDirForRepo(repoPath: string): string {
  return join(loopEvidenceRoot(), repoEvidenceKey(repoPath))
}

/** Legacy JSON channel path (read fallback only; new writes go to the directory). */
export function evidencePath(): string {
  return process.env.PORCELAIN_EVIDENCE ?? join(homedir(), '.porcelain', 'evidence.json')
}

export function validateEvidence(title: unknown, html: unknown): { title: string; html: string } {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('title must be a non-empty string')
  }
  if (typeof html !== 'string' || html.length === 0) {
    throw new Error('html must be a non-empty string')
  }
  const bytes = Buffer.byteLength(html, 'utf8')
  if (bytes > MAX_HTML_BYTES) {
    throw new Error(
      `html is ${bytes} bytes, over the ${MAX_HTML_BYTES}-byte limit — write a file to the evidence directory instead (set_loop_evidence with title only returns the path; put screenshots as sibling files).`,
    )
  }
  return { title: title.trim(), html }
}

function writeMeta(repoPath: string, title: string): EvidenceMeta {
  const dir = evidenceDirForRepo(repoPath)
  mkdirSync(dir, { recursive: true })
  const meta: EvidenceMeta = {
    title: title.trim(),
    repoPath,
    updatedAt: new Date().toISOString(),
  }
  const path = join(dir, 'meta.json')
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(meta, null, 2))
  renameSync(tmp, path)
  return meta
}

/**
 * Prepare (or refresh title for) a repo's loop-evidence directory.
 * Does not require HTML — agents write index.html themselves.
 */
export function prepareEvidence(repoPath: string, title: unknown): { dir: string; title: string } {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('title must be a non-empty string')
  }
  const meta = writeMeta(repoPath, title)
  return { dir: evidenceDirForRepo(repoPath), title: meta.title }
}

/**
 * Write index.html into the evidence directory (and meta). Prefer prepareEvidence +
 * agent Write tools for large documents.
 */
export function setEvidence(repoPath: string, title: unknown, html: unknown): Evidence {
  const valid = validateEvidence(title, html)
  const meta = writeMeta(repoPath, valid.title)
  const dir = evidenceDirForRepo(repoPath)
  const indexPath = join(dir, 'index.html')
  const tmp = `${indexPath}.tmp`
  writeFileSync(tmp, valid.html)
  renameSync(tmp, indexPath)
  return { ...valid, updatedAt: meta.updatedAt, dir }
}

export function clearEvidence(repoPath: string): void {
  rmSync(evidenceDirForRepo(repoPath), { recursive: true, force: true })
  // Also drop a legacy evidence.json entry if present.
  try {
    const path = evidencePath()
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!isRecord(parsed) || !(repoPath in parsed)) return
    delete parsed[repoPath]
    const tmp = `${path}.tmp`
    writeFileSync(tmp, JSON.stringify(parsed, null, 2))
    renameSync(tmp, path)
  } catch {
    // no legacy file
  }
}

export function getEvidence(repoPath: string): Evidence | null {
  const dir = evidenceDirForRepo(repoPath)
  const indexPath = join(dir, 'index.html')
  try {
    const html = readFileSync(indexPath, 'utf8')
    if (!html) return null
    let title = 'Loop evidence'
    let updatedAt = ''
    try {
      const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as EvidenceMeta
      if (typeof meta.title === 'string' && meta.title.trim()) title = meta.title.trim()
      if (typeof meta.updatedAt === 'string') updatedAt = meta.updatedAt
    } catch {
      try {
        updatedAt = statSync(indexPath).mtime.toISOString()
      } catch {
        // ignore
      }
    }
    return { title, html, updatedAt, dir }
  } catch {
    // fall through to legacy
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(evidencePath(), 'utf8'))
    if (!isRecord(parsed)) return null
    const value = parsed[repoPath]
    if (!isRecord(value)) return null
    const { title, html, updatedAt } = value
    if (typeof title !== 'string' || typeof html !== 'string') return null
    return {
      title,
      html,
      updatedAt: typeof updatedAt === 'string' ? updatedAt : '',
      dir,
    }
  } catch {
    return null
  }
}

export function describeEvidence(repoPath: string, evidence: Evidence | null): string {
  const dir = evidenceDirForRepo(repoPath)
  if (!evidence) {
    return `No loop evidence for ${repoPath}. Preferred flow: call set_loop_evidence with { repoPath, title } only — it returns a directory path; write index.html (and screenshots as siblings with relative <img src>) there with normal file tools. Porcelain picks it up automatically. Do NOT push large HTML through MCP.`
  }
  const bytes = Buffer.byteLength(evidence.html, 'utf8')
  const when = evidence.updatedAt ? ` (updated ${evidence.updatedAt})` : ''
  const preview = `\nPreview: ${htmlPreview(evidence.html)}`
  const hasIndex = (() => {
    try {
      statSync(join(dir, 'index.html'))
      return true
    } catch {
      return false
    }
  })()
  if (hasIndex) {
    return `Loop evidence "${evidence.title}" for ${repoPath}: ${bytes} bytes at ${dir}/index.html${when}. Open that path in a browser, or Feature tab → Loop evidence in Porcelain.${preview}`
  }
  return `Loop evidence "${evidence.title}" for ${repoPath}: ${bytes} bytes of HTML${when} (legacy channel). Prefer writing ${dir}/index.html next time.${preview}`
}
