import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import {
  type EvidenceCheck,
  type EvidenceCheckStatus,
  evidenceOverallStatus,
  MAX_CHECK_DETAIL,
  MAX_CHECK_LABEL,
  MAX_CHECKS,
} from '@shared/evidence-check'
import {
  EVIDENCE_RESULTS_DIR,
  projectEvidenceAssetsDir,
  projectEvidenceDir,
  projectEvidenceResultsDir,
} from '@shared/project-porcelain'
import { listDocSet, orderDocSet } from './doc-set-file'
import { listAssets } from './evidence-assets'
import { htmlPreview } from './html-input'
import { ensureProjectDir } from './project-io'

export { listAssets } from './evidence-assets'

// Builtins only — see cli.ts. Evidence is a **three-part pack on disk**:
//
//   <repo>/.porcelain/active-review/evidence/
//     meta.json    — { title, repoPath, updatedAt, checks[] }   → the Checks sub-tab
//     results/     — an ordered .md/.html document set (meta.json {tabs})  → Results
//     assets/      — a flat directory of media and safe .url links, rendered natively  → Assets gallery
//
// Agents SHOULD write those files with normal Write tools (no CLI payload limits).
// `porcelain evidence prepare` with a title only makes the directories and returns
// the paths. The document-set manifest shape and the check shape/caps are owned by
// @shared/doc-set-file and @shared/evidence-check, which the daemon reads back.

/**
 * The CLI `set` payload cap stays small on purpose — it steers agents to the
 * write-files path for anything with screenshots. The READ-side cap in
 * apps/daemon/src/features/files/workspace-files.ts is higher (4 MB) to give inlined
 * screenshots headroom after data-URI inlining.
 */
export const MAX_HTML_BYTES = 1_572_864

// One owner for the check shape, its caps and its derived status: @shared/evidence-check.
export { evidenceOverallStatus } from '@shared/evidence-check'

/**
 * Viewer read-side ceiling after data-URI inlining (the `MAX_HTML_BYTES` in
 * `apps/daemon/src/features/files/workspace-files.ts`). Exceeding it makes the app
 * show "Evidence too large" instead of the HTML body.
 */
const READ_MAX_HTML_BYTES = 4_194_304

export interface Evidence {
  title: string
  html: string
  updatedAt: string
  dir: string
  /** Where the report was found, relative to `dir` — always `results/index.html`. */
  file: string
}

