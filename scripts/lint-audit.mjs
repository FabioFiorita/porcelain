#!/usr/bin/env node
/**
 * Enforce the three `audit`-skill invariants that are mechanically checkable, so
 * the skill can carry the *why* instead of a "verify by reading the diff" note:
 *
 *   1. External URLs go through `isSafeExternalUrl` — any file that reaches
 *      `shell.openExternal` / `setWindowOpenHandler` must also name the guard.
 *      Proxy, not proof: it can't tell a gated call from an ungated one in a
 *      file that has both. It catches the real regression shape, which is a
 *      *new* file opening an external URL without ever importing the guard.
 *   2. Every git invocation sets `GIT_OPTIONAL_LOCKS=0` — `runGit` in
 *      `src/backend/git.ts` is the one chokepoint, so this asserts the flag is
 *      still there AND that no other shipped `src/backend` / `src/main` module
 *      spawns `git` around it. (The 3s status/flow polls otherwise rewrite
 *      `.git/index` under a lock and fail the user's own `pull`/`commit`.)
 *      Out of scope on purpose: tests spawn git to *build* fixtures in a temp
 *      repo (no poll, no user repo), and `src/cli` is the dependency-free CLI
 *      island with its own one-shot `rev-parse` — neither polls a live repo.
 *   3. The tracked pre-commit hook clears Git's exported repository-local env
 *      before verification. Otherwise fixture git commands ignore cwd and
 *      commit into the worktree whose hook is running.
 *
 * Comment lines are skipped for the same reason as `lint-escapes.mjs`: both
 * invariants are *documented* in prose next to the code they guard.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const scanRoot = join(root, 'src')

const EXTERNAL_URL_CALL = /\b(?:shell\.openExternal|setWindowOpenHandler)\s*\(/
const EXTERNAL_URL_GUARD = 'isSafeExternalUrl'
/** The guard's own module and its test define/exercise it — nothing to gate. */
const GUARD_FILES = new Set([
  join(scanRoot, 'backend', 'external-url.ts'),
  join(scanRoot, 'backend', 'external-url.test.ts'),
])

const GIT_GATEWAY = join(scanRoot, 'backend', 'git.ts')
const GIT_LOCKS_FLAG = 'GIT_OPTIONAL_LOCKS'
const GIT_LOCKS_SET = /GIT_OPTIONAL_LOCKS\s*:\s*['"]0['"]/
const GIT_SPAWN =
  /\b(?:exec|execSync|execFile|execFileSync|execFileAsync|spawn|spawnSync)\s*\(\s*(['"`])git\1/
const GIT_SPAWN_ROOTS = [join(scanRoot, 'backend'), join(scanRoot, 'main')]
const PRE_COMMIT_HOOK = join(root, 'githooks', 'pre-commit')
const GIT_LOCAL_ENV_LIST = /git rev-parse --local-env-vars/
const GIT_LOCAL_ENV_UNSET =
  /for git_local_var in \$git_local_env; do\s+unset "\$git_local_var"\s+done/

const isTest = (file) => /\.test\.tsx?$/.test(file)

const SKIP_DIRS = new Set(['ui', 'node_modules', 'dist', 'out'])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) walk(path, out)
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(path)
  }
  return out
}

function codeLines(file) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line, i) => ({ line, number: i + 1 }))
    .filter(({ line }) => !/^\s*(\/\/|\/\*|\*)/.test(line))
}

function hasOrderedGitHookEnvScrub(source) {
  const code = source
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')
  const branchProfileEnd = code.indexOf('\nesac\n')
  const envList = GIT_LOCAL_ENV_LIST.exec(code)
  const envUnset = GIT_LOCAL_ENV_UNSET.exec(code)
  const verifyStart = code.indexOf('pnpm verify')

  return (
    branchProfileEnd !== -1 &&
    envList !== null &&
    envUnset !== null &&
    verifyStart !== -1 &&
    envList.index > branchProfileEnd &&
    envUnset.index > envList.index &&
    verifyStart > envUnset.index
  )
}

