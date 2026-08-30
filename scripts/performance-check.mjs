#!/usr/bin/env node
/**
 * Guard the shipped renderer's initial-load artifact budget.
 *
 * This reads Vite's module entry directly from its generated HTML instead of
 * guessing from hashed asset names or picking the largest JavaScript chunk.
 * The entry is the code every renderer session must download before it can
 * become interactive; its gzip size is therefore a deterministic regression
 * signal that works on every CI platform.
 *
 * Usage:
 *   node scripts/performance-check.mjs
 */
import { gzipSync } from 'node:zlib'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

export const INITIAL_ENTRY_GZIP_BUDGET_BYTES = 525 * 1024
export const LOGO_BUDGET_BYTES = 40 * 1024

function formatBytes(bytes) {
  return `${bytes.toLocaleString('en-US')} B`
}

function moduleEntrySource(html) {
  const sources = []
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if (!/\btype\s*=\s*(["'])module\1/i.test(tag)) continue
    const src = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2]
    if (src) sources.push(src)
  }

  if (sources.length === 0) {
    throw new Error('renderer index.html has no <script type="module" src="…"> entry')
  }
  if (sources.length > 1) {
    throw new Error(
      `renderer index.html has ${sources.length} module entries; cannot choose an initial entry safely`,
    )
  }
  return sources[0]
}

function entryPath(rendererDir, source) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/|\\|#)/i.test(source) || /[?#]/.test(source)) {
    throw new Error(`renderer module entry must be a plain relative asset path, got ${source}`)
  }

  const entry = resolve(rendererDir, source)
  const pathFromRenderer = relative(rendererDir, entry)
  if (pathFromRenderer.startsWith('..') || pathFromRenderer === '') {
    throw new Error(`renderer module entry escapes its build directory: ${source}`)
  }
  return entry
}

function emittedFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) emittedFiles(path, files)
    else if (entry.isFile()) files.push(path)
  }
  return files
}

function assetProblems(rendererDir) {
  const files = emittedFiles(rendererDir)
  const logos = files.filter((path) => /^logo-[\w-]+\.png$/i.test(basename(path)))
  const symbolsFonts = files.filter((path) =>
    basename(path).startsWith('SymbolsNerdFontMono-Regular-'),
  )
  const problems = []

  if (logos.length !== 1) {
    problems.push(`expected exactly one emitted logo-*.png, found ${logos.length}`)
  } else {
    const logoBytes = statSync(logos[0]).size
    if (logoBytes > LOGO_BUDGET_BYTES) {
      problems.push(
        `emitted logo ${relative(rendererDir, logos[0])} is ${formatBytes(logoBytes)}; budget is ${formatBytes(LOGO_BUDGET_BYTES)}`,
      )
    }
  }

  if (symbolsFonts.length !== 1 || !symbolsFonts[0]?.endsWith('.woff2')) {
    const found = symbolsFonts.map((path) => relative(rendererDir, path)).join(', ') || 'none'
    problems.push(
      `expected exactly one SymbolsNerdFontMono-Regular WOFF2 and no duplicate/TTF, found ${found}`,
    )
  }

  return problems
}

/**
 * Validate a built renderer directory. Exported so tests can use small fixture
 * builds instead of depending on whichever artifacts happen to exist locally.
 */
export function checkRendererArtifacts({
  rendererDir = join(root, 'apps/desktop/out/renderer'),
} = {}) {
  if (!existsSync(rendererDir)) {
    throw new Error(`renderer build is missing: ${rendererDir}. Run pnpm build:web first.`)
  }

  const indexPath = join(rendererDir, 'index.html')
  if (!existsSync(indexPath)) {
    throw new Error(`renderer build is missing index.html: ${indexPath}. Run pnpm build:web first.`)
  }

  const source = moduleEntrySource(readFileSync(indexPath, 'utf8'))
  const entry = entryPath(rendererDir, source)
  if (!existsSync(entry)) {
    throw new Error(`renderer module entry from index.html is missing: ${source}`)
  }

  const entryBytes = readFileSync(entry)
  const rawBytes = entryBytes.byteLength
  const gzipBytes = gzipSync(entryBytes).byteLength
  const problems = assetProblems(rendererDir)
  if (gzipBytes > INITIAL_ENTRY_GZIP_BUDGET_BYTES) {
    problems.unshift(
      `initial module ${relative(rendererDir, entry)} is ${formatBytes(gzipBytes)} gzip; budget is ${formatBytes(INITIAL_ENTRY_GZIP_BUDGET_BYTES)}`,
    )
  }

  if (problems.length > 0) {
    throw new Error(
      `renderer performance budget failed:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`,
    )
  }

  return {
    entry: relative(rendererDir, entry),
    rawBytes,
    gzipBytes,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = checkRendererArtifacts()
    console.log(
      `[performance:check] ${result.entry}: raw ${formatBytes(result.rawBytes)}, gzip ${formatBytes(result.gzipBytes)} (budget ${formatBytes(INITIAL_ENTRY_GZIP_BUDGET_BYTES)})`,
    )
  } catch (error) {
    console.error(`[performance:check] ${error.message}`)
    process.exitCode = 1
  }
}
