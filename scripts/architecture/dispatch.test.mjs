#!/usr/bin/env node
/**
 * Unit/fixture tests for architecture execution-group dispatch.
 * Uses fixtures and injectable spawn — never deletes real worktrees or pushes.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { CONFIG_FILE, parseWorktreeConfig } from '../worktree.mjs'
import {
  adoptManagedWorktree,
  assertPreparedIdentity,
  assertWorktreeIdentity,
  checkDependencyIntegration,
  defaultSpawnExecutor,
  executorPacketPath,
  executorSpecsPaths,
  loadCatalogText,
  mergeWithTrackedGroups,
  probeWorktreeClean,
  runOneRecipe,
} from './dispatch.mjs'
import {
  assertFreshContextArgs,
  buildClaudePersonalInvocation,
  buildExecutorInvocation,
  buildGrokInvocation,
  FORBIDDEN_CONTEXT_FLAGS,
} from './executors.mjs'
import {
  findGroupCycles,
  parseCatalogStatuses,
  parseExecutionGroup,
  validateGroupSet,
} from './manifest.mjs'
import { evaluatePostconditions } from './postconditions.mjs'
import { buildRecipePrompt } from './prompt.mjs'
import {
  createInitialState,
  identitiesEqual,
  identityFromManifestOrState,
  orchestrationDir,
  readState,
  writeJsonAtomic,
  writeState,
} from './state.mjs'

/**
 * Synchronous variant. An `async` helper hands a sync `test()` callback a Promise it
 * never returns, so a failing assertion inside would reject unobserved and the test
 * would pass. Sync bodies must use this one.
 */
function withTempSync(run) {
  const root = mkdtempSync(join(tmpdir(), 'arch-dispatch-'))
  try {
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

async function withTemp(run) {
  const root = mkdtempSync(join(tmpdir(), 'arch-dispatch-'))
  try {
    return await run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function git(cwd, args) {
  const env = { ...process.env }
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
  ]) {
    delete env[key]
  }
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  })
  if (result.status !== 0) {
    throw new Error((result.stderr ?? '').trim() || `git ${args.join(' ')} failed`)
  }
  return (result.stdout ?? '').trim()
}

function initRepo(dir, { branch = 'main', message = 'init' } = {}) {
  mkdirSync(dir, { recursive: true })
  git(dir, ['init', '-b', branch])
  git(dir, ['config', 'user.name', 'Dispatch Fixture'])
  git(dir, ['config', 'user.email', 'dispatch-fixture@localhost'])
  writeFileSync(join(dir, 'README.md'), '# fixture\n')
  git(dir, ['add', '.'])
  git(dir, ['commit', '-m', message])
  return git(dir, ['rev-parse', 'HEAD'])
}

function writeRecipeFixture(specsRoot, id, status = 'Ready') {
  mkdirSync(specsRoot, { recursive: true })
  writeFileSync(
    join(specsRoot, `${id}.md`),
    `# ${id} — fixture outcome\n\n- Status: ${status}\n- Depends on: none\n`,
  )
}

function writeCatalog(specsRoot, rows) {
  mkdirSync(specsRoot, { recursive: true })
  const body = rows.map(([id, status]) => `| \`${id}\` | ${status} | fixture |`).join('\n')
  writeFileSync(
    join(specsRoot, 'catalog.md'),
    `| ID | Status | Outcome |\n| --- | --- | --- |\n${body}\n`,
  )
}

function writeManagedProfile(worktreePath, { slug, port = 43200, base = 'main' }) {
  writeFileSync(
    join(worktreePath, CONFIG_FILE),
    `${JSON.stringify(
      {
        version: 1,
        slug,
        branch: `work/${slug}`,
        port,
        base,
      },
      null,
      2,
    )}\n`,
  )
}

// --- manifest ---

test('parseExecutionGroup accepts a minimal valid group', () => {
  const result = parseExecutionGroup({
    version: 1,
    id: 'board-slice',
    slug: 'arch-board-slice',
    base: 'main',
    executor: 'grok',
    recipes: ['BRD-004', 'BRD-005'],
    dependsOn: [],
  })
  assert.equal(result.ok, true)
  assert.equal(result.group.executor, 'grok')
  assert.deepEqual(result.group.recipes, ['BRD-004', 'BRD-005'])
})

test('parseExecutionGroup rejects unknown fields and bad executor', () => {
  const unknown = parseExecutionGroup({
    version: 1,
    id: 'x-group',
    executor: 'grok',
    recipes: ['AAA-001'],
    extra: true,
  })
  assert.equal(unknown.ok, false)
  assert.ok(unknown.errors.some((e) => e.includes('unknown field')))

  const badExec = parseExecutionGroup({
    version: 1,
    id: 'y-group',
    executor: 'claude',
    recipes: ['AAA-001'],
  })
  assert.equal(badExec.ok, false)
  assert.ok(badExec.errors.some((e) => e.includes('executor')))
})

test('parseExecutionGroup rejects duplicate recipes and invalid ids', () => {
  const dup = parseExecutionGroup({
    version: 1,
    id: 'z-group',
    executor: 'claude-personal',
    recipes: ['AAA-001', 'AAA-001'],
  })
  assert.equal(dup.ok, false)
  assert.ok(dup.errors.some((e) => e.includes('duplicate')))

  const badId = parseExecutionGroup({
    version: 1,
    id: 'Bad_ID',
    executor: 'grok',
    recipes: ['not-a-recipe'],
  })
  assert.equal(badId.ok, false)
})

