#!/usr/bin/env node
/**
 * Enforce the security and process-boundary invariants that are mechanically checkable.
 *
 *   1. External URLs go through `isSafeExternalUrl` — any file reaching
 *      `shell.openExternal` / `setWindowOpenHandler` must also import the guard.
 *   2. Every git invocation sets `GIT_OPTIONAL_LOCKS=0` through a registered Git gateway:
 *      `runGit` in `apps/daemon/src/git/git.ts` or a bounded feature adapter. No other
 *      shipped daemon / shell `src/main` module may spawn git around them. Test fixtures and
 *      the agent CLI's one-shot `rev-parse` are out of scope.
 *   3. `.husky/pre-commit` clears Git's exported repository-local env before
 *      the commit gate (`pnpm lint`).
 *   4. Every git spawn in a registered gateway builds its env with `gitEnv`, the runtime
 *      half of 3.
 *
 * Comment lines are skipped, matching `lint-escapes.mjs`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const desktopSrc = join(root, 'apps', 'desktop', 'src')
const daemonSrc = join(root, 'apps', 'daemon', 'src')

const EXTERNAL_URL_CALL = /\b(?:shell\.openExternal|setWindowOpenHandler)\s*\(/
const EXTERNAL_URL_GUARD = 'isSafeExternalUrl'
/** The guard's own module and its test define/exercise it — nothing to gate. */
const GUARD_FILES = new Set([
  join(daemonSrc, 'fs', 'external-url.ts'),
  join(daemonSrc, 'fs', 'external-url.test.ts'),
])

const GIT_GATEWAY = join(daemonSrc, 'git', 'git.ts')
const GIT_FEATURE_ADAPTER = join(daemonSrc, 'features', 'git', 'git-subprocess.ts')
const GIT_GATEWAYS = [GIT_GATEWAY, GIT_FEATURE_ADAPTER]
const GIT_LOCKS_FLAG = 'GIT_OPTIONAL_LOCKS'
const GIT_LOCKS_SET = /GIT_OPTIONAL_LOCKS\s*:\s*['"]0['"]/
const GIT_SPAWN =
  /\b(?:exec|execSync|execFile|execFileSync|execFileAsync|spawn|spawnSync)\s*\(\s*(['"`])git\1/
const GIT_SPAWN_ALL = new RegExp(GIT_SPAWN.source, 'g')
const GIT_ENV_SCRUB = /env:\s*gitEnv\(/g
const GIT_SPAWN_ROOTS = [daemonSrc, join(desktopSrc, 'main')]
const PRE_COMMIT_HOOK = join(root, '.husky', 'pre-commit')
const GIT_LOCAL_ENV_LIST = /git rev-parse --local-env-vars/
const GIT_LOCAL_ENV_UNSET =
  /for git_local_var in \$git_local_env; do\s+unset "\$git_local_var"\s+done/

const isTest = (file) => /\.test\.tsx?$/.test(file)

const SKIP_DIRS = new Set(['.stryker-tmp', 'ui', 'node_modules', 'dist', 'out'])

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
  const gateStart = code.indexOf('pnpm lint')

  return (
    branchProfileEnd !== -1 &&
    envList !== null &&
    envUnset !== null &&
    gateStart !== -1 &&
    envList.index > branchProfileEnd &&
    envUnset.index > envList.index &&
    gateStart > envUnset.index
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
pnpm lint`
const lateScrubDecoy = `case "$branch" in
esac
pnpm lint
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

for (const file of [...walk(desktopSrc), ...walk(daemonSrc)]) {
  if (GUARD_FILES.has(file)) continue
  const rel = relative(root, file)
  const lines = codeLines(file)
  const code = lines.map(({ line }) => line).join('\n')

  if (EXTERNAL_URL_CALL.test(code) && !code.includes(EXTERNAL_URL_GUARD)) {
    const hit = locate(lines, code, EXTERNAL_URL_CALL)
    failures.push({
      file: rel,
      line: hit.number,
      label: `external URL opened without ${EXTERNAL_URL_GUARD} (apps/daemon/src/fs/external-url.ts) — gate it or route through the guard`,
      snippet: hit.snippet,
    })
  }

  if (
    !GIT_GATEWAYS.includes(file) &&
    GIT_SPAWN_ROOTS.some((dir) => file.startsWith(dir)) &&
    !isTest(file) &&
    GIT_SPAWN.test(code)
  ) {
    const hit = locate(lines, code, GIT_SPAWN)
    failures.push({
      file: rel,
      line: hit.number,
      label: `git spawned outside runGit (apps/daemon/src/git/git.ts) — it would miss ${GIT_LOCKS_FLAG}=0`,
      snippet: hit.snippet,
    })
  }
}

if (
  !GIT_GATEWAYS.every((gateway) => codeLines(gateway).some(({ line }) => GIT_LOCKS_SET.test(line)))
) {
  failures.push({
    file: relative(root, GIT_GATEWAY),
    line: 0,
    label: `runGit no longer sets ${GIT_LOCKS_FLAG}=0 — background polls will fail the user's own pull/commit`,
    snippet: '(flag absent from the file)',
  })
}

const gatewayCode = GIT_GATEWAYS.flatMap((gateway) => codeLines(gateway))
  .map(({ line }) => line)
  .join('\n')
const gatewaySpawns = gatewayCode.match(GIT_SPAWN_ALL)?.length ?? 0
const scrubbedSpawns = gatewayCode.match(GIT_ENV_SCRUB)?.length ?? 0
if (scrubbedSpawns < gatewaySpawns) {
  failures.push({
    file: relative(root, GIT_GATEWAY),
    line: 0,
    label: `${gatewaySpawns - scrubbedSpawns} git spawn(s) in the gateway don't build their env with gitEnv (apps/daemon/src/git/git-env.ts) — an inherited GIT_DIR would override cwd and redirect them to another repository`,
    snippet: `(${scrubbedSpawns} gitEnv env for ${gatewaySpawns} spawns)`,
  })
}

const preCommitHook = readFileSync(PRE_COMMIT_HOOK, 'utf8')
if (!hasOrderedGitHookEnvScrub(preCommitHook)) {
  failures.push({
    file: relative(root, PRE_COMMIT_HOOK),
    line: 0,
    label:
      'pre-commit no longer clears Git repository-local env before the lint gate — fixture git commands could mutate the real worktree',
    snippet: '(git local env scrub absent from the hook)',
  })
}

if (failures.length > 0) {
  console.error('Security-boundary drift:\n')
  for (const f of failures) {
    console.error(`  ${f.file}:${f.line}  ${f.label}`)
    console.error(`    ${f.snippet}`)
  }
  console.error(`\n${failures.length} hit(s). Read the invariant before changing the check.`)
  process.exit(1)
}

console.log('lint-security-boundaries: ok')
