import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { htmlPreview } from './html-input'

// Builtins only — see cli.ts. Evidence is a **directory of files**:
//
//   ~/.porcelain/loop-evidence/<sha256(repoPath)[0..16]>/
//     index.html   — the HTML document Porcelain renders (Evidence tab)
//     meta.json    — { title, repoPath, updatedAt }
//     *.png / …    — screenshots with relative <img src>
//
// Agents SHOULD write those files with normal Write tools (no CLI payload limits).
// `porcelain evidence prepare` with a title only makes the dir and returns the path.
// Optional --html / --html-file still write index.html for small docs / automation.
// Keep the keying formula in lockstep with src/backend/evidence-paths.ts.

/**
 * The CLI `set` payload cap stays small on purpose — it steers agents to the
 * write-files path for anything with screenshots. The READ-side cap in
 * src/backend/evidence-store.ts is higher (4 MB) to give inlined screenshots
 * headroom after data-URI inlining.
 */
export const MAX_HTML_BYTES = 1_572_864

export interface Evidence {
  title: string
  html: string
  updatedAt: string
  dir: string
}

// Structured verification checks. This CLI is dependency-free (Node builtins only,
// no zod), so it DUPLICATES the shape + caps that src/shared/evidence-check.ts owns
// — same deliberate duplication as the path/key helpers above. Keep them in lockstep.
export type EvidenceCheckStatus = 'pass' | 'fail' | 'skip'

export interface EvidenceCheck {
  label: string
  status: EvidenceCheckStatus
  detail?: string
}

const MAX_CHECKS = 32
const MAX_CHECK_LABEL = 120
const MAX_CHECK_DETAIL = 400

export interface EvidenceMeta {
  title: string
  repoPath: string
  updatedAt: string
  checks?: EvidenceCheck[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Derived overall status: any fail → 'fail'; all pass (≥1) → 'pass'; otherwise null. */
export function evidenceOverallStatus(checks: EvidenceCheck[]): 'pass' | 'fail' | null {
  if (checks.some((check) => check.status === 'fail')) return 'fail'
  if (checks.some((check) => check.status === 'pass')) return 'pass'
  return null
}

/**
 * Lenient reader for an existing checks list off disk: a malformed or over-cap list
 * is dropped whole (returns []) so a bad meta.json never blocks appending a new check.
 */
function coerceChecks(value: unknown): EvidenceCheck[] {
  if (!Array.isArray(value) || value.length > MAX_CHECKS) return []
  const out: EvidenceCheck[] = []
  for (const item of value) {
    if (!isRecord(item)) return []
    const { label, status, detail } = item
    if (typeof label !== 'string' || label.length === 0 || label.length > MAX_CHECK_LABEL) return []
    if (status !== 'pass' && status !== 'fail' && status !== 'skip') return []
    if (detail !== undefined && (typeof detail !== 'string' || detail.length > MAX_CHECK_DETAIL)) {
      return []
    }
    out.push(detail === undefined ? { label, status } : { label, status, detail })
  }
  return out
}

/** Validate one NEW check — throws (with a helpful message) when it breaks a cap. */
function validateCheck(label: unknown, status: unknown, detail: unknown): EvidenceCheck {
  if (typeof label !== 'string' || label.trim().length === 0) {
    throw new Error('label must be a non-empty string')
  }
  const trimmed = label.trim()
  if (trimmed.length > MAX_CHECK_LABEL) {
    throw new Error(`label is ${trimmed.length} chars, over the ${MAX_CHECK_LABEL}-char limit`)
  }
  if (status !== 'pass' && status !== 'fail' && status !== 'skip') {
    throw new Error('status must be one of pass|fail|skip')
  }
  if (detail === undefined || detail === '') return { label: trimmed, status }
  if (typeof detail !== 'string') throw new Error('detail must be a string')
  if (detail.length > MAX_CHECK_DETAIL) {
    throw new Error(`detail is ${detail.length} chars, over the ${MAX_CHECK_DETAIL}-char limit`)
  }
  return { label: trimmed, status, detail }
}

function readChecksForRepo(repoPath: string): EvidenceCheck[] {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(join(evidenceDirForRepo(repoPath), 'meta.json'), 'utf8'),
    )
    return isRecord(parsed) ? coerceChecks(parsed.checks) : []
  } catch {
    return []
  }
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
      `html is ${bytes} bytes, over the ${MAX_HTML_BYTES}-byte limit — write a file to the evidence directory instead (\`porcelain evidence prepare --title\` returns the path; put screenshots as sibling files).`,
    )
  }
  return { title: title.trim(), html }
}