interface EvidenceMeta {
  title: string
  repoPath: string
  updatedAt: string
  checks?: EvidenceCheck[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

export function evidenceDirForRepo(repoPath: string): string {
  return projectEvidenceDir(repoPath)
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
  ensureProjectDir(repoPath)
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
  ensureProjectDir(repoPath)
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

export interface PreparedEvidence {
  dir: string
  resultsDir: string
  assetsDir: string
  title: string
  updatedAt: string
}

/**
 * Prepare a fresh evidence pack for a repo: the directory, `results/`, `assets/`,
 * and the meta that carries the title.
 *
 * Wipes any previous pack (documents, screenshots, checks) first so agents never
 * stack stale images from an older review under a new title. Agents then write
 * documents into `results/` and drop screenshots into `assets/`.
 */
export function prepareEvidence(repoPath: string, title: unknown): PreparedEvidence {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('title must be a non-empty string')
  }
  clearEvidence(repoPath)
  const meta = writeMeta(repoPath, title)
  const resultsDir = projectEvidenceResultsDir(repoPath)
  const assetsDir = projectEvidenceAssetsDir(repoPath)
  mkdirSync(resultsDir, { recursive: true })
  mkdirSync(assetsDir, { recursive: true })
  return {
    dir: evidenceDirForRepo(repoPath),
    resultsDir,
    assetsDir,
    title: meta.title,
    updatedAt: meta.updatedAt,
  }
}

/**
 * Write `results/index.html` into a clean pack (and meta). Prefer prepareEvidence +
 * agent Write tools for large documents. Clears the prior pack first so old
 * screenshots cannot linger beside a new body.
 *
 * The document goes to `results/`, NOT the evidence root: the root `index.html` era
 * is retired, and a pack that mixes the two makes an agent guess which one the
 * human is reading.
 */
export function setEvidence(repoPath: string, title: unknown, html: unknown): Evidence {
  const valid = validateEvidence(title, html)
  const prepared = prepareEvidence(repoPath, valid.title)
  const indexPath = join(prepared.resultsDir, 'index.html')
  const tmp = `${indexPath}.tmp`
  writeFileSync(tmp, valid.html)
  renameSync(tmp, indexPath)
  return {
    ...valid,
    updatedAt: prepared.updatedAt,
    dir: prepared.dir,
    file: `${EVIDENCE_RESULTS_DIR}/index.html`,
  }
}

export function clearEvidence(repoPath: string): void {
  rmSync(evidenceDirForRepo(repoPath), { recursive: true, force: true })
}

/**
 * The pack's primary report, for the `get` summary: `results/index.html`. A pack
 * with no report at all is not "no evidence" — checks and a gallery are evidence
 * too — so `describeEvidence` reports those separately.
 */
export function getEvidence(repoPath: string): Evidence | null {
  return readReport(evidenceDirForRepo(repoPath), `${EVIDENCE_RESULTS_DIR}/index.html`)
}

function readReport(dir: string, file: string): Evidence | null {
  const path = join(dir, file)
  let html: string
  try {
    html = readFileSync(path, 'utf8')
  } catch {
    return null
  }
  if (!html) return null
  let title = 'Evidence'
  let updatedAt = ''
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
    const meta = isRecord(parsed) ? parsed : {}
    if (typeof meta.title === 'string' && meta.title.trim()) title = meta.title.trim()
    if (typeof meta.updatedAt === 'string') updatedAt = meta.updatedAt
  } catch {
    try {
      updatedAt = statSync(path).mtime.toISOString()
    } catch {
      // ignore — a report with no timestamp still renders
    }
  }
  return { title, html, updatedAt, dir, file }
}

/** Pin the Results tab order (see `orderDocSet`). */
export function orderResults(repoPath: string, files: string[]): string[] {
  if (files.length > 0) ensureProjectDir(repoPath)
  return orderDocSet(projectEvidenceResultsDir(repoPath), files, 'evidence/results/')
}

/** The renderable documents in `evidence/results/`, name-sorted. */
export function listResults(repoPath: string): string[] {
  return listDocSet(projectEvidenceResultsDir(repoPath))
}

interface LocalRef {
  /** Exactly as the document wrote it, so the warning names what to fix. */
  raw: string
  /** Null when nothing is at that path — a ref that will render as a broken image. */
  bytes: number | null
}

/**
 * The local images a document references, deduped, in document order.
 *
 * Refs resolve from the document's own directory but must land inside `root` (the
 * evidence directory), which is exactly what the daemon does — that is how a
 * Results document's `../assets/shot.png` counts, while `../../../secrets.png`
 * does not (it is not a broken ref, it is one the viewer will never inline).
 */
function localRefs(docDir: string, html: string, root: string): LocalRef[] {
  const re = /\bsrc\s*=\s*(["'])(?!data:|https?:|\/\/|blob:|about:)([^"']+)\1/gi
  const seen = new Set<string>()
  const refs: LocalRef[] = []
  for (const match of html.matchAll(re)) {
    const raw = match[2]?.trim()
    if (!raw || seen.has(raw) || raw.startsWith('/')) continue
    seen.add(raw)
    const path = resolve(docDir, raw)
    const rel = relative(resolve(root), path)
    if (rel === '' || rel.startsWith('..')) continue
    try {
      refs.push({ raw, bytes: statSync(path).size })
    } catch {
      refs.push({ raw, bytes: null })
    }
  }
  return refs
}

/**
 * Rough post-inline size: HTML bytes + base64 expansion (~4/3) of the local images
 * a document references. A ref with nothing behind it inlines as nothing.
 */
function estimateInlinedBytes(html: string, refs: LocalRef[]): number {
  let total = Buffer.byteLength(html, 'utf8')
  for (const ref of refs) {
    // base64 expands ~4/3; data: URL prefix is small enough to ignore for the warn.
    if (ref.bytes !== null) total += Math.ceil((ref.bytes * 4) / 3)
  }
  return total
}

/**
 * A ref the agent wrote and never produced — the single most expensive evidence
 * bug, because the report looks finished and the human sees a broken image. The
 * containment rule above means these are all refs the viewer WOULD have inlined.
 */
function missingRefsNote(file: string, refs: LocalRef[]): string {
  return refs
    .filter((ref) => ref.bytes === null)
    .map(
      (ref) =>
        `\nWARNING: ${file} references ${ref.raw}, which is not on disk — it renders as a broken image. Write the file, or fix the path.`,
    )
    .join('')
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** The Results tab list and the gallery count — the two sub-tabs `get` cannot preview. */
function packSummary(repoPath: string): string {
  const results = listResults(repoPath)
  const assets = listAssets(repoPath)
  const galleryCount = assets.filter((a) => a.warning === undefined).length
  const lines = [
    results.length === 0
      ? `\nResults: (none) — write .md / .html into ${projectEvidenceResultsDir(repoPath)}`
      : `\nResults: ${results.length} document(s): ${results.join(', ')}`,
    `\nAssets: ${galleryCount} asset(s) in the gallery${assets.length > galleryCount ? ` (${assets.length - galleryCount} not shown)` : ''}`,
  ]
  for (const asset of assets) {
    if (asset.warning !== undefined)
      lines.push(`\nWARNING: assets/${asset.file} — ${asset.warning}`)
  }
  return lines.join('')
}

export function describeEvidence(repoPath: string, evidence: Evidence | null): string {
  const dir = evidenceDirForRepo(repoPath)
  const checks = checksSummary(readChecksForRepo(repoPath))
  const pack = packSummary(repoPath)
  if (!evidence) {
    return `No evidence report for ${repoPath}. Preferred flow: run \`porcelain evidence prepare --title <title>\` — it returns three paths; write .md/.html documents into results/ and drop screenshots into assets/ with normal file tools, referencing them as <img src="../assets/shot.png">. Porcelain picks it up automatically. Do NOT push large HTML through the CLI.${checks}${pack}`
  }
  const bytes = Buffer.byteLength(evidence.html, 'utf8')
  const when = evidence.updatedAt ? ` (updated ${evidence.updatedAt})` : ''
  const preview = `\nPreview: ${htmlPreview(evidence.html)}`
  const path = join(dir, evidence.file)
  const refs = localRefs(join(path, '..'), evidence.html, dir)
  const missing = missingRefsNote(evidence.file, refs)
  const estimated = estimateInlinedBytes(evidence.html, refs)
  const sizeNote =
    estimated > READ_MAX_HTML_BYTES
      ? `\nWARNING: estimated inlined size ~${formatMb(estimated)} exceeds the viewer cap (${formatMb(READ_MAX_HTML_BYTES)}). Porcelain will show "Evidence too large" instead of the HTML body — shrink screenshots (e.g. JPEG ~540px) and rewrite the document.`
      : bytes > READ_MAX_HTML_BYTES
        ? `\nWARNING: ${evidence.file} is ${formatMb(bytes)} over the viewer cap (${formatMb(READ_MAX_HTML_BYTES)}). Porcelain will show "Evidence too large" — shrink the document.`
        : ''
  return `Evidence "${evidence.title}" for ${repoPath}: ${bytes} bytes at ${path}${when}. Open that path in a browser, or Review tab → Evidence in Porcelain.${checks}${pack}${missing}${sizeNote}${preview}`
}