test('findGroupCycles and overlapping recipes fail closed', () => {
  const a = parseExecutionGroup({
    version: 1,
    id: 'group-a',
    executor: 'grok',
    recipes: ['AAA-001'],
    dependsOn: ['group-b'],
  }).group
  const b = parseExecutionGroup({
    version: 1,
    id: 'group-b',
    executor: 'grok',
    recipes: ['BBB-001'],
    dependsOn: ['group-a'],
  }).group
  const cycles = findGroupCycles([a, b])
  assert.ok(cycles.some((e) => e.includes('cycle')))

  const catalog = `
| ID | Status | Outcome |
| --- | --- | --- |
| \`AAA-001\` | Ready | x |
| \`BBB-001\` | Ready | y |
`
  const overlapA = parseExecutionGroup({
    version: 1,
    id: 'group-a',
    executor: 'grok',
    recipes: ['AAA-001'],
    dependsOn: [],
  }).group
  const overlapB = parseExecutionGroup({
    version: 1,
    id: 'group-b',
    executor: 'grok',
    recipes: ['AAA-001'],
    dependsOn: [],
  }).group
  withTempSync((root) => {
    const specs = join(root, 'specs')
    mkdirSync(specs)
    writeFileSync(
      join(specs, 'AAA-001.md'),
      '# AAA-001 — outcome\n\n- Status: Ready\n- Depends on: none\n',
    )
    writeFileSync(
      join(specs, 'BBB-001.md'),
      '# BBB-001 — outcome\n\n- Status: Ready\n- Depends on: none\n',
    )
    const errors = validateGroupSet([overlapA, overlapB], {
      catalogText: catalog,
      specsRoot: specs,
    })
    assert.ok(errors.some((e) => e.includes('appears in groups')))
  })
})

test('parseCatalogStatuses reads catalog rows', () => {
  const map = parseCatalogStatuses('| `FOO-001` | Landed | x |\n| `BAR-002` | Ready | y |\n')
  assert.equal(map.get('FOO-001'), 'Landed')
  assert.equal(map.get('BAR-002'), 'Ready')
})

// --- dependsOn structural + integration ---

test('mergeWithTrackedGroups and set validation catch unknown dependsOn', () => {
  withTempSync((root) => {
    const groupsDir = join(root, 'groups')
    mkdirSync(groupsDir, { recursive: true })
    writeFileSync(
      join(groupsDir, 'dep.group.json'),
      JSON.stringify({
        version: 1,
        id: 'dep-group',
        slug: 'arch-dep-group',
        base: 'main',
        executor: 'grok',
        recipes: ['DEP-001'],
        dependsOn: [],
      }),
    )
    const candidate = parseExecutionGroup({
      version: 1,
      id: 'child-group',
      slug: 'arch-child-group',
      base: 'main',
      executor: 'grok',
      recipes: ['CHD-001'],
      dependsOn: ['missing-group'],
    }).group
    const merged = mergeWithTrackedGroups(candidate, groupsDir)
    assert.equal(merged.groups.length, 2)
    const specs = join(root, 'specs')
    writeCatalog(specs, [
      ['DEP-001', 'Ready'],
      ['CHD-001', 'Ready'],
    ])
    writeRecipeFixture(specs, 'DEP-001')
    writeRecipeFixture(specs, 'CHD-001')
    const errors = validateGroupSet(merged.groups, {
      catalogText: readFileSync(join(specs, 'catalog.md'), 'utf8'),
      specsRoot: specs,
    })
    assert.ok(errors.some((e) => e.includes('unknown group missing-group')))
  })
})

test('checkDependencyIntegration fails without completed dep / non-ancestor head', () => {
  const group = parseExecutionGroup({
    version: 1,
    id: 'child',
    slug: 'arch-child',
    base: 'main',
    executor: 'grok',
    recipes: ['CHD-001'],
    dependsOn: ['dep'],
  }).group

  const missing = checkDependencyIntegration(group, {
    readDepState: () => null,
    isAncestor: () => true,
  })
  assert.ok(missing.some((e) => e.includes('no orchestration state')))

  const incomplete = checkDependencyIntegration(group, {
    readDepState: () => ({ status: 'prepared', endingHead: 'abc' }),
    isAncestor: () => true,
  })
  assert.ok(incomplete.some((e) => e.includes('need completed')))

  const notIntegrated = checkDependencyIntegration(group, {
    readDepState: () => ({ status: 'completed', endingHead: 'deadbeefdeadbeef' }),
    isAncestor: () => false,
  })
  assert.ok(notIntegrated.some((e) => e.includes('not an ancestor')))

  const ok = checkDependencyIntegration(group, {
    readDepState: () => ({ status: 'completed', endingHead: 'deadbeefdeadbeef' }),
    isAncestor: () => true,
  })
  assert.deepEqual(ok, [])
})

test('checkDependencyIntegration success with real git ancestor', () => {
  withTempSync((root) => {
    const head = initRepo(root)
    // Create a side commit then merge-base ancestor check: head is ancestor of main
    const group = parseExecutionGroup({
      version: 1,
      id: 'child',
      slug: 'arch-child',
      base: 'main',
      executor: 'grok',
      recipes: ['CHD-001'],
      dependsOn: ['dep'],
    }).group
    const errors = checkDependencyIntegration(group, {
      readDepState: () => ({ status: 'completed', endingHead: head }),
      gitCwd: root,
    })
    assert.deepEqual(errors, [])

    // Non-ancestor: orphan commit via another branch not merged
    git(root, ['checkout', '-b', 'orphan-side'])
    writeFileSync(join(root, 'side.txt'), 'side\n')
    git(root, ['add', '.'])
    git(root, ['commit', '-m', 'side'])
    const sideHead = git(root, ['rev-parse', 'HEAD'])
    git(root, ['checkout', 'main'])
    // sideHead is NOT ancestor of main
    const bad = checkDependencyIntegration(group, {
      readDepState: () => ({ status: 'completed', endingHead: sideHead }),
      gitCwd: root,
    })
    assert.ok(bad.some((e) => e.includes('not an ancestor')))
  })
})

// --- executors ---

