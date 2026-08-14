#!/usr/bin/env node
/**
 * Run mutation testing over the domain you touched.
 *
 * Whole-repo mutation is not a gate. Measured on this repo: one domain (~670 production lines,
 * 346 mutants) takes about 33 seconds; daemon features + client-runtime + shared together ran
 * past 35 minutes without finishing. Mutation earns its keep when it is aimed.
 *
 * So this derives the mutate glob from the working tree. Change something under
 * `apps/daemon/src/features/git`, and it mutates exactly that. Nothing changed there, and it
 * says so instead of quietly mutating the whole repo.
 *
 *   pnpm mutation                      # just the production files you changed
 *   pnpm mutation --domain git         # a whole domain, across all five of its roots
 *   pnpm mutation --all                # the committed stryker.config.json scope
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMAIN_KEYS, TARGET_DOMAIN_ROOTS } from '../architecture/domains.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONFIG = path.join(root, 'stryker.config.json')

const argv = process.argv.slice(2)
const domainFlag = argv.indexOf('--domain')
const namedDomain = domainFlag === -1 ? null : argv[domainFlag + 1]
const runAll = argv.includes('--all')

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function changedFiles() {
  let base = 'HEAD~1'
  try {
    base = git(['merge-base', 'HEAD', 'main'])
  } catch {
    // A repo with no `main` still has a previous commit to diff against.
  }
  const groups = [
    git(['diff', '--name-only', base, '--']),
    git(['diff', '--name-only', '--cached']),
    git(['diff', '--name-only']),
    git(['ls-files', '--others', '--exclude-standard']),
  ]
  return [...new Set(groups.join('\n').split('\n').filter(Boolean))]
}

/**
 * Changed production files worth mutating.
 *
 * Files, not the whole domain they live in: a domain spans five roots and costs minutes, while
 * the question an agent is actually asking is "do the tests notice what *I* just wrote". Reach
 * for `--domain` when the question is about the domain instead.
 */
function touchedFiles() {
  return changedFiles().filter((file) => {
    if (/\.test\.tsx?$/.test(file)) return false
    if (!/\.tsx?$/.test(file)) return false
    if (file.endsWith('/index.ts') || file.includes('/testing/')) return false
    return TARGET_DOMAIN_ROOTS.some((candidate) => file.startsWith(`${candidate}/`))
  })
}

/** Every root a domain spans — a domain is not one directory. */
function globsFor(domains) {
  const globs = []
  for (const domain of domains) {
    for (const domainRoot of TARGET_DOMAIN_ROOTS) {
      globs.push(`${domainRoot}/${domain}/**/*.ts`)
    }
  }
  globs.push('!**/*.test.ts', '!**/index.ts', '!**/testing/**')
  return globs
}

function run(configPath) {
  const result = spawnSync('pnpm', ['exec', 'stryker', 'run', configPath], {
    cwd: root,
    stdio: 'inherit',
  })
  process.exit(result.status ?? 1)
}

if (runAll) {
  process.stdout.write('Mutating the committed config scope.\n')
  run(CONFIG)
}

if (namedDomain !== null && !DOMAIN_KEYS.includes(namedDomain)) {
  process.stderr.write(`Unknown domain "${namedDomain}". Known: ${DOMAIN_KEYS.join(', ')}\n`)
  process.exit(1)
}

const targets = namedDomain === null ? touchedFiles() : globsFor([namedDomain])

if (targets.length === 0) {
  process.stdout.write(
    'No domain production file changed — nothing to mutate.\n' +
      'Pass --domain <name> to aim it at a whole domain, or --all for the committed scope.\n',
  )
  process.exit(0)
}

if (namedDomain === null) {
  process.stdout.write(`Mutating ${targets.length} changed file(s):\n`)
  for (const file of targets) process.stdout.write(`  ${file}\n`)
} else {
  process.stdout.write(`Mutating the ${namedDomain} domain across all of its roots.\n`)
}

// A temp config so the committed scope and threshold stay the reference point.
const base = JSON.parse(readFileSync(CONFIG, 'utf8'))
const scoped = { ...base, mutate: targets }
// The committed `break` is the measured score of the committed `mutate` glob — the daemon slice
// of git. A scoped run covers a different set of files (a domain spans five roots), so that
// number is not its floor. Only `--all` is held to it.
scoped.thresholds = { ...base.thresholds, break: null }
const scopedPath = path.join(mkdtempSync(path.join(tmpdir(), 'porcelain-stryker-')), 'config.json')
writeFileSync(scopedPath, JSON.stringify(scoped, null, 2))
run(scopedPath)