/**
 * Both checks match the *joined* code (Biome wraps long calls, so
 * `execFileAsync(\n  'git',` never fits on one line). Report against the line the
 * match starts on; a match that starts inside a stripped comment can't happen,
 * but fall back to line 1 rather than throwing if the mapping ever comes up short.
 */
function locate(lines, code, pattern) {
  const match = pattern.exec(code)
  if (!match) return { number: 1, snippet: '(match not localizable)' }
  const before = code.slice(0, match.index).split('\n').length - 1
  const hit = lines[before]
  return hit
    ? { number: hit.number, snippet: hit.line.trim().slice(0, 120) }
    : { number: 1, snippet: match[0].trim().slice(0, 120) }
}

const failures = []

const commentedScrubDecoy = `case "$branch" in
esac
# git_local_env="$(git rev-parse --local-env-vars)"
# for git_local_var in $git_local_env; do
#   unset "$git_local_var"
# done
pnpm verify`
const lateScrubDecoy = `case "$branch" in
esac
pnpm verify
git_local_env="$(git rev-parse --local-env-vars)"
for git_local_var in $git_local_env; do
  unset "$git_local_var"
done`
if (hasOrderedGitHookEnvScrub(commentedScrubDecoy) || hasOrderedGitHookEnvScrub(lateScrubDecoy)) {
  failures.push({
    file: relative(root, fileURLToPath(import.meta.url)),
    line: 0,
    label: 'pre-commit env-scrub checker accepted a commented or out-of-order decoy',
    snippet: '(lint regression decoy accepted)',
  })
}

for (const file of walk(scanRoot)) {
  if (GUARD_FILES.has(file)) continue
  const rel = relative(root, file)
  const lines = codeLines(file)
  const code = lines.map(({ line }) => line).join('\n')

  if (EXTERNAL_URL_CALL.test(code) && !code.includes(EXTERNAL_URL_GUARD)) {
    const hit = locate(lines, code, EXTERNAL_URL_CALL)
    failures.push({
      file: rel,
      line: hit.number,
      label: `external URL opened without ${EXTERNAL_URL_GUARD} (src/backend/external-url.ts) — gate it or route through the guard`,
      snippet: hit.snippet,
    })
  }

  if (
    file !== GIT_GATEWAY &&
    GIT_SPAWN_ROOTS.some((dir) => file.startsWith(dir)) &&
    !isTest(file) &&
    GIT_SPAWN.test(code)
  ) {
    const hit = locate(lines, code, GIT_SPAWN)
    failures.push({
      file: rel,
      line: hit.number,
      label: `git spawned outside runGit (src/backend/git.ts) — it would miss ${GIT_LOCKS_FLAG}=0`,
      snippet: hit.snippet,
    })
  }
}

if (!codeLines(GIT_GATEWAY).some(({ line }) => GIT_LOCKS_SET.test(line))) {
  failures.push({
    file: relative(root, GIT_GATEWAY),
    line: 0,
    label: `runGit no longer sets ${GIT_LOCKS_FLAG}=0 — background polls will fail the user's own pull/commit`,
    snippet: '(flag absent from the file)',
  })
}

const preCommitHook = readFileSync(PRE_COMMIT_HOOK, 'utf8')
if (!hasOrderedGitHookEnvScrub(preCommitHook)) {
  failures.push({
    file: relative(root, PRE_COMMIT_HOOK),
    line: 0,
    label:
      'pre-commit no longer clears Git repository-local env before verification — fixture git commands could mutate the real worktree',
    snippet: '(git local env scrub absent from the hook)',
  })
}

if (failures.length > 0) {
  console.error('Audit-invariant drift (.agents/skills/audit/SKILL.md):\n')
  for (const f of failures) {
    console.error(`  ${f.file}:${f.line}  ${f.label}`)
    console.error(`    ${f.snippet}`)
  }
  console.error(`\n${failures.length} hit(s). Read the invariant before changing the check.`)
  process.exit(1)
}

console.log('lint-audit: ok')
