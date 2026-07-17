import { readFileSync, statSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

// Builtins only — see protocol.ts. Shared by set_feature_artifact / set_loop_evidence
// so agents can pass a local file path instead of inlining multi-hundred-KB HTML
// (base64 screenshots) through the tool-call channel, which is slow and fragile.

/**
 * Resolve the document body for set_feature_artifact / set_loop_evidence.
 * Exactly one of `html` (inline string) or `htmlFile` (absolute path the MCP
 * process reads locally) is required. Prefer `htmlFile` for anything with
 * embedded screenshots — the agent writes the file, then passes the path.
 */
export function resolveToolHtml(args: Record<string, unknown>, maxBytes: number): string {
  const html = typeof args.html === 'string' ? args.html : undefined
  const htmlFile = typeof args.htmlFile === 'string' ? args.htmlFile.trim() : undefined
  const hasHtml = html !== undefined && html.length > 0
  const hasFile = htmlFile !== undefined && htmlFile.length > 0
  if (hasHtml && hasFile) {
    throw new Error('provide html or htmlFile, not both')
  }
  if (!hasHtml && !hasFile) {
    throw new Error('html or htmlFile is required')
  }
  if (hasFile) {
    return readHtmlFile(htmlFile, maxBytes)
  }
  // hasHtml — non-empty string; size still enforced by validateArtifact/Evidence.
  return html as string
}

/** Read a local HTML document for a set_* tool. Absolute path only; size-capped. */
export function readHtmlFile(path: string, maxBytes: number): string {
  if (!isAbsolute(path)) {
    throw new Error(`htmlFile must be an absolute path, got "${path}"`)
  }
  const resolved = resolve(path)
  let size: number
  try {
    size = statSync(resolved).size
  } catch {
    throw new Error(`htmlFile not readable: ${resolved}`)
  }
  // Refuse before reading so a multi-GB path cannot OOM the stdio MCP process.
  if (size > maxBytes) {
    throw new Error(
      `htmlFile is ${size} bytes, over the ${maxBytes}-byte limit — slim it down (drop or shrink embedded images/data URIs, trim the prose).`,
    )
  }
  let content: string
  try {
    content = readFileSync(resolved, 'utf8')
  } catch {
    throw new Error(`htmlFile not readable: ${resolved}`)
  }
  if (content.length === 0) {
    throw new Error('htmlFile is empty')
  }
  const bytes = Buffer.byteLength(content, 'utf8')
  if (bytes > maxBytes) {
    throw new Error(
      `htmlFile is ${bytes} bytes, over the ${maxBytes}-byte limit — slim it down (drop or shrink embedded images/data URIs, trim the prose).`,
    )
  }
  return content
}
