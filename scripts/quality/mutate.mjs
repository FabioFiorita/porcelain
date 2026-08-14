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
 *   pnpm mutation                      # domains touched since the merge base with main
 *   pnpm mutation --domain git         # one named domain, whatever the diff says
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

/** Domains with a changed, non-test production file under one of their roots. */
function touchedDomains() {
  const touched = new Set()
  for (const file of changedFiles()) {
    if (/\.test\.tsx?$/.test(file)) continue
    if (!/\.tsx?$/.test(file)) continue
    const domainRoot = TARGET_DOMAIN_ROOTS.find((candidate) => file.startsWith(`${candidate}/`))
    if (domainRoot === undefined) continue
    const domain = file.slice(domainRoot.length + 1).split('/')[0]
    if (DOMAIN_KEYS.includes(domain)) touched.add(domain)
  }
  return [...touched]
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

const domains = namedDomain === null ? touchedDomains() : [namedDomain]

if (namedDomain !== null && !DOMAIN_KEYS.includes(namedDomain)) {
  process.stderr.write(`Unknown domain "${namedDomain}". Known: ${DOMAIN_KEYS.join(', ')}\n`)
  process.exit(1)
}

if (domains.length === 0) {
  process.stdout.write(
    'No domain production file changed — nothing to mutate.\n' +
      'Pass --domain <name> to aim it anyway, or --all for the committed scope.\n',
  )
  process.exit(0)
}

process.stdout.write(`Mutating ${domains.length} touched domain(s): ${domains.join(', ')}\n`)

// A temp config so the committed scope and threshold stay the reference point.
const base = JSON.parse(readFileSync(CONFIG, 'utf8'))
const scoped = { ...base, mutate: globsFor(domains) }
// The committed `break` is the measured score of the committed `mutate` glob — the daemon slice
// of git. A scoped run covers a different set of files (a domain spans five roots), so that
// number is not its floor. Only `--all` is held to it.
scoped.thresholds = { ...base.thresholds, break: null }
const scopedPath = path.join(mkdtempSync(path.join(tmpdir(), 'porcelain-stryker-')), 'config.json')
writeFileSync(scopedPath, JSON.stringify(scoped, null, 2))
run(scopedPath)
