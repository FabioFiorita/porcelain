#!/usr/bin/env node
/**
 * Two documentation invariants, both of which regrow quietly.
 *
 * One route per document. AGENTS.md is loaded on every turn, and it used to route the same
 * five documents twice — once as "read this when", once as "put that fact here". Neither
 * copy was wrong, which is why nobody noticed; re-scoping a document meant remembering both.
 * The rule: a `docs/*.md` path appears in AGENTS.md exactly once, in the routing block.
 *
 * Shipped skills cannot read this checkout. `plugins/` is published and installed elsewhere,
 * where `docs/` does not exist. `porcelain-remote/SKILL.md` states this about itself, and two
 * of its own references pointed at `docs/remote-access.md` anyway — the invariant lived only
 * inside the artifact it constrained. The rule: no relative `docs/*.md` reference under
 * `plugins/`. An absolute URL is fine; an installed copy can follow it.
 *
 * Usage:
 *   node scripts/lint-docs.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

/** The always-loaded file that owns document routing. */
export const ROUTER = 'AGENTS.md'
/** Published, installed elsewhere, cannot see this checkout. */
export const SHIPPED_ROOT = 'plugins'

const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'build', 'coverage', '.stryker-tmp'])

/**
 * A checkout-relative `docs/*.md` path. A leading `/` disqualifies the match, so
 * `https://…/blob/main/docs/remote-access.md` reads as the URL it is.
 */
const RELATIVE_DOC = /(^|[^A-Za-z0-9_./-])(docs\/[a-z0-9-]+\.md)/g

/**
 * Shipped files that name a checkout document for a reason other than sending a reader
 * there. The paired test fails if an entry names a file that no longer exists, so the
 * list cannot rot.
 */
export const ALLOWED_SHIPPED = Object.freeze({})

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    let stats
    try {
      stats = statSync(full)
    } catch {
      continue
    }
    if (stats.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.md')) out.push(full)
  }
  return out
}

/** A markdown link is one reference, not two — drop the label and keep the target. */
const LINK_LABEL = /\[([^\]]*)\]\(/g

/** Every checkout-relative `docs/*.md` path in `source`, in order, duplicates included. */
export function relativeDocReferences(source) {
  return [...source.replace(LINK_LABEL, '(').matchAll(RELATIVE_DOC)].map((match) => match[2])
}

/**
 * Pure so the paired test can drive both verdicts without a fixture tree.
 * `documents` is the list of `docs/*.md` paths that exist.
 */
export function findRoutingProblems(routerSource, documents) {
  const referenced = relativeDocReferences(routerSource)
  const problems = []
  for (const document of documents) {
    const count = referenced.filter((path) => path === document).length
    if (count === 0) problems.push(`${document} is routed from nowhere`)
    else if (count > 1) problems.push(`${document} is routed ${count} times — one owner, one route`)
  }
  return problems
}

/** `relativePath` uses forward slashes. */
export function reachesIntoCheckout(relativePath, source) {
  if (!relativePath.startsWith(`${SHIPPED_ROOT}/`)) return false
  if (relativePath in ALLOWED_SHIPPED) return false
  return relativeDocReferences(source).length > 0
}

export function findDocProblems(repositoryRoot = root) {
  const documents = readdirSync(join(repositoryRoot, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `docs/${name}`)
    .sort()

  const problems = findRoutingProblems(
    readFileSync(join(repositoryRoot, ROUTER), 'utf8'),
    documents,
  )

  for (const file of walk(join(repositoryRoot, SHIPPED_ROOT))) {
    const relativePath = relative(repositoryRoot, file).split('\\').join('/')
    const source = readFileSync(file, 'utf8')
    if (reachesIntoCheckout(relativePath, source)) {
      const named = [...new Set(relativeDocReferences(source))].join(', ')
      problems.push(`${relativePath} points at ${named}, which an installed copy does not have`)
    }
  }
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = findDocProblems()
  if (problems.length > 0) {
    console.error('Documentation routing:')
    for (const problem of problems) console.error(`  ${problem}`)
    console.error(
      `Route each document once from ${ROUTER}, and link a public URL from ${SHIPPED_ROOT}/.`,
    )
    process.exit(1)
  }
  console.log('lint-docs: ok — one route per document, shipped skills stay self-contained')
}