function writeMeta(repoPath: string, title: string): EvidenceMeta {
  const dir = evidenceDirForRepo(repoPath)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'meta.json')
  // Carry any existing checks forward — re-running `prepare`/`set` must not wipe the
  // structured checks an agent recorded with `evidence check`.
  const checks = readChecksForRepo(repoPath)
  const meta: EvidenceMeta = {
    title: title.trim(),
    repoPath,
    updatedAt: new Date().toISOString(),
    ...(checks.length > 0 ? { checks } : {}),
  }
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(meta, null, 2))
  renameSync(tmp, path)
  return meta
}

/**
 * Append (or update in place, keyed by label) one structured verification check.
 * Creates the evidence dir + meta like `prepare` when missing — the title falls
 * back to 'Evidence'. Enforces the caps (throws over the ceiling); re-running
 * a fixed check with the same label replaces it rather than duplicating.
 */
export function checkEvidence(
  repoPath: string,
  label: unknown,
  status: unknown,
  detail: unknown,
): { check: EvidenceCheck; checks: EvidenceCheck[]; title: string } {
  const check = validateCheck(label, status, detail)
  const dir = evidenceDirForRepo(repoPath)
  const path = join(dir, 'meta.json')
  let title = 'Evidence'
  let existing: EvidenceCheck[] = []
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (isRecord(parsed)) {
      if (typeof parsed.title === 'string' && parsed.title.trim()) title = parsed.title.trim()
      existing = coerceChecks(parsed.checks)
    }
  } catch {
    // no meta yet — created below like `prepare`
  }
  const checks = [...existing]
  const at = checks.findIndex((c) => c.label === check.label)
  if (at >= 0) {
    checks[at] = check
  } else {
    if (checks.length >= MAX_CHECKS) {
      throw new Error(
        `too many checks (max ${MAX_CHECKS}) — reuse an existing label or clear the evidence`,
      )
    }
    checks.push(check)
  }
  mkdirSync(dir, { recursive: true })
  const meta: EvidenceMeta = { title, repoPath, updatedAt: new Date().toISOString(), checks }
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(meta, null, 2))
  renameSync(tmp, path)
  return { check, checks, title }
}

/** One-line summary of the recorded checks (count + per-status + derived overall). */
function checksSummary(checks: EvidenceCheck[]): string {
  if (checks.length === 0) return ''
  const count = (status: EvidenceCheckStatus): number =>
    checks.filter((c) => c.status === status).length
  const overall = evidenceOverallStatus(checks)
  const verdict = overall ? overall.toUpperCase() : 'no signal'
  return `\nChecks: ${checks.length} (${count('pass')} pass, ${count('fail')} fail, ${count('skip')} skip) → ${verdict}`
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
    let title = 'Evidence'
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
  const checks = checksSummary(readChecksForRepo(repoPath))
  if (!evidence) {
    return `No evidence for ${repoPath}. Preferred flow: run \`porcelain evidence prepare --title <title>\` — it returns a directory path; write index.html (and screenshots as siblings with relative <img src>) there with normal file tools. Porcelain picks it up automatically. Do NOT push large HTML through the CLI.${checks}`
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
    return `Evidence "${evidence.title}" for ${repoPath}: ${bytes} bytes at ${dir}/index.html${when}. Open that path in a browser, or Feature tab → Evidence in Porcelain.${checks}${preview}`
  }
  return `Evidence "${evidence.title}" for ${repoPath}: ${bytes} bytes of HTML${when} (legacy channel). Prefer writing ${dir}/index.html next time.${checks}${preview}`
}
