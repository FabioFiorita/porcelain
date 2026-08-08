import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * A ceiling on how long a file under `apps/mobile/src` may get.
 *
 * Phase 3 split the shell and settings god-files, and a cleanup nothing prevents from regrowing
 * is not a cleanup. Length is a proxy, not the goal: a file over the ceiling is one holding
 * several responsibilities, which is also why those files were the ones with no tests — there
 * was no seam a test could reach. Split it into a `use-<feature>.ts`, a pure module, and the
 * markup, the way the workspace switchers and the environments panel were split.
 */
const CEILING = 450
const mobileSourceRoot = path.resolve('apps/mobile/src')

/**
 * Files that were already over the ceiling when it landed, at the length they were.
 *
 * **This list may only shrink.** Phase 3b splits these four; a new entry is never the answer to
 * a failure. An allowlisted file may not grow past its recorded length either — the recorded
 * number is a cap, not a licence.
 */
const ALLOWLIST = new Map([
  ['features/terminal/terminal-view.tsx', 533],
  ['features/files/file-viewer.tsx', 494],
  ['features/changes/commit-card.tsx', 464],
  ['lib/daemon/environments-store.ts', 453],
])

const violations = []
const seen = new Set()

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(entryPath)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      inspect(entryPath)
    }
  }
}

function inspect(filePath) {
  const relativeToRoot = path.relative(mobileSourceRoot, filePath).split(path.sep).join('/')
  // `wc -l` semantics: a trailing newline ends the last line, it does not open a new one — so
  // the numbers in ALLOWLIST are the ones a human gets from `wc -l`.
  const source = readFileSync(filePath, 'utf8')
  const lines = source.split('\n').length - (source.endsWith('\n') ? 1 : 0)
  const allowed = ALLOWLIST.get(relativeToRoot)

  if (allowed === undefined) {
    if (lines > CEILING) {
      violations.push(`${relativeToRoot} is ${lines} lines — the ceiling is ${CEILING}`)
    }
    return
  }

  seen.add(relativeToRoot)
  if (lines > allowed) {
    violations.push(
      `${relativeToRoot} is ${lines} lines and allowlisted at ${allowed} — allowlisted files may shrink, never grow`,
    )
  } else if (lines <= CEILING) {
    violations.push(
      `${relativeToRoot} is ${lines} lines, under the ${CEILING}-line ceiling — delete its ALLOWLIST entry in scripts/lint-mobile-file-size.mjs`,
    )
  }
}

if (!statSync(mobileSourceRoot).isDirectory()) {
  console.error(`mobile source directory not found: ${mobileSourceRoot}`)
  process.exit(1)
}

walk(mobileSourceRoot)

for (const entry of ALLOWLIST.keys()) {
  if (!seen.has(entry)) {
    violations.push(
      `${entry} is allowlisted but no longer exists — delete its ALLOWLIST entry in scripts/lint-mobile-file-size.mjs`,
    )
  }
}

if (violations.length > 0) {
  console.error(
    `mobile file-size guard: no file under apps/mobile/src may exceed ${CEILING} lines.`,
  )
  for (const violation of violations) console.error(`  ${violation}`)
  console.error(
    'Split the file — a use-<feature>.ts for the daemon seam, a pure module for the derivations, markup in the rest.',
  )
  console.error('Do not add an ALLOWLIST entry: that list is a shrinking record of Phase 3b debt.')
  process.exit(1)
}

console.log(`mobile file-size guard: ok — ${ALLOWLIST.size} file(s) still over ${CEILING}`)
