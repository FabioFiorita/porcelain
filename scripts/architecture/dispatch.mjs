#!/usr/bin/env node
/**
 * Architecture execution-group dispatcher.
 *
 * Codex (or a human) defines dependency-safe groups, prepares one managed
 * worktree per group from an integration base, and runs a fresh Grok or Claude
 * Personal process for each ordered recipe. Integration/push stay explicit —
 * this tool never merges, cherry-picks, or pushes.
 *
 * Ownership:
 * - Controller checkout: orchestration state, logs, prompts, manifest snapshot
 * - Executor group worktree: catalog/specs snapshots, recipe status, required packet
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
import {
  CONFIG_FILE,
  isLinkedWorktreeOf,
  loadManagedWorktreeProfile,
  parseWorktreeConfig,
  ENV as WORKTREE_ENV,
} from '../worktree.mjs'
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
  validateGroupSet,
} from './manifest.mjs'
import { evaluatePostconditions, snapshotStatuses } from './postconditions.mjs'
import { buildRecipePrompt } from './prompt.mjs'
import {
  createInitialState,
  identitiesEqual,
  identityFromManifestOrState,
  orchestrationDir,
  readJsonFile,
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

function loadCatalogText(catalogPath = CATALOG_PATH) {
  return readFileSync(catalogPath, 'utf8')
}

/** Specs + catalog paths owned by the executor worktree (runtime truth). */
export function executorSpecsPaths(worktreePath) {
  const specsRoot = join(worktreePath, 'plans', 'architecture-refactor', 'specs')
  return {
    specsRoot,
    catalogPath: join(specsRoot, 'catalog.md'),
  }
}

/**
 * Absolute packet path inside the executor group worktree's gitignored scratch.
 * Controller orchestration state/logs/prompts stay under the controller checkout.
 */
export function executorPacketPath(worktreePath, groupId, recipeId) {
  return join(orchestrationDir(worktreePath, groupId), 'packets', `${recipeId}.md`)
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

/**
 * Merge a candidate group into the tracked execution-groups set (candidate wins by id).
 * Per-file validate/prepare/run always load the complete tracked set for dependsOn,
 * cycles, and overlap — structural presence alone is not enough for prepare/run.
 */
export function mergeWithTrackedGroups(candidate, groupsDir = GROUPS_DIR) {
  const tracked = loadGroupDirectory(groupsDir)
  const byId = new Map()
  for (const group of tracked.groups) byId.set(group.id, group)
  if (candidate) byId.set(candidate.id, candidate)
  return {
    groups: [...byId.values()],
    loadErrors: tracked.errors,
  }
}

/**
 * Structural set validation for one or many manifests.
 * Single-file paths still validate against the complete tracked group set.
 */
function validateOneOrMany(target, options = {}) {
  const catalogPath = options.catalogPath ?? CATALOG_PATH
  const specsRoot = options.specsRoot ?? SPECS_ROOT
  const groupsDir = options.groupsDir ?? GROUPS_DIR
  const catalogText = loadCatalogText(catalogPath)

  if (existsSync(target) && !target.endsWith('.json') && !target.endsWith('.group.json')) {
    const loaded = loadGroupDirectory(target)
    if (!loaded.ok && loaded.groups.length === 0) {
      return { ok: false, errors: loaded.errors, groups: [] }
    }
    const errors = [
      ...loaded.errors,
      ...validateGroupSet(loaded.groups, { catalogText, specsRoot }),
    ]
    return { ok: errors.length === 0, errors, groups: loaded.groups }
  }

  const loaded = loadManifestFile(target)
  if (!loaded.ok) return { ok: false, errors: loaded.errors ?? [loaded.error], groups: [] }
  const merged = mergeWithTrackedGroups(loaded.group, groupsDir)
  const errors = [
    ...merged.loadErrors,
    ...validateGroupSet(merged.groups, { catalogText, specsRoot }),
  ]
  return { ok: errors.length === 0, errors, groups: [loaded.group], allGroups: merged.groups }
}

/**
 * Prove dependency groups completed and their ending HEADs are ancestors of `base`.
 * Structural dependsOn presence is insufficient — integration stays explicit.
 *
 * @param {{ dependsOn: string[], base: string, id: string }} group
 * @param {{
 *   controllerRoot?: string,
 *   gitCwd?: string,
 *   isAncestor?: (endingHead: string, base: string) => boolean,
 *   readDepState?: (depId: string) => object | null,
 * }} [options]
 * @returns {string[]} error messages (empty when ok)
 */
export function checkDependencyIntegration(group, options = {}) {
  const controllerRoot = options.controllerRoot ?? REPO_ROOT
  const errors = []
  const readDepState =
    options.readDepState ?? ((depId) => readState(orchestrationDir(controllerRoot, depId)))
  const isAncestor =
    options.isAncestor ??
    ((endingHead, base) => {
      const cwd = options.gitCwd ?? controllerRoot
      const result = spawnSync('git', ['merge-base', '--is-ancestor', endingHead, base], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: scrubbedEnv(),
      })
      return result.status === 0
    })

  for (const depId of group.dependsOn ?? []) {
    const depState = readDepState(depId)
    if (!depState) {
      errors.push(
        `dependsOn ${depId}: no orchestration state (prepare+run that group first; integration is explicit)`,
      )
      continue
    }
    if (depState.status !== 'completed') {
      errors.push(`dependsOn ${depId}: status is ${depState.status ?? 'unknown'}, need completed`)
      continue
    }
    const endingHead = depState.endingHead
    if (!endingHead || typeof endingHead !== 'string') {
      errors.push(`dependsOn ${depId}: missing endingHead on completed state`)
      continue
    }
    if (!isAncestor(endingHead, group.base)) {
      errors.push(
        `dependsOn ${depId}: ending head ${endingHead.slice(0, 8)} is not an ancestor of base ${group.base} (integrate explicitly; dispatcher never merges/cherry-picks/pushes)`,
      )
    }
  }
  return errors
}

