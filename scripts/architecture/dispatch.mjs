#!/usr/bin/env node
/**
 * Architecture execution-group dispatcher.
 *
 * Codex (or a human) defines dependency-safe groups, prepares one managed
 * worktree per group from an integration base, and runs a fresh Grok or Claude
 * Personal process for each ordered recipe. Integration/push stay explicit —
 * this tool never merges, cherry-picks, or pushes.
 *
 * Commands: validate | prepare | run | status | review | help
 */
import { spawn, spawnSync } from 'node:child_process'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_BASE, ENV as WORKTREE_ENV } from '../worktree.mjs'
import { assertFreshContextArgs, buildExecutorInvocation } from './executors.mjs'
import {
  dependenciesForRecipe,
  isExecutableRecipe,
  loadGroupDirectory,
  loadManifestFile,
  parseCatalogStatuses,
  parseExecutionGroup,
  recipeStatus,
  resolveRecipePath,
  validateGroupAgainstCatalog,
  validateGroupSet,
} from './manifest.mjs'
import { evaluatePostconditions, snapshotStatuses } from './postconditions.mjs'
import { buildRecipePrompt } from './prompt.mjs'
import {
  createInitialState,
  orchestrationDir,
  readState,
  writeJsonAtomic,
  writeState,
} from './state.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const SPECS_ROOT = join(REPO_ROOT, 'plans', 'architecture-refactor', 'specs')
const CATALOG_PATH = join(SPECS_ROOT, 'catalog.md')
const WORKTREE_SCRIPT = join(REPO_ROOT, 'scripts', 'worktree.mjs')
const GROUPS_DIR = join(REPO_ROOT, 'plans', 'architecture-refactor', 'execution-groups')

/** Git repository-local env strip — same list as worktree.mjs / daemon git-env. */
const REPO_LOCAL_ENV = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
]

function scrubbedEnv(extra = {}) {
  const env = { ...process.env, ...WORKTREE_ENV, ...extra }
  for (const key of REPO_LOCAL_ENV) delete env[key]
  return env
}

function fail(message) {
  console.error(`architecture-dispatch ✗ ${message}`)
  process.exit(1)
}

function info(message) {
  console.log(`architecture-dispatch · ${message}`)
}

function ok(message) {
  console.log(`architecture-dispatch ✓ ${message}`)
}

function git(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: scrubbedEnv(),
  })
  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim()
    throw new Error(stderr || `git ${args.join(' ')} failed`)
  }
  return (result.stdout ?? '').trim()
}

function primaryRoot(cwd = REPO_ROOT) {
  const top = realpathSync(git(cwd, ['rev-parse', '--show-toplevel']))
  const common = git(cwd, ['rev-parse', '--git-common-dir'])
  const commonPath = realpathSync(resolve(top, common))
  return realpathSync(dirname(commonPath))
}

function managedWorktreePath(root, slug) {
  return join(dirname(root), `${basenameSafe(root)}-worktrees`, slug)
}

