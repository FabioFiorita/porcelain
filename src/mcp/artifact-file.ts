import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { htmlPreview } from './html-input'

// Builtins only — see protocol.ts for why this server must stay dependency-free.
// This file owns the feature-artifact channel that Porcelain reads (src/main/
// artifact-store.ts reads the same path); both honour PORCELAIN_ARTIFACTS so tests
// and dev can redirect it. Default lives in ~/.porcelain (the user's home, NOT a work
// repo). The MCP server AUTHORS artifacts; the app READS them — and makes exactly one
// write, clearArtifact (user-initiated). Porcelain re-validates + size-caps this file
// with zod on read, so reads here stay lenient.

/**
 * The artifact HTML is rendered in a FULLY SANDBOXED iframe, so it must be one
 * self-contained document (no scripts run, no external resource loads). Cap it well
 * below the point where shuttling it over IPC and re-parsing it hurts; the app rejects
 * anything larger too. 1.5 MB is generous for prose + inline SVG + a few data-URI
 * images, and forces genuinely huge embeds to be slimmed instead of pasted whole.
 */
export const MAX_HTML_BYTES = 1_572_864

export interface Artifact {
  title: string
  html: string
  updatedAt: string
}

type Artifacts = Record<string, Artifact>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function artifactsPath(): string {
  return process.env.PORCELAIN_ARTIFACTS ?? join(homedir(), '.porcelain', 'artifacts.json')
}

/**
 * Validate the agent's title + html up front (like toReviewFiles), throwing a clear
 * message the agent can act on. Enforced here AND re-checked on the app's read.
 */
export function validateArtifact(title: unknown, html: unknown): { title: string; html: string } {
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

function readAll(): Artifacts {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(artifactsPath(), 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const all: Artifacts = {}
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

function writeAll(all: Artifacts): void {
  const path = artifactsPath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(all, null, 2))
  renameSync(tmp, path)
}

/** Author (or replace) a repo's feature artifact. Validates before it writes. */
export function setArtifact(repoPath: string, title: unknown, html: unknown): Artifact {
  const valid = validateArtifact(title, html)
  const artifact: Artifact = { ...valid, updatedAt: new Date().toISOString() }
  const all = readAll()
  all[repoPath] = artifact
  writeAll(all)
  return artifact
}

export function clearArtifact(repoPath: string): void {
  const all = readAll()
  if (!(repoPath in all)) return
  delete all[repoPath]
  writeAll(all)
}

/** Read back the stored artifact for a repo (null when none is set). */
export function getArtifact(repoPath: string): Artifact | null {
  return readAll()[repoPath] ?? null
}

/**
 * Render a repo's stored artifact for the read tool: a summary (title, size, when it
 * was last set) plus a short content preview so the agent can confirm WHAT it pushed
 * (not just the byte count) without echoing the whole document back.
 */
export function describeArtifact(repoPath: string, artifact: Artifact | null): string {
  if (!artifact) {
    return `No feature artifact for ${repoPath}. Use set_feature_artifact to author a self-contained HTML document that explains the feature; Porcelain renders it in the viewer.`
  }
  const bytes = Buffer.byteLength(artifact.html, 'utf8')
  const when = artifact.updatedAt ? ` (updated ${artifact.updatedAt})` : ''
  return `Feature artifact "${artifact.title}" for ${repoPath}: ${bytes} bytes of HTML${when}.\nPreview: ${htmlPreview(artifact.html)}`
}