test('Grok argv: prompt-file, no-subagents, no-memory, high, bypassPermissions, plain', () => {
  const { command, args } = buildGrokInvocation({
    promptFile: '/tmp/prompt.md',
    cwd: '/tmp/wt',
    grokBin: '/home/user/.grok/bin/grok',
  })
  assert.equal(command, '/home/user/.grok/bin/grok')
  assert.deepEqual(args, [
    '--prompt-file',
    '/tmp/prompt.md',
    '--cwd',
    '/tmp/wt',
    '--no-subagents',
    '--no-memory',
    '--reasoning-effort',
    'high',
    '--permission-mode',
    'bypassPermissions',
    '--output-format',
    'plain',
  ])
  assertFreshContextArgs(args)
  for (const flag of FORBIDDEN_CONTEXT_FLAGS) {
    assert.equal(args.includes(flag), false)
  }
})

test('Claude Personal uses the personal config and Opus high', () => {
  const { command, args, envExtras } = buildClaudePersonalInvocation({
    prompt: 'execute only RECIPE',
    cwd: '/tmp/wt',
    claudeBin: '/home/user/.local/bin/claude',
  })
  assert.equal(command, '/home/user/.local/bin/claude')
  assert.equal(args[0], '-p')
  assert.ok(args.includes('--model'))
  assert.ok(args.includes('opus'))
  assert.ok(args.includes('--effort'))
  assert.ok(args.includes('high'))
  assert.ok(args.includes('--dangerously-skip-permissions'))
  assert.ok(args.includes('--disable-slash-commands'))
  assert.equal(args.at(-1), 'execute only RECIPE')
  assert.equal(envExtras.CLAUDE_CONFIG_DIR.endsWith('/.claude-personal'), true)
  assertFreshContextArgs(args)
})

test('buildExecutorInvocation rejects resume-style args via assertFreshContextArgs', () => {
  const inv = buildExecutorInvocation('grok', {
    promptFile: '/p',
    prompt: 'x',
    cwd: '/w',
  })
  assert.throws(() => assertFreshContextArgs([...inv.args, '--continue']))
  assert.throws(() => assertFreshContextArgs([...inv.args, '--resume']))
})

test('manifest vocabulary is claude-personal not claude', () => {
  assert.equal(
    parseExecutionGroup({
      version: 1,
      id: 'cp',
      executor: 'claude-personal',
      recipes: ['AAA-001'],
    }).ok,
    true,
  )
  assert.equal(
    parseExecutionGroup({
      version: 1,
      id: 'cp2',
      executor: 'claude',
      recipes: ['AAA-001'],
    }).ok,
    false,
  )
})

// --- postconditions ---

test('evaluatePostconditions requires exit 0, new commit, clean, packet, Landed, no drift', () => {
  const before = {
    catalog: { 'AAA-001': 'Ready', 'BBB-001': 'Queued' },
    recipes: { 'AAA-001': 'Ready', 'BBB-001': 'Queued' },
  }
  const afterOk = {
    catalog: { 'AAA-001': 'Landed', 'BBB-001': 'Queued' },
    recipes: { 'AAA-001': 'Landed', 'BBB-001': 'Queued' },
  }
  const ok = evaluatePostconditions({
    exitCode: 0,
    startingHead: 'aaaaaaaa',
    endingHead: 'bbbbbbbb',
    worktreeClean: true,
    packetPath: '/tmp/p.md',
    packetExists: true,
    recipeId: 'AAA-001',
    before,
    after: afterOk,
    allGroupRecipeIds: ['AAA-001', 'BBB-001'],
  })
  assert.equal(ok.ok, true)

  const noCommit = evaluatePostconditions({
    exitCode: 0,
    startingHead: 'aaaaaaaa',
    endingHead: 'aaaaaaaa',
    worktreeClean: true,
    packetPath: '/tmp/p.md',
    packetExists: true,
    recipeId: 'AAA-001',
    before,
    after: afterOk,
    allGroupRecipeIds: ['AAA-001'],
  })
  assert.equal(noCommit.ok, false)
  assert.ok(noCommit.reasons.some((r) => r.includes('HEAD did not advance')))

  const drift = evaluatePostconditions({
    exitCode: 0,
    startingHead: 'aaaaaaaa',
    endingHead: 'bbbbbbbb',
    worktreeClean: true,
    packetPath: '/tmp/p.md',
    packetExists: true,
    recipeId: 'AAA-001',
    before,
    after: {
      catalog: { 'AAA-001': 'Landed', 'BBB-001': 'Landed' },
      recipes: { 'AAA-001': 'Landed', 'BBB-001': 'Landed' },
    },
    allGroupRecipeIds: ['AAA-001', 'BBB-001'],
  })
  assert.equal(drift.ok, false)
  assert.ok(drift.reasons.some((r) => r.includes('unrelated')))
})

test('evaluatePostconditions fails on non-zero exit and missing packet', () => {
  const before = { catalog: { 'AAA-001': 'Ready' }, recipes: { 'AAA-001': 'Ready' } }
  const after = { catalog: { 'AAA-001': 'Landed' }, recipes: { 'AAA-001': 'Landed' } }
  const result = evaluatePostconditions({
    exitCode: 2,
    startingHead: 'aaaaaaaa',
    endingHead: 'bbbbbbbb',
    worktreeClean: true,
    packetPath: '/tmp/missing.md',
    packetExists: false,
    recipeId: 'AAA-001',
    before,
    after,
    allGroupRecipeIds: ['AAA-001'],
  })
  assert.equal(result.ok, false)
  assert.ok(result.reasons.some((r) => r.includes('exit code')))
  assert.ok(result.reasons.some((r) => r.includes('packet')))
})

// --- state atomic + identity ---