function basenameSafe(path) {
  const parts = path.split(sep).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

function assertManagedSiblingPath(root, worktreePath) {
  const parent = join(dirname(root), `${basenameSafe(root)}-worktrees`)
  const resolved = resolve(worktreePath)
  const parentResolved = resolve(parent)
  if (resolved === parentResolved || !resolved.startsWith(`${parentResolved}${sep}`)) {
    fail(`worktree path escapes managed sibling directory: ${resolved}`)
  }
  return resolved
}

function loadCatalogText() {
  return readFileSync(CATALOG_PATH, 'utf8')
}

/**
 * Resolve a manifest path: absolute/relative file, group id under execution-groups/,
 * or a directory of *.group.json files.
 */
function resolveManifestTarget(arg) {
  if (!arg) fail('manifest path or group id required')
  const asPath = resolve(process.cwd(), arg)
  if (existsSync(asPath)) return asPath
  const byId = join(GROUPS_DIR, `${arg}.group.json`)
  if (existsSync(byId)) return byId
  const byName = join(GROUPS_DIR, arg)
  if (existsSync(byName)) return byName
  fail(`manifest not found: ${arg}`)
}

function validateOneOrMany(target) {
  const catalogText = loadCatalogText()
  if (existsSync(target) && !target.endsWith('.json') && !target.endsWith('.group.json')) {
    // directory
    const loaded = loadGroupDirectory(target)
    if (!loaded.ok && loaded.groups.length === 0) {
      return { ok: false, errors: loaded.errors, groups: [] }
    }
    const errors = [
      ...loaded.errors,
      ...validateGroupSet(loaded.groups, { catalogText, specsRoot: SPECS_ROOT }),
    ]
    return { ok: errors.length === 0, errors, groups: loaded.groups }
  }

  const loaded = loadManifestFile(target)
  if (!loaded.ok) return { ok: false, errors: loaded.errors ?? [loaded.error], groups: [] }
  const errors = validateGroupAgainstCatalog(loaded.group, { catalogText, specsRoot: SPECS_ROOT })
  return { ok: errors.length === 0, errors, groups: [loaded.group] }
}

function cmdValidate(args) {
  const target = args[0] ? resolveManifestTarget(args[0]) : GROUPS_DIR
  if (!existsSync(target) && target === GROUPS_DIR) {
    ok('no execution-groups directory yet; template validates in isolation')
    return
  }
  const result = validateOneOrMany(target)
  if (!result.ok) {
    console.error('architecture-dispatch ✗ validation failed:\n')
    for (const error of result.errors) console.error(`  ${error}`)
    process.exit(1)
  }
  ok(`validated ${result.groups.length} group(s)`)
  for (const group of result.groups) {
    console.log(
      `  ${group.id}  executor=${group.executor}  base=${group.base}  recipes=${group.recipes.join(',')}`,
    )
  }
}

/**
 * Create (or adopt an already-matching) managed worktree for the group.
 * Uses scripts/worktree.mjs via argv — no shell.
 */
function cmdPrepare(args, options = {}) {
  const target = resolveManifestTarget(args[0])
  const loaded = loadManifestFile(target)
  if (!loaded.ok) fail(loaded.error)
  const group = loaded.group
  const catalogText = loadCatalogText()
  const errors = validateGroupAgainstCatalog(group, { catalogText, specsRoot: SPECS_ROOT })
  if (errors.length > 0) {
    for (const error of errors) console.error(`  ${error}`)
    fail('manifest failed catalog validation')
  }

  const root = primaryRoot()
  const worktreePath = managedWorktreePath(root, group.slug)
  assertManagedSiblingPath(root, worktreePath)

  const orch = orchestrationDir(REPO_ROOT, group.id)
  mkdirSync(orch, { recursive: true })

  const existing = existsSync(worktreePath)
  if (existing) {
    const configPath = join(worktreePath, '.porcelain-worktree.json')
    if (!existsSync(configPath)) fail(`path exists but is not a managed worktree: ${worktreePath}`)
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    if (config.slug !== group.slug) fail(`worktree slug mismatch at ${worktreePath}`)
    if ((config.base ?? DEFAULT_BASE) !== group.base) {
      fail(`worktree base is ${config.base ?? DEFAULT_BASE}, manifest wants ${group.base}`)
    }
    info(`adopting existing managed worktree ${group.slug}`)
  } else if (!options.dryRun) {
    info(`creating managed worktree ${group.slug} from base ${group.base}`)
    const createArgs = [
      WORKTREE_SCRIPT,
      'create',
      group.slug,
      '--base',
      group.base,
      ...(options.skipInstall ? ['--skip-install'] : []),
      ...(options.force ? ['--force'] : []),
    ]
    const result = spawnSync(process.execPath, createArgs, {
      cwd: root,
      stdio: 'inherit',
      env: scrubbedEnv(),
    })
    if (result.status !== 0) fail(`worktree create failed for ${group.slug}`)
  } else {
    info(`dry-run: would create worktree ${group.slug} from ${group.base} at ${worktreePath}`)
  }

  let startingHead = null
  if (existsSync(worktreePath) && !options.dryRun) {
    startingHead = git(worktreePath, ['rev-parse', 'HEAD'])
  } else if (options.dryRun) {
    startingHead = 'dry-run'
  }

  const state = createInitialState({
    groupId: group.id,
    slug: group.slug,
    base: group.base,
    executor: group.executor,
    recipes: group.recipes,
    status: 'prepared',
    worktreePath: options.dryRun ? worktreePath : resolve(worktreePath),
    branch: `work/${group.slug}`,
    startingHead,
    groupStartingHead: startingHead,
    notes: options.dryRun ? ['dry-run prepare; no worktree created'] : [],
  })
  if (!options.dryRun) writeState(orch, state)
  else {
    // Still write dry-run state for inspectability under scratch.
    writeState(orch, state)
  }

  writeJsonAtomic(join(orch, 'manifest.snapshot.json'), group)
  ok(`prepared group ${group.id}`)
  console.log(`  worktree   ${worktreePath}`)
  console.log(`  base       ${group.base}`)
  console.log(`  executor   ${group.executor}`)
  console.log(`  recipes    ${group.recipes.join(', ')}`)
  console.log(`  state      ${join(orch, 'state.json')}`)
  return state
}

function assertCleanWorktree(path) {
  const status = git(path, ['status', '--porcelain', '--untracked-files=all'])
  // Ignore managed profile file noise if ever untracked (it is gitignored).
  const dirty = status
    .split('\n')
    .filter((line) => line !== '' && !line.endsWith('.porcelain-worktree.json'))
  if (dirty.length > 0) {
    fail(`worktree is dirty:\n${dirty.map((line) => `  ${line}`).join('\n')}`)
  }
}

function readHead(path) {
  return git(path, ['rev-parse', 'HEAD'])
}

/**
 * Launch one executor process. Injected for tests.
 * @returns {Promise<{ exitCode: number, pid: number }>}
 */
export function defaultSpawnExecutor({ command, args, cwd, logPath, env }) {
  assertFreshContextArgs(args)
  return new Promise((resolvePromise, reject) => {
    mkdirSync(dirname(logPath), { recursive: true })
    const out = createWriteStream(logPath, { flags: 'a' })
    const child = spawn(command, args, {
      cwd,
      env: scrubbedEnv(env),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })
    const pid = child.pid ?? 0
    child.stdout.pipe(out)
    child.stderr.pipe(out)
    child.on('error', (error) => {
      out.end()
      reject(error)
    })
    child.on('close', (code) => {
      out.end()
      resolvePromise({ exitCode: code ?? 1, pid })
    })
  })
}

async function runOneRecipe({
  group,
  recipeId,
  worktreePath,
  orch,
  state,
  spawnExecutor = defaultSpawnExecutor,
}) {
  const catalogText = loadCatalogText()
  const recipePath = resolveRecipePath(SPECS_ROOT, recipeId)
  if (!recipePath) throw new Error(`recipe file missing for ${recipeId}`)
  const recipeText = readFileSync(recipePath, 'utf8')
  const catalog = parseCatalogStatuses(catalogText)
  if (!isExecutableRecipe(recipeId, catalog, recipeText)) {
    const status = catalog.get(recipeId)
    const deps = dependenciesForRecipe(recipeText)
    const unlanded = deps.filter((d) => catalog.get(d) !== 'Landed')
    throw new Error(
      `${recipeId} is not executable (status=${status}, unlanded deps=${unlanded.join(',') || 'none'})`,
    )
  }

  assertCleanWorktree(worktreePath)
  const startingHead = readHead(worktreePath)
  const before = snapshotStatuses({
    catalogText,
    specsRoot: SPECS_ROOT,
    recipeIds: group.recipes,
  })

  const promptDir = join(orch, 'prompts')
  const logDir = join(orch, 'logs')
  const packetDir = join(orch, 'packets')
  mkdirSync(promptDir, { recursive: true })
  mkdirSync(logDir, { recursive: true })
  mkdirSync(packetDir, { recursive: true })

  const packetPath = join(packetDir, `${recipeId}.md`)
  const promptPath = join(promptDir, `${recipeId}.md`)
  const logPath = join(logDir, `${recipeId}.log`)
  const prompt = buildRecipePrompt({
    recipeId,
    recipePath: recipePath.startsWith(REPO_ROOT)
      ? recipePath.slice(REPO_ROOT.length + 1)
      : recipePath,
    recipeStatus: recipeStatus(recipeText) ?? catalog.get(recipeId) ?? 'unknown',
    groupId: group.id,
    packetPath: packetPath.startsWith(REPO_ROOT)
      ? packetPath.slice(REPO_ROOT.length + 1)
      : packetPath,
    startingHead,
  })
  writeFileSync(promptPath, prompt, { mode: 0o600 })

  const invocation = buildExecutorInvocation(group.executor, {
    promptFile: promptPath,
    prompt,
    cwd: worktreePath,
  })
  assertFreshContextArgs(invocation.args)

  const runRecord = {
    recipeId,
    pid: null,
    startTime: new Date().toISOString(),
    endTime: null,
    exitCode: null,
    startingHead,
    endingHead: null,
    status: 'running',
    promptPath,
    logPath,
    packetPath,
  }
  state.currentRecipe = recipeId
  state.status = 'running'
  state.pid = null
  state.startTime = state.startTime ?? runRecord.startTime
  state.recipeRuns = [...(state.recipeRuns ?? []), runRecord]
  writeState(orch, state)

  info(`launching fresh ${group.executor} for ${recipeId}`)
  let exitCode = 1
  let pid = 0
  try {
    const result = await spawnExecutor({
      command: invocation.command,
      args: invocation.args,
      cwd: worktreePath,
      logPath,
      env: {},
    })
    exitCode = result.exitCode
    pid = result.pid
  } catch (error) {
    runRecord.endTime = new Date().toISOString()
    runRecord.exitCode = 1
    runRecord.status = 'spawn-failed'
    runRecord.error = error instanceof Error ? error.message : String(error)
    state.pid = null
    state.failed = { recipeId, reasons: [runRecord.error] }
    state.status = 'failed'
    replaceRunRecord(state, runRecord)
    writeState(orch, state)
    throw error
  }

  const endingHead = (() => {
    try {
      return readHead(worktreePath)
    } catch {
      return null
    }
  })()
  const clean = (() => {
    try {
      assertCleanWorktree(worktreePath)
      return true
    } catch {
      return false
    }
  })()
  const afterCatalogText = loadCatalogText()
  const after = snapshotStatuses({
    catalogText: afterCatalogText,
    specsRoot: SPECS_ROOT,
    recipeIds: group.recipes,
  })

  const post = evaluatePostconditions({
    exitCode,
    startingHead,
    endingHead,
    worktreeClean: clean,
    packetPath,
    packetExists: existsSync(packetPath),
    recipeId,
    before,
    after,
    allGroupRecipeIds: group.recipes,
  })

  runRecord.pid = pid
  runRecord.endTime = new Date().toISOString()
  runRecord.exitCode = exitCode
  runRecord.endingHead = endingHead
  runRecord.status = post.ok ? 'landed' : 'failed'
  if (!post.ok) runRecord.reasons = post.reasons

  state.pid = null
  state.currentRecipe = null
  state.endingHead = endingHead
  replaceRunRecord(state, runRecord)

  if (!post.ok) {
    state.status = 'failed'
    state.failed = { recipeId, reasons: post.reasons }
    state.exitCode = exitCode
    state.endTime = runRecord.endTime
    writeState(orch, state)
    return { ok: false, reasons: post.reasons, runRecord }
  }

  state.completed = [...(state.completed ?? []), recipeId]
  writeState(orch, state)
  ok(`${recipeId} landed at ${endingHead}`)
  return { ok: true, runRecord }
}

function replaceRunRecord(state, runRecord) {
  const runs = state.recipeRuns ?? []
  const idx = runs.findIndex(
    (r) => r.recipeId === runRecord.recipeId && r.startTime === runRecord.startTime,
  )
  if (idx >= 0) runs[idx] = runRecord
  else runs.push(runRecord)
  state.recipeRuns = runs
}

async function cmdRun(args, options = {}) {
  const target = resolveManifestTarget(args[0])
  const loaded = loadManifestFile(target)
  if (!loaded.ok) fail(loaded.error)
  const group = loaded.group
  const orch = orchestrationDir(REPO_ROOT, group.id)
  let state = readState(orch)
  if (!state || state.status === undefined) {
    fail(`group ${group.id} is not prepared; run prepare first`)
  }
  if (state.status === 'completed') {
    ok(`group ${group.id} already completed`)
    return
  }
  if (state.status === 'failed' && !options.resumeFailed) {
    fail(`group ${group.id} previously failed; inspect state/logs before re-running`)
  }

  const worktreePath = state.worktreePath
  if (!worktreePath || !existsSync(worktreePath)) {
    fail(`worktree missing; re-run prepare for ${group.id}`)
  }
  assertManagedSiblingPath(primaryRoot(), worktreePath)
  assertCleanWorktree(worktreePath)

  // Skip recipes already completed in state (idempotent re-entry after interrupt
  // only when last run left completed entries and status was interrupted).
  const done = new Set(state.completed ?? [])
  const remaining = group.recipes.filter((id) => !done.has(id))
  if (remaining.length === 0) {
    state.status = 'completed'
    state.endTime = new Date().toISOString()
    writeState(orch, state)
    ok(`group ${group.id} already has all recipes completed`)
    return
  }

  state.status = 'running'
  state.startTime = state.startTime ?? new Date().toISOString()
  writeState(orch, state)

  for (const recipeId of remaining) {
    // Mark interrupted status if process dies mid-recipe — inspectable via state.pid.
    const result = await runOneRecipe({
      group,
      recipeId,
      worktreePath,
      orch,
      state,
      spawnExecutor: options.spawnExecutor ?? defaultSpawnExecutor,
    })
    // Reload state after write
    state = readState(orch)
    if (!result.ok) {
      console.error(`architecture-dispatch ✗ stopped closed on ${recipeId}:`)
      for (const reason of result.reasons) console.error(`  ${reason}`)
      process.exit(1)
    }
  }

  state = readState(orch)
  state.status = 'completed'
  state.endTime = new Date().toISOString()
  state.exitCode = 0
  state.currentRecipe = null
  state.pid = null
  try {
    state.endingHead = readHead(worktreePath)
  } catch {
    /* keep prior */
  }
  writeState(orch, state)
  ok(`group ${group.id} completed — review, then integrate explicitly (no auto-merge/push)`)
  console.log(
    `  commits    ${state.groupStartingHead?.slice(0, 8)}..${state.endingHead?.slice(0, 8)}`,
  )
  console.log(`  packets    ${join(orch, 'packets')}`)
  console.log(
    `  next       human/Codex review + integrate into ${group.base}; then pnpm worktree remove ${group.slug}`,
  )
}

function cmdStatus(args) {
  const target = args[0] ? resolveManifestTarget(args[0]) : null
  if (!target) {
    // list all orchestration dirs
    const root = join(REPO_ROOT, 'scripts', 'agent-scratch', 'orchestration')
    if (!existsSync(root)) {
      info('no orchestration state')
      return
    }
    fail('pass a manifest path or group id')
  }
  const loaded = loadManifestFile(target)
  const groupId = loaded.ok ? loaded.group.id : args[0]
  const orch = orchestrationDir(REPO_ROOT, groupId)
  const state = readState(orch)
  if (!state) {
    info(`no state for ${groupId} (not prepared)`)
    if (loaded.ok) {
      console.log(JSON.stringify(loaded.group, null, 2))
    }
    return
  }
  console.log(JSON.stringify(state, null, 2))
}

function cmdReview(args) {
  const target = resolveManifestTarget(args[0])
  const loaded = loadManifestFile(target)
  if (!loaded.ok) fail(loaded.error)
  const group = loaded.group
  const orch = orchestrationDir(REPO_ROOT, group.id)
  const state = readState(orch)
  const lines = [
    `# Review summary — group ${group.id}`,
    '',
    `- Executor: ${group.executor}`,
    `- Base: ${group.base}`,
    `- Slug: ${group.slug}`,
    `- Recipes (ordered): ${group.recipes.join(', ')}`,
    `- Status: ${state?.status ?? 'not prepared'}`,
    `- Group starting HEAD: ${state?.groupStartingHead ?? 'n/a'}`,
    `- Ending HEAD: ${state?.endingHead ?? 'n/a'}`,
    `- Completed: ${(state?.completed ?? []).join(', ') || '(none)'}`,
    `- Failed: ${state?.failed ? JSON.stringify(state.failed) : '(none)'}`,
    '',
    '## Recipe runs',
    '',
  ]
  for (const run of state?.recipeRuns ?? []) {
    lines.push(
      `- ${run.recipeId}: ${run.status} exit=${run.exitCode} ${run.startingHead?.slice(0, 8)}→${run.endingHead?.slice(0, 8) ?? '?'} pid=${run.pid ?? '-'}`,
    )
    if (run.reasons) {
      for (const reason of run.reasons) lines.push(`  - ${reason}`)
    }
  }
  lines.push('')
  lines.push('## Integration')
  lines.push('')
  lines.push('This dispatcher never merges, cherry-picks, or pushes. After human review of the')
  lines.push(
    `accumulated commits and packets under \`scripts/agent-scratch/orchestration/${group.id}/\`,`,
  )
  lines.push(
    `integrate \`${state?.branch ?? `work/${group.slug}`}\` into \`${group.base}\` explicitly, then`,
  )
  lines.push(`\`pnpm worktree remove ${group.slug}\` (requires tip reachable from ${group.base}).`)
  lines.push('')
  const text = lines.join('\n')
  console.log(text)
  if (state) {
    writeFileSync(join(orch, 'review-summary.md'), text, { mode: 0o600 })
  }
}

function help() {
  console.log(`Architecture execution-group dispatcher

Usage:
  node scripts/architecture/dispatch.mjs validate [manifest|dir]
  node scripts/architecture/dispatch.mjs prepare <manifest> [--skip-install] [--force] [--dry-run]
  node scripts/architecture/dispatch.mjs run <manifest>
  node scripts/architecture/dispatch.mjs status <manifest|group-id>
  node scripts/architecture/dispatch.mjs review <manifest|group-id>

Manifests live under plans/architecture-refactor/execution-groups/*.group.json
(template: template.group.json). Runtime state is gitignored under
scripts/agent-scratch/orchestration/<group-id>/.

Executors:
  grok              ~/.grok/bin/grok (prompt-file, no-subagents, no-memory, high, bypassPermissions, plain)
  claude-personal   ~/.local/bin/claude (-p, opus, effort max, skip-permissions, disable-slash-commands)

Never merges, cherry-picks, or pushes. Integration is an explicit follow-up.
`)
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const [verb, ...rest] = argv
  if (!verb || verb === 'help' || verb === '--help' || verb === '-h') {
    help()
    return
  }
  if (verb === 'validate') {
    cmdValidate(rest)
    return
  }
  if (verb === 'prepare') {
    cmdPrepare(
      rest.filter((a) => !a.startsWith('--')),
      {
        skipInstall: rest.includes('--skip-install'),
        force: rest.includes('--force'),
        dryRun: rest.includes('--dry-run'),
        ...options,
      },
    )
    return
  }
  if (verb === 'run') {
    await cmdRun(
      rest.filter((a) => !a.startsWith('--')),
      options,
    )
    return
  }
  if (verb === 'status') {
    cmdStatus(rest)
    return
  }
  if (verb === 'review') {
    cmdReview(rest)
    return
  }
  fail(`unknown command: ${verb}`)
}

// Test hooks
export {
  assertManagedSiblingPath,
  cmdPrepare,
  cmdValidate,
  evaluatePostconditions,
  parseExecutionGroup,
  scrubbedEnv,
  validateOneOrMany,
}

const isDirect =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirect) {
  main().catch((error) => {
    fail(error instanceof Error ? error.message : String(error))
  })
}