/**
 * Harden adoption of an existing managed worktree.
 * Uses parseWorktreeConfig (via loadManagedWorktreeProfile), linked-worktree check,
 * exact branch work/<slug>, and normalized base match.
 *
 * @returns {{ ok: true, config: object } | { ok: false, error: string }}
 */
export function adoptManagedWorktree({ root, worktreePath, group }) {
  if (!existsSync(worktreePath)) {
    return { ok: false, error: `worktree path does not exist: ${worktreePath}` }
  }

  const profile = loadManagedWorktreeProfile(worktreePath)
  if (!profile.ok) {
    return { ok: false, error: `managed profile invalid at ${worktreePath}: ${profile.error}` }
  }
  const config = profile.config
  if (config.slug !== group.slug) {
    return {
      ok: false,
      error: `worktree slug is ${config.slug}, manifest wants ${group.slug}`,
    }
  }
  if (config.branch !== `work/${group.slug}`) {
    return {
      ok: false,
      error: `worktree profile branch is ${config.branch}, expected work/${group.slug}`,
    }
  }
  if (config.base !== group.base) {
    return {
      ok: false,
      error: `worktree base is ${config.base}, manifest wants ${group.base}`,
    }
  }

  if (!isLinkedWorktreeOf(root, worktreePath)) {
    return {
      ok: false,
      error: `path is not a linked worktree of this repository: ${worktreePath}`,
    }
  }

  let branch
  try {
    branch = git(worktreePath, ['rev-parse', '--abbrev-ref', 'HEAD'])
  } catch (error) {
    return {
      ok: false,
      error: `cannot read worktree branch: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  if (branch === 'HEAD') {
    return { ok: false, error: `worktree is detached HEAD; expected work/${group.slug}` }
  }
  if (branch !== `work/${group.slug}`) {
    return {
      ok: false,
      error: `worktree current branch is ${branch}, expected work/${group.slug}`,
    }
  }

  // Re-parse raw JSON through parseWorktreeConfig for callers that need the pure path.
  const configPath = join(worktreePath, CONFIG_FILE)
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf8'))
    const reparsed = parseWorktreeConfig(raw)
    if (!reparsed.ok) {
      return { ok: false, error: `profile re-parse failed: ${reparsed.error}` }
    }
  } catch (error) {
    return {
      ok: false,
      error: `profile re-read failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  return { ok: true, config }
}

/**
 * Fail closed if live manifest, stored snapshot, or state identity diverge.
 */
export function assertPreparedIdentity({ group, state, orch }) {
  const snapshot = readJsonFile(join(orch, 'manifest.snapshot.json'))
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('missing manifest.snapshot.json; re-run prepare')
  }
  const live = identityFromManifestOrState(group)
  const snap = identityFromManifestOrState(/** @type {object} */ (snapshot))
  const stored = identityFromManifestOrState(/** @type {object} */ (state))

  if (!identitiesEqual(live, snap)) {
    throw new Error(
      'manifest changed since prepare (id/slug/base/executor/recipes/dependsOn); re-run prepare',
    )
  }
  if (!identitiesEqual(live, stored)) {
    throw new Error('orchestration state identity does not match manifest; re-run prepare')
  }
  return live
}

/**
 * Verify live worktree profile, linkage, and branch match prepared state.
 */
export function assertWorktreeIdentity({ root, worktreePath, group, state }) {
  if (!worktreePath || !existsSync(worktreePath)) {
    throw new Error(`worktree missing; re-run prepare for ${group.id}`)
  }
  if (state.worktreePath && resolve(worktreePath) !== resolve(state.worktreePath)) {
    throw new Error(
      `worktree path drift: state has ${state.worktreePath}, resolved ${worktreePath}`,
    )
  }
  const adopted = adoptManagedWorktree({ root, worktreePath, group })
  if (!adopted.ok) throw new Error(adopted.error)
  if (state.branch && state.branch !== `work/${group.slug}`) {
    throw new Error(`state branch is ${state.branch}, expected work/${group.slug}`)
  }
  return adopted.config
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
      `  ${group.id}  executor=${group.executor}  base=${group.base}  recipes=${group.recipes.join(',')}  dependsOn=${(group.dependsOn ?? []).join(',') || '(none)'}`,
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

  // Structural set + catalog validation (complete tracked set for dependsOn/cycles/overlap).
  const validation = validateOneOrMany(target, {
    groupsDir: options.groupsDir ?? GROUPS_DIR,
  })
  if (!validation.ok) {
    for (const error of validation.errors) console.error(`  ${error}`)
    fail('manifest failed group-set/catalog validation')
  }

  // Integration gate: dependency groups completed + ending heads ⊆ base.
  const depErrors = checkDependencyIntegration(group, {
    controllerRoot: options.controllerRoot ?? REPO_ROOT,
    gitCwd: options.gitCwd,
    isAncestor: options.isAncestor,
    readDepState: options.readDepState,
  })
  if (depErrors.length > 0) {
    for (const error of depErrors) console.error(`  ${error}`)
    fail('dependsOn integration checks failed')
  }

  const root = options.primaryRoot ?? primaryRoot()
  const worktreePath = options.worktreePath ?? managedWorktreePath(root, group.slug)
  if (!options.skipSiblingCheck) assertManagedSiblingPath(root, worktreePath)

  const controllerRoot = options.controllerRoot ?? REPO_ROOT
  const orch = orchestrationDir(controllerRoot, group.id)
  mkdirSync(orch, { recursive: true })

  const existing = existsSync(worktreePath)
  if (existing) {
    const adopted = adoptManagedWorktree({ root, worktreePath, group })
    if (!adopted.ok) fail(adopted.error)
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
    dependsOn: group.dependsOn,
    status: 'prepared',
    worktreePath: options.dryRun ? worktreePath : resolve(worktreePath),
    branch: `work/${group.slug}`,
    startingHead,
    groupStartingHead: startingHead,
    notes: options.dryRun ? ['dry-run prepare; no worktree created'] : [],
  })
  writeState(orch, state)
  writeJsonAtomic(join(orch, 'manifest.snapshot.json'), group)
  ok(`prepared group ${group.id}`)
  console.log(`  worktree   ${worktreePath}`)
  console.log(`  base       ${group.base}`)
  console.log(`  executor   ${group.executor}`)
  console.log(`  recipes    ${group.recipes.join(', ')}`)
  console.log(`  dependsOn  ${(group.dependsOn ?? []).join(', ') || '(none)'}`)
  console.log(`  state      ${join(orch, 'state.json')}`)
  console.log(
    `  packets    (executor worktree) ${join(worktreePath, 'scripts', 'agent-scratch', 'orchestration', group.id, 'packets')}`,
  )
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
 * Calls `onStart({ pid })` as soon as the child is spawned (before wait), so
 * callers can persist an inspectable in-flight PID.
 * @returns {Promise<{ exitCode: number, pid: number }>}
 */
export function defaultSpawnExecutor({ command, args, cwd, logPath, env, onStart }) {
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
    try {
      onStart?.({ pid })
    } catch (error) {
      child.kill('SIGTERM')
      out.end()
      reject(error instanceof Error ? error : new Error(String(error)))
      return
    }
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

/**
 * Run one recipe in a fresh process. Catalog/specs/packet bind to worktreePath;
 * orchestration state/logs/prompts bind to controller orch.
 */
export async function runOneRecipe({
  group,
  recipeId,
  worktreePath,
  orch,
  state,
  spawnExecutor = defaultSpawnExecutor,
  controllerRoot = REPO_ROOT,
}) {
  const { specsRoot, catalogPath } = executorSpecsPaths(worktreePath)
  if (!existsSync(catalogPath)) {
    throw new Error(`executor worktree catalog missing: ${catalogPath}`)
  }
  const catalogText = loadCatalogText(catalogPath)
  const recipePath = resolveRecipePath(specsRoot, recipeId)
  if (!recipePath) throw new Error(`recipe file missing for ${recipeId} under ${specsRoot}`)
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
    specsRoot,
    recipeIds: group.recipes,
  })

  // Controller-owned orchestration artifacts
  const promptDir = join(orch, 'prompts')
  const logDir = join(orch, 'logs')
  mkdirSync(promptDir, { recursive: true })
  mkdirSync(logDir, { recursive: true })

  // Executor-owned packet (absolute path inside group worktree)
  const packetPath = executorPacketPath(worktreePath, group.id, recipeId)
  mkdirSync(dirname(packetPath), { recursive: true })

  const promptPath = join(promptDir, `${recipeId}.md`)
  const logPath = join(logDir, `${recipeId}.log`)
  const recipePathForPrompt = recipePath.startsWith(worktreePath + sep)
    ? recipePath.slice(worktreePath.length + 1)
    : recipePath.startsWith(controllerRoot + sep)
      ? recipePath.slice(controllerRoot.length + 1)
      : recipePath

  const prompt = buildRecipePrompt({
    recipeId,
    recipePath: recipePathForPrompt,
    recipeStatus: recipeStatus(recipeText) ?? catalog.get(recipeId) ?? 'unknown',
    groupId: group.id,
    packetPath, // absolute — unambiguous across controller vs executor checkout
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
      env: invocation.envExtras ?? {},
      onStart: ({ pid: childPid }) => {
        pid = childPid
        runRecord.pid = childPid
        state.pid = childPid
        replaceRunRecord(state, runRecord)
        writeState(orch, state)
      },
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

  // After snapshots from executor worktree only
  const afterCatalogText = loadCatalogText(catalogPath)
  const after = snapshotStatuses({
    catalogText: afterCatalogText,
    specsRoot,
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

  // Structural set validation before any spawn
  const validation = validateOneOrMany(target, {
    groupsDir: options.groupsDir ?? GROUPS_DIR,
  })
  if (!validation.ok) {
    for (const error of validation.errors) console.error(`  ${error}`)
    fail('manifest failed group-set/catalog validation')
  }

  const controllerRoot = options.controllerRoot ?? REPO_ROOT
  const orch = orchestrationDir(controllerRoot, group.id)
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

  // Bind prepared identity — fail closed on manifest replacement or state drift
  try {
    assertPreparedIdentity({ group, state, orch })
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }

  // dependsOn integration gate (completed + ancestor of base)
  const depErrors = checkDependencyIntegration(group, {
    controllerRoot,
    gitCwd: options.gitCwd,
    isAncestor: options.isAncestor,
    readDepState: options.readDepState,
  })
  if (depErrors.length > 0) {
    for (const error of depErrors) console.error(`  ${error}`)
    fail('dependsOn integration checks failed')
  }

  const worktreePath = state.worktreePath
  const root = options.primaryRoot ?? primaryRoot()
  if (!options.skipSiblingCheck) assertManagedSiblingPath(root, worktreePath)

  try {
    assertWorktreeIdentity({ root, worktreePath, group, state })
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }

  assertCleanWorktree(worktreePath)

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
    const result = await runOneRecipe({
      group,
      recipeId,
      worktreePath,
      orch,
      state,
      spawnExecutor: options.spawnExecutor ?? defaultSpawnExecutor,
      controllerRoot,
    })
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
  console.log(`  controller ${join(orch, 'logs')} (logs/prompts/state)`)
  console.log(
    `  packets    ${join(worktreePath, 'scripts', 'agent-scratch', 'orchestration', group.id, 'packets')}`,
  )
  console.log(
    `  next       human/Codex review + integrate into ${group.base}; then pnpm worktree remove ${group.slug}`,
  )
}

function cmdStatus(args) {
  const target = args[0] ? resolveManifestTarget(args[0]) : null
  if (!target) {
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
  const packetRoot = state?.worktreePath
    ? join(state.worktreePath, 'scripts', 'agent-scratch', 'orchestration', group.id, 'packets')
    : join(orch, 'packets')
  const lines = [
    `# Review summary — group ${group.id}`,
    '',
    `- Executor: ${group.executor}`,
    `- Base: ${group.base}`,
    `- Slug: ${group.slug}`,
    `- Recipes (ordered): ${group.recipes.join(', ')}`,
    `- dependsOn: ${(group.dependsOn ?? []).join(', ') || '(none)'}`,
    `- Status: ${state?.status ?? 'not prepared'}`,
    `- Group starting HEAD: ${state?.groupStartingHead ?? 'n/a'}`,
    `- Ending HEAD: ${state?.endingHead ?? 'n/a'}`,
    `- Completed: ${(state?.completed ?? []).join(', ') || '(none)'}`,
    `- Failed: ${state?.failed ? JSON.stringify(state.failed) : '(none)'}`,
    `- Controller orch: ${orch}`,
    `- Executor packets: ${packetRoot}`,
    '',
    '## Recipe runs',
    '',
  ]
  for (const run of state?.recipeRuns ?? []) {
    lines.push(
      `- ${run.recipeId}: ${run.status} exit=${run.exitCode} ${run.startingHead?.slice(0, 8)}→${run.endingHead?.slice(0, 8) ?? '?'} pid=${run.pid ?? '-'}`,
    )
    if (run.packetPath) lines.push(`  packet: ${run.packetPath}`)
    if (run.reasons) {
      for (const reason of run.reasons) lines.push(`  - ${reason}`)
    }
  }
  lines.push('')
  lines.push('## Integration')
  lines.push('')
  lines.push('This dispatcher never merges, cherry-picks, or pushes. After human review of the')
  lines.push('executor worktree commits and packets (absolute paths in recipe run records), plus')
  lines.push(`controller logs under \`${orch}\`, integrate`)
  lines.push(`\`${state?.branch ?? `work/${group.slug}`}\` into \`${group.base}\` explicitly, then`)
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
(template: template.group.json).

Ownership:
  Controller checkout  scripts/agent-scratch/orchestration/<group-id>/
                       (state.json, manifest.snapshot.json, logs, prompts)
  Executor worktree    scripts/agent-scratch/orchestration/<group-id>/packets/
                       plus catalog/specs used for runtime snapshots

dependsOn:
  validate loads the complete tracked group set (unknown deps, cycles, overlap).
  prepare/run also require each dependency group status=completed and its
  endingHead to be an ancestor of this group's base (explicit integrate first).

Executors:
  grok              ~/.grok/bin/grok (prompt-file, no-subagents, no-memory, high, bypassPermissions, plain)
  claude-personal   CLAUDE_CONFIG_DIR=~/.claude-personal ~/.local/bin/claude (-p, opus, effort high, skip-permissions, disable-slash-commands)

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