test('atomic state write and interrupted status fields', () => {
  withTempSync((root) => {
    const orchRoot = join(root, 'scripts', 'agent-scratch', 'orchestration', 'group-x')
    mkdirSync(orchRoot, { recursive: true })
    const state = createInitialState({
      groupId: 'group-x',
      slug: 'arch-group-x',
      base: 'main',
      executor: 'grok',
      recipes: ['AAA-001'],
      dependsOn: ['prior'],
      status: 'running',
      worktreePath: join(root, 'wt'),
      branch: 'work/arch-group-x',
      startingHead: 'abc123',
      groupStartingHead: 'abc123',
    })
    state.currentRecipe = 'AAA-001'
    state.pid = 4242
    state.startTime = '2026-01-01T00:00:00.000Z'
    state.recipeRuns = [
      {
        recipeId: 'AAA-001',
        pid: 4242,
        startTime: state.startTime,
        endTime: null,
        exitCode: null,
        startingHead: 'abc123',
        endingHead: null,
        status: 'running',
      },
    ]
    writeState(orchRoot, state)
    const loaded = readState(orchRoot)
    assert.equal(loaded.status, 'running')
    assert.equal(loaded.pid, 4242)
    assert.equal(loaded.currentRecipe, 'AAA-001')
    assert.deepEqual(loaded.dependsOn, ['prior'])
    assert.equal(loaded.recipeRuns[0].endTime, null)

    loaded.status = 'interrupted'
    loaded.endTime = '2026-01-01T00:01:00.000Z'
    writeState(orchRoot, loaded)
    assert.equal(readState(orchRoot).status, 'interrupted')

    const nested = join(orchRoot, 'nested', 'x.json')
    writeJsonAtomic(nested, { ok: true })
    assert.equal(JSON.parse(readFileSync(nested, 'utf8')).ok, true)
  })
})

test('assertPreparedIdentity fails closed on manifest replacement', () => {
  withTempSync((root) => {
    const orch = join(root, 'scripts', 'agent-scratch', 'orchestration', 'g1')
    mkdirSync(orch, { recursive: true })
    const group = parseExecutionGroup({
      version: 1,
      id: 'g1',
      slug: 'arch-g1',
      base: 'main',
      executor: 'grok',
      recipes: ['AAA-001'],
      dependsOn: [],
    }).group
    const state = createInitialState({
      groupId: group.id,
      slug: group.slug,
      base: group.base,
      executor: group.executor,
      recipes: group.recipes,
      dependsOn: group.dependsOn,
      status: 'prepared',
      worktreePath: join(root, 'wt'),
      branch: `work/${group.slug}`,
      startingHead: 'a',
      groupStartingHead: 'a',
    })
    writeState(orch, state)
    writeJsonAtomic(join(orch, 'manifest.snapshot.json'), group)

    assert.deepEqual(
      assertPreparedIdentity({ group, state, orch }),
      identityFromManifestOrState(group),
    )

    const replaced = { ...group, recipes: ['BBB-001'] }
    assert.throws(
      () => assertPreparedIdentity({ group: replaced, state, orch }),
      /manifest changed since prepare/,
    )

    const driftedState = { ...state, executor: 'claude-personal' }
    assert.throws(
      () => assertPreparedIdentity({ group, state: driftedState, orch }),
      /state identity does not match/,
    )

    assert.equal(
      identitiesEqual(identityFromManifestOrState(group), identityFromManifestOrState(group)),
      true,
    )
  })
})

// --- worktree adoption ---

test('adoptManagedWorktree rejects malformed, wrong-slug, wrong-base, wrong-branch profiles', () => {
  withTempSync((root) => {
    initRepo(root)
    const group = parseExecutionGroup({
      version: 1,
      id: 'adopt-g',
      slug: 'arch-adopt',
      base: 'main',
      executor: 'grok',
      recipes: ['AAA-001'],
    }).group

    const wt = join(root, 'wt-bad')
    mkdirSync(wt, { recursive: true })

    // missing profile
    assert.equal(adoptManagedWorktree({ root, worktreePath: wt, group }).ok, false)

    // malformed JSON
    writeFileSync(join(wt, CONFIG_FILE), '{not-json')
    assert.equal(adoptManagedWorktree({ root, worktreePath: wt, group }).ok, false)

    // wrong slug
    writeManagedProfile(wt, { slug: 'other-slug', base: 'main' })
    assert.ok(adoptManagedWorktree({ root, worktreePath: wt, group }).error.includes('slug'))

    // wrong base
    writeManagedProfile(wt, { slug: group.slug, base: 'work/other' })
    assert.ok(adoptManagedWorktree({ root, worktreePath: wt, group }).error.includes('base'))

    // valid profile shape but not a linked worktree
    writeManagedProfile(wt, { slug: group.slug, base: 'main' })
    const notLinked = adoptManagedWorktree({ root, worktreePath: wt, group })
    assert.equal(notLinked.ok, false)
    assert.ok(notLinked.error.includes('not a linked worktree'))
  })
})

test('adoptManagedWorktree accepts linked worktree with matching profile and branch', () => {
  withTempSync((root) => {
    initRepo(root)
    const slug = 'arch-adopt-ok'
    const group = parseExecutionGroup({
      version: 1,
      id: 'adopt-ok',
      slug,
      base: 'main',
      executor: 'grok',
      recipes: ['AAA-001'],
    }).group
    const wt = join(root, 'linked-wt')
    git(root, ['worktree', 'add', '-b', `work/${slug}`, wt])
    writeManagedProfile(wt, { slug, base: 'main', port: 43211 })
    const adopted = adoptManagedWorktree({ root, worktreePath: wt, group })
    assert.equal(adopted.ok, true)
    assert.equal(adopted.config.slug, slug)
    assert.equal(adopted.config.base, 'main')

    // wrong current branch (checkout main inside worktree is not possible while branch is checked out elsewhere —
    // create detached HEAD instead)
    git(wt, ['checkout', '--detach', 'HEAD'])
    const detached = adoptManagedWorktree({ root, worktreePath: wt, group })
    assert.equal(detached.ok, false)
    assert.ok(detached.error.includes('detached') || detached.error.includes('branch'))
  })
})

