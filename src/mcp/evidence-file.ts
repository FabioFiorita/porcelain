import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Builtins only — see protocol.ts for why this server must stay dependency-free.
// This file owns the loop-evidence channel that Porcelain reads (src/backend/
// evidence-store.ts reads the same path); both honour PORCELAIN_EVIDENCE so tests
// and dev can redirect it. Default lives in ~/.porcelain (the user's home, NOT a work
// repo). The MCP server AUTHORS evidence; the app READS them — and makes exactly one
// write, clearEvidence (user-initiated). Porcelain re-validates + size-caps this file
// with zod on read, so reads here stay lenient.

/**
 * Loop evidence is rendered in a FULLY SANDBOXED iframe, so it must be one
 * self-contained document (no scripts run, no external resource loads). Cap it well
 * below the point where shuttling it over IPC and re-parsing it hurts; the app rejects
 * anything larger too. 1.5 MB is generous for prose + a few data-URI screenshots, and
 * forces genuinely huge embeds to be slimmed instead of pasted whole.
 */
export const MAX_HTML_BYTES = 1_572_864

export interface Evidence {
  title: string
  html: string
  updatedAt: string
}

type Evidences = Record<string, Evidence>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function evidencePath(): string {
  return process.env.PORCELAIN_EVIDENCE ?? join(homedir(), '.porcelain', 'evidence.json')
}

/**
 * Validate the agent's title + html up front (like toReviewFiles), throwing a clear
 * message the agent can act on. Enforced here AND re-checked on the app's read.
 */
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
      `html is ${bytes} bytes, over the ${MAX_HTML_BYTES}-byte limit — slim it down (drop or shrink embedded images/data URIs, trim the prose). The document must be self-contained but small.`,
    )
  }
  return { title, html }
}

function readAll(): Evidences {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(evidencePath(), 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const all: Evidences = {}
  for (const [repoPath, value] of Object.entries(parsed)) {
    if (!isRecord(value)) continue
    const { title, html, updatedAt } = value
    if (typeof title !== 'string' || typeof html !== 'string') continue
    all[repoPath] = {
      title,
      html,
      updatedAt: typeof updatedAt === 'string' ? updatedAt : '',
    }
  }
  return all
}

function writeAll(all: Evidences): void {
  const path = evidencePath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(all, null, 2))
  renameSync(tmp, path)
}

/** Author (or replace) a repo's loop evidence. Validates before it writes. */
export function setEvidence(repoPath: string, title: unknown, html: unknown): Evidence {
  const valid = validateEvidence(title, html)
  const evidence: Evidence = { ...valid, updatedAt: new Date().toISOString() }
  const all = readAll()
  all[repoPath] = evidence
  writeAll(all)
  return evidence
}

export function clearEvidence(repoPath: string): void {
  const all = readAll()
  if (!(repoPath in all)) return
  delete all[repoPath]
  writeAll(all)
}

/** Read back the stored evidence for a repo (null when none is set). */
export function getEvidence(repoPath: string): Evidence | null {
  return readAll()[repoPath] ?? null
}

/**
 * Render a repo's stored evidence for the read tool: a one-line summary (title, size,
 * when it was last set) so the agent can confirm what it pushed without echoing the
 * whole document back.
 */
export function describeEvidence(repoPath: string, evidence: Evidence | null): string {
  if (!evidence) {
    return `No loop evidence for ${repoPath}. Use set_loop_evidence to author a self-contained HTML document proving the work was validated (browser check, simulator screenshots, pass/fail steps); Porcelain renders it in the Feature tab.`
  }
  const bytes = Buffer.byteLength(evidence.html, 'utf8')
  const when = evidence.updatedAt ? ` (updated ${evidence.updatedAt})` : ''
  return `Loop evidence "${evidence.title}" for ${repoPath}: ${bytes} bytes of HTML${when}.`
}