test('parseWorktreeConfig is used for adoption (not raw JSON trust)', () => {
  const parsed = parseWorktreeConfig({
    version: 1,
    slug: 'arch-x',
    branch: 'work/arch-x',
    port: 43200,
    base: 'refs/heads/main',
  })
  assert.equal(parsed.ok, true)
  assert.equal(parsed.config.base, 'main')
  assert.equal(
    parseWorktreeConfig({
      version: 1,
      slug: 'arch-x',
      branch: 'work/wrong',
      port: 43200,
    }).ok,
    false,
  )
})

// --- prompt ---

test('recipe prompt binds one recipe, requires execute skill, no push, stop after', () => {
  const packet = '/abs/executor/scripts/agent-scratch/orchestration/board-slice/packets/BRD-004.md'
  const prompt = buildRecipePrompt({
    recipeId: 'BRD-004',
    recipePath: 'plans/architecture-refactor/specs/BRD-004.md',
    recipeStatus: 'Ready',
    groupId: 'board-slice',
    packetPath: packet,
    startingHead: 'deadbeef',
  })
  assert.match(prompt, /BRD-004/)
  assert.match(prompt, /execute-architecture-spec/)
  assert.match(prompt, /Do not push/)
  assert.match(prompt, /Stop after this single recipe/)
  assert.match(prompt, new RegExp(packet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(prompt, /BRD-005/)
})

// --- no automatic integration ---

test('dispatcher modules never export merge/push/cherry-pick helpers', async () => {
  const dispatchSource = readFileSync(new URL('./dispatch.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(dispatchSource, /['"]cherry-pick['"]/)
  assert.doesNotMatch(dispatchSource, /['"]push['"]/)
  assert.doesNotMatch(dispatchSource, /merge --ff-only/)
  assert.match(dispatchSource, /never merges/)
  assert.doesNotMatch(dispatchSource, /shell:\s*true/)
  assert.match(dispatchSource, /shell:\s*false/)
})

// --- fresh process per recipe (mock spawn) ---

test('sequential run launches a new process per recipe and stops closed on mismatch', async () => {
  const launches = []
  const recipes = ['AAA-001', 'BBB-001']
  let head = '11111111'
  const status = {
    catalog: { 'AAA-001': 'Ready', 'BBB-001': 'Ready' },
    recipes: { 'AAA-001': 'Ready', 'BBB-001': 'Ready' },
  }

  async function fakeRun(recipeId, { failPacket = false } = {}) {
    launches.push({ recipeId, t: Date.now() })
    const startingHead = head
    head = `${'c'.repeat(7)}${launches.length}`
    const before =
      recipeId === 'AAA-001'
        ? {
            catalog: { 'AAA-001': 'Ready', 'BBB-001': 'Ready' },
            recipes: { 'AAA-001': 'Ready', 'BBB-001': 'Ready' },
          }
        : {
            catalog: { 'AAA-001': 'Landed', 'BBB-001': 'Ready' },
            recipes: { 'AAA-001': 'Landed', 'BBB-001': 'Ready' },
          }
    status.catalog[recipeId] = 'Landed'
    status.recipes[recipeId] = 'Landed'
    const after = {
      catalog: { ...status.catalog },
      recipes: { ...status.recipes },
    }
    return evaluatePostconditions({
      exitCode: 0,
      startingHead,
      endingHead: head,
      worktreeClean: true,
      packetPath: `/tmp/${recipeId}.md`,
      packetExists: !failPacket,
      recipeId,
      before,
      after,
      allGroupRecipeIds: recipes,
    })
  }

  const first = await fakeRun('AAA-001')
  assert.equal(first.ok, true)
  const second = await fakeRun('BBB-001', { failPacket: true })
  assert.equal(second.ok, false)
  assert.equal(launches.length, 2)
  assert.notEqual(launches[0].recipeId, launches[1].recipeId)
})

test('orchestrationDir rejects path-like group ids', () => {
  assert.throws(() => orchestrationDir('/repo', '../evil'))
  assert.throws(() => orchestrationDir('/repo', 'a/b'))
})

// --- PID persistence while running ---

test('defaultSpawnExecutor exposes PID via onStart before exit; state is inspectable in-flight', async () => {
  await withTemp(async (root) => {
    const orch = join(root, 'scripts', 'agent-scratch', 'orchestration', 'pid-group')
    mkdirSync(orch, { recursive: true })
    const logPath = join(orch, 'logs', 'pid.log')
    mkdirSync(join(orch, 'logs'), { recursive: true })

    const state = createInitialState({
      groupId: 'pid-group',
      slug: 'arch-pid',
      base: 'main',
      executor: 'grok',
      recipes: ['PID-001'],
      dependsOn: [],
      status: 'running',
      worktreePath: root,
      branch: 'work/arch-pid',
      startingHead: 'aaa',
      groupStartingHead: 'aaa',
    })
    const runRecord = {
      recipeId: 'PID-001',
      pid: null,
      startTime: new Date().toISOString(),
      endTime: null,
      exitCode: null,
      startingHead: 'aaa',
      endingHead: null,
      status: 'running',
      logPath,
    }
    state.recipeRuns = [runRecord]
    writeState(orch, state)

    let sawInflight = false
    const result = await defaultSpawnExecutor({
      command: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 150)'],
      cwd: root,
      logPath,
      env: {},
      onStart: ({ pid }) => {
        assert.ok(pid > 0)
        runRecord.pid = pid
        state.pid = pid
        writeState(orch, state)
        const inflight = readState(orch)
        assert.equal(inflight.pid, pid)
        assert.equal(inflight.recipeRuns[0].status, 'running')
        assert.equal(inflight.recipeRuns[0].endTime, null)
        assert.equal(inflight.recipeRuns[0].pid, pid)
        sawInflight = true
      },
    })
    assert.equal(sawInflight, true)
    assert.equal(result.exitCode, 0)
    assert.equal(result.pid, state.pid)

    // finalize
    state.pid = null
    runRecord.endTime = new Date().toISOString()
    runRecord.exitCode = result.exitCode
    runRecord.status = 'landed'
    writeState(orch, state)
    const done = readState(orch)
    assert.equal(done.pid, null)
    assert.equal(done.recipeRuns[0].status, 'landed')
  })
})

// --- cross-worktree ownership (would fail with controller-bound catalog/packet) ---

test('cross-worktree: runtime catalog/status/packet bind to executor worktree not controller', async () => {
  await withTemp(async (root) => {
    // Controller checkout (orchestration only)
    const controller = join(root, 'controller')
    initRepo(controller)
    const controllerSpecs = join(controller, 'plans', 'architecture-refactor', 'specs')
    // Controller still says Ready — old split would read this and fail postconditions
    writeCatalog(controllerSpecs, [['XWT-001', 'Ready']])
    writeRecipeFixture(controllerSpecs, 'XWT-001', 'Ready')

    // Executor linked worktree — the only place that lands
    const slug = 'arch-xwt'
    const worktreePath = join(root, 'executor-wt')
    git(controller, ['worktree', 'add', '-b', `work/${slug}`, worktreePath])
    // Seed same tree, then we will land only in executor
    const specsRoot = join(worktreePath, 'plans', 'architecture-refactor', 'specs')
    writeCatalog(specsRoot, [['XWT-001', 'Ready']])
    writeRecipeFixture(specsRoot, 'XWT-001', 'Ready')
    writeManagedProfile(worktreePath, { slug, base: 'main', port: 43222 })
    git(worktreePath, ['add', '.'])
    git(worktreePath, ['commit', '-m', 'seed executor fixtures'])

    const group = parseExecutionGroup({
      version: 1,
      id: 'xwt-group',
      slug,
      base: 'main',
      executor: 'grok',
      recipes: ['XWT-001'],
      dependsOn: [],
    }).group

    const orch = orchestrationDir(controller, group.id)
    mkdirSync(orch, { recursive: true })
    const state = createInitialState({
      groupId: group.id,
      slug: group.slug,
      base: group.base,
      executor: group.executor,
      recipes: group.recipes,
      dependsOn: group.dependsOn,
      status: 'prepared',
      worktreePath: resolve(worktreePath),
      branch: `work/${slug}`,
      startingHead: git(worktreePath, ['rev-parse', 'HEAD']),
      groupStartingHead: git(worktreePath, ['rev-parse', 'HEAD']),
    })
    writeState(orch, state)
    writeJsonAtomic(join(orch, 'manifest.snapshot.json'), group)

    // Identity bind works
    assertPreparedIdentity({ group, state, orch })
    assertWorktreeIdentity({
      root: controller,
      worktreePath,
      group,
      state,
    })

    const expectedPacket = executorPacketPath(worktreePath, group.id, 'XWT-001')
    assert.ok(expectedPacket.startsWith(worktreePath))
    assert.equal(executorSpecsPaths(worktreePath).catalogPath, join(specsRoot, 'catalog.md'))

    const result = await runOneRecipe({
      group,
      recipeId: 'XWT-001',
      worktreePath,
      orch,
      state,
      controllerRoot: controller,
      spawnExecutor: async ({ onStart, cwd, logPath }) => {
        onStart?.({ pid: 99901 })
        // Land ONLY in executor worktree (catalog + recipe + packet + commit)
        writeCatalog(specsRoot, [['XWT-001', 'Landed']])
        writeRecipeFixture(specsRoot, 'XWT-001', 'Landed')
        mkdirSync(join(expectedPacket, '..'), { recursive: true })
        writeFileSync(expectedPacket, '# packet XWT-001\n\n- landed in executor worktree\n')
        writeFileSync(join(cwd, 'landed.txt'), 'done\n')
        git(cwd, ['add', '.'])
        git(cwd, ['commit', '-m', 'feat: land XWT-001 in executor worktree'])
        // Touch log path so spawn contract is realistic
        mkdirSync(join(logPath, '..'), { recursive: true })
        writeFileSync(logPath, 'executor mock ok\n')
        return { exitCode: 0, pid: 99901 }
      },
    })

    assert.equal(result.ok, true, result.reasons?.join('; '))
    assert.equal(existsSync(expectedPacket), true)
    assert.equal(result.runRecord.packetPath, expectedPacket)
    assert.equal(result.runRecord.pid, 99901)

    // Controller catalog still Ready — proves we did not snapshot from controller
    const controllerCatalog = readFileSync(join(controllerSpecs, 'catalog.md'), 'utf8')
    assert.match(controllerCatalog, /XWT-001` \| Ready/)
    // Executor catalog Landed
    const executorCatalog = readFileSync(join(specsRoot, 'catalog.md'), 'utf8')
    assert.match(executorCatalog, /XWT-001` \| Landed/)

    // Packet must not be required under controller orch
    assert.equal(existsSync(join(orch, 'packets', 'XWT-001.md')), false)

    const finalState = readState(orch)
    assert.deepEqual(finalState.completed, ['XWT-001'])
    assert.equal(finalState.pid, null)
    assert.ok(finalState.recipeRuns[0].packetPath.startsWith(worktreePath))
  })
})

test('cross-worktree: postconditions fail if packet only exists on controller (old split)', async () => {
  await withTemp(async (root) => {
    const controller = join(root, 'controller')
    initRepo(controller)
    const slug = 'arch-xwt-fail'
    const worktreePath = join(root, 'executor-wt')
    git(controller, ['worktree', 'add', '-b', `work/${slug}`, worktreePath])

    const specsRoot = join(worktreePath, 'plans', 'architecture-refactor', 'specs')
    writeCatalog(specsRoot, [['XWT-002', 'Ready']])
    writeRecipeFixture(specsRoot, 'XWT-002', 'Ready')
    writeManagedProfile(worktreePath, { slug, base: 'main', port: 43223 })
    git(worktreePath, ['add', '.'])
    git(worktreePath, ['commit', '-m', 'seed'])

    const group = parseExecutionGroup({
      version: 1,
      id: 'xwt-fail',
      slug,
      base: 'main',
      executor: 'grok',
      recipes: ['XWT-002'],
      dependsOn: [],
    }).group
    const orch = orchestrationDir(controller, group.id)
    mkdirSync(orch, { recursive: true })
    const state = createInitialState({
      groupId: group.id,
      slug,
      base: 'main',
      executor: 'grok',
      recipes: ['XWT-002'],
      dependsOn: [],
      status: 'prepared',
      worktreePath: resolve(worktreePath),
      branch: `work/${slug}`,
      startingHead: git(worktreePath, ['rev-parse', 'HEAD']),
      groupStartingHead: git(worktreePath, ['rev-parse', 'HEAD']),
    })
    writeState(orch, state)

    // Old split: write packet under controller orch only
    const wrongPacket = join(orch, 'packets', 'XWT-002.md')
    mkdirSync(join(wrongPacket, '..'), { recursive: true })
    writeFileSync(wrongPacket, 'wrong place\n')

    const result = await runOneRecipe({
      group,
      recipeId: 'XWT-002',
      worktreePath,
      orch,
      state,
      controllerRoot: controller,
      spawnExecutor: async ({ onStart, cwd }) => {
        onStart?.({ pid: 1 })
        writeCatalog(specsRoot, [['XWT-002', 'Landed']])
        writeRecipeFixture(specsRoot, 'XWT-002', 'Landed')
        writeFileSync(join(cwd, 'x.txt'), 'x\n')
        git(cwd, ['add', '.'])
        git(cwd, ['commit', '-m', 'land without executor packet'])
        return { exitCode: 0, pid: 1 }
      },
    })
    assert.equal(result.ok, false)
    assert.ok(result.reasons.some((r) => r.includes('packet')))
    const expected = executorPacketPath(worktreePath, group.id, 'XWT-002')
    assert.equal(existsSync(expected), false)
    assert.equal(existsSync(wrongPacket), true)
  })
})

// --- post-executor finalization (no stale running state) ---

/**
 * Shared fixture: prepared controller orch + linked executor worktree with one Ready recipe.
 */
function setupExecutorFixture(root, { slug, groupId, recipeId, port }) {
  const controller = join(root, 'controller')
  initRepo(controller)
  const worktreePath = join(root, 'executor-wt')
  git(controller, ['worktree', 'add', '-b', `work/${slug}`, worktreePath])
  const specsRoot = join(worktreePath, 'plans', 'architecture-refactor', 'specs')
  writeCatalog(specsRoot, [[recipeId, 'Ready']])
  writeRecipeFixture(specsRoot, recipeId, 'Ready')
  writeManagedProfile(worktreePath, { slug, base: 'main', port })
  git(worktreePath, ['add', '.'])
  git(worktreePath, ['commit', '-m', 'seed executor fixtures'])

  const group = parseExecutionGroup({
    version: 1,
    id: groupId,
    slug,
    base: 'main',
    executor: 'grok',
    recipes: [recipeId],
    dependsOn: [],
  }).group
  const orch = orchestrationDir(controller, group.id)
  mkdirSync(orch, { recursive: true })
  const startingHead = git(worktreePath, ['rev-parse', 'HEAD'])
  const state = createInitialState({
    groupId: group.id,
    slug: group.slug,
    base: group.base,
    executor: group.executor,
    recipes: group.recipes,
    dependsOn: group.dependsOn,
    status: 'prepared',
    worktreePath: resolve(worktreePath),
    branch: `work/${slug}`,
    startingHead,
    groupStartingHead: startingHead,
  })
  writeState(orch, state)
  writeJsonAtomic(join(orch, 'manifest.snapshot.json'), group)
  return { controller, worktreePath, specsRoot, group, orch, state }
}

function assertDurableFailed(finalState, { recipeId, deadPid }) {
  assert.equal(finalState.status, 'failed', 'group must be failed, not running')
  assert.equal(finalState.pid, null, 'pid must be cleared')
  assert.equal(finalState.currentRecipe, null, 'currentRecipe must be cleared')
  assert.ok(finalState.endTime, 'group endTime set')
  assert.ok(finalState.failed, 'failed payload stored')
  assert.equal(finalState.failed.recipeId, recipeId)
  assert.ok(Array.isArray(finalState.failed.reasons) && finalState.failed.reasons.length > 0)
  const run = finalState.recipeRuns.at(-1)
  assert.ok(run, 'run record exists')
  assert.equal(run.recipeId, recipeId)
  assert.notEqual(run.status, 'running', 'run record must not stay running')
  assert.ok(run.endTime, 'run endTime set')
  assert.equal(run.pid, deadPid)
  assert.ok(run.reasons?.length || run.error, 'diagnostic detail preserved')
}

test('post-executor: dirty worktree finalizes failed state (no process.exit / no stale pid)', async () => {
  await withTemp(async (root) => {
    const recipeId = 'FIN-001'
    const { controller, worktreePath, specsRoot, group, orch, state } = setupExecutorFixture(root, {
      slug: 'arch-fin-dirty',
      groupId: 'fin-dirty',
      recipeId,
      port: 43230,
    })
    const packetPath = executorPacketPath(worktreePath, group.id, recipeId)
    const deadPid = 77701

    const result = await runOneRecipe({
      group,
      recipeId,
      worktreePath,
      orch,
      state,
      controllerRoot: controller,
      spawnExecutor: async ({ onStart, cwd, logPath }) => {
        onStart?.({ pid: deadPid })
        // Land catalog/recipe/packet/commit as if executor succeeded…
        writeCatalog(specsRoot, [[recipeId, 'Landed']])
        writeRecipeFixture(specsRoot, recipeId, 'Landed')
        mkdirSync(join(packetPath, '..'), { recursive: true })
        writeFileSync(packetPath, `# packet ${recipeId}\n`)
        writeFileSync(join(cwd, 'landed.txt'), 'done\n')
        git(cwd, ['add', '.'])
        git(cwd, ['commit', '-m', `feat: land ${recipeId}`])
        // …then leave untracked dirt that would previously process.exit before finalization
        writeFileSync(join(cwd, 'leftover-dirt.txt'), 'executor left this\n')
        mkdirSync(join(logPath, '..'), { recursive: true })
        writeFileSync(logPath, 'mock executor exited 0 with dirty tree\n')
        return { exitCode: 0, pid: deadPid }
      },
    })

    assert.equal(result.ok, false)
    assert.ok(
      result.reasons.some((r) => r.includes('clean') || r.includes('dirty')),
      `expected clean/dirty reason, got: ${result.reasons.join('; ')}`,
    )
    // Must return (not throw / not exit) so caller can stop-closed
    const finalState = readState(orch)
    assertDurableFailed(finalState, { recipeId, deadPid })
    assert.ok(
      finalState.failed.reasons.some((r) => r.includes('dirty') || r.includes('clean')),
      `durable reasons: ${finalState.failed.reasons.join('; ')}`,
    )
  })
})

test('post-executor: missing catalog after exit finalizes failed (pid/currentRecipe cleared)', async () => {
  await withTemp(async (root) => {
    const recipeId = 'FIN-002'
    const { controller, worktreePath, specsRoot, group, orch, state } = setupExecutorFixture(root, {
      slug: 'arch-fin-cat',
      groupId: 'fin-cat',
      recipeId,
      port: 43231,
    })
    const catalogPath = join(specsRoot, 'catalog.md')
    const deadPid = 77702

    const result = await runOneRecipe({
      group,
      recipeId,
      worktreePath,
      orch,
      state,
      controllerRoot: controller,
      spawnExecutor: async ({ onStart, cwd, logPath }) => {
        onStart?.({ pid: deadPid })
        // Commit a new HEAD, then remove catalog so after-snapshot throws
        writeFileSync(join(cwd, 'landed.txt'), 'done\n')
        git(cwd, ['add', '.'])
        git(cwd, ['commit', '-m', `feat: pretend land ${recipeId}`])
        rmSync(catalogPath, { force: true })
        mkdirSync(join(logPath, '..'), { recursive: true })
        writeFileSync(logPath, 'mock executor deleted catalog\n')
        return { exitCode: 0, pid: deadPid }
      },
    })

    assert.equal(result.ok, false)
    assert.ok(
      result.reasons.some((r) => r.includes('catalog') || r.includes('evidence')),
      `expected catalog/evidence reason, got: ${result.reasons.join('; ')}`,
    )
    const finalState = readState(orch)
    assertDurableFailed(finalState, { recipeId, deadPid })
    assert.ok(
      finalState.failed.reasons.some((r) => r.includes('catalog') || r.includes('evidence')),
    )
  })
})

test('post-executor: corrupt catalog after exit finalizes failed with diagnostic reason', async () => {
  await withTemp(async (root) => {
    const recipeId = 'FIN-003'
    const { controller, worktreePath, specsRoot, group, orch, state } = setupExecutorFixture(root, {
      slug: 'arch-fin-cor',
      groupId: 'fin-cor',
      recipeId,
      port: 43232,
    })
    const catalogPath = join(specsRoot, 'catalog.md')
    const recipePath = join(specsRoot, `${recipeId}.md`)
    const deadPid = 77703

    const result = await runOneRecipe({
      group,
      recipeId,
      worktreePath,
      orch,
      state,
      controllerRoot: controller,
      spawnExecutor: async ({ onStart, cwd, logPath }) => {
        onStart?.({ pid: deadPid })
        writeFileSync(join(cwd, 'landed.txt'), 'done\n')
        git(cwd, ['add', '.'])
        git(cwd, ['commit', '-m', `feat: pretend land ${recipeId}`])
        // Corrupt after commit: empty catalog + unreadable recipe status surface
        writeFileSync(catalogPath, 'this is not a catalog table\n')
        // Delete recipe file so recipe status is null / missing Landed
        rmSync(recipePath, { force: true })
        mkdirSync(join(logPath, '..'), { recursive: true })
        writeFileSync(logPath, 'mock executor corrupted catalog\n')
        return { exitCode: 0, pid: deadPid }
      },
    })

    assert.equal(result.ok, false)
    assert.ok(result.reasons.length > 0)
    const finalState = readState(orch)
    assertDurableFailed(finalState, { recipeId, deadPid })
    // Corrupt catalog parses as empty → postconditions report missing Landed (not process.exit)
    assert.ok(
      finalState.failed.reasons.some(
        (r) =>
          r.includes('Landed') ||
          r.includes('catalog') ||
          r.includes('packet') ||
          r.includes('evidence'),
      ),
      `durable reasons: ${finalState.failed.reasons.join('; ')}`,
    )
  })
})

test('probeWorktreeClean returns structured dirty result and never exits', () => {
  withTempSync((root) => {
    initRepo(root)
    assert.equal(probeWorktreeClean(root).clean, true)
    writeFileSync(join(root, 'dirt.txt'), 'x\n')
    const dirty = probeWorktreeClean(root)
    assert.equal(dirty.clean, false)
    assert.ok(dirty.lines.some((l) => l.includes('dirt.txt')))
  })
})

test('loadCatalogText throws ordinary Error on missing file (not process.exit)', () => {
  withTempSync((root) => {
    assert.throws(() => loadCatalogText(join(root, 'no-such-catalog.md')), /catalog missing/)
  })
})
