#!/usr/bin/env node
/**
 * Unit/fixture tests for architecture execution-group dispatch.
 * Uses fixtures and injectable spawn — never deletes real worktrees or pushes.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
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
  orchestrationDir,
  readState,
  writeJsonAtomic,
  writeState,
} from './state.mjs'

function withTemp(run) {
  const root = mkdtempSync(join(tmpdir(), 'arch-dispatch-'))
  try {
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
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
  withTemp((root) => {
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

test('Claude Personal argv: -p opus max skip-permissions disable-slash-commands', () => {
  const { command, args } = buildClaudePersonalInvocation({
    prompt: 'execute only RECIPE',
    cwd: '/tmp/wt',
    claudeBin: '/home/user/.local/bin/claude',
  })
  assert.equal(command, '/home/user/.local/bin/claude')
  assert.equal(args[0], '-p')
  assert.ok(args.includes('--model'))
  assert.ok(args.includes('opus'))
  assert.ok(args.includes('--effort'))
  assert.ok(args.includes('max'))
  assert.ok(args.includes('--dangerously-skip-permissions'))
  assert.ok(args.includes('--disable-slash-commands'))
  assert.equal(args.at(-1), 'execute only RECIPE')
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

// --- state atomic + interrupted inspectability ---

test('atomic state write and interrupted status fields', () => {
  withTemp((root) => {
    // orchestrationDir expects real repo shape — synthesize under root
    const orchRoot = join(root, 'scripts', 'agent-scratch', 'orchestration', 'group-x')
    mkdirSync(orchRoot, { recursive: true })
    // writeState derives repo root from path marker
    const state = createInitialState({
      groupId: 'group-x',
      slug: 'arch-group-x',
      base: 'main',
      executor: 'grok',
      recipes: ['AAA-001'],
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
    assert.equal(loaded.recipeRuns[0].endTime, null)

    // atomic overwrite
    loaded.status = 'interrupted'
    loaded.endTime = '2026-01-01T00:01:00.000Z'
    writeState(orchRoot, loaded)
    assert.equal(readState(orchRoot).status, 'interrupted')

    // writeJsonAtomic creates parent dirs
    const nested = join(orchRoot, 'nested', 'x.json')
    writeJsonAtomic(nested, { ok: true })
    assert.equal(JSON.parse(readFileSync(nested, 'utf8')).ok, true)
  })
})

// --- prompt ---

test('recipe prompt binds one recipe, requires execute skill, no push, stop after', () => {
  const prompt = buildRecipePrompt({
    recipeId: 'BRD-004',
    recipePath: 'plans/architecture-refactor/specs/BRD-004.md',
    recipeStatus: 'Ready',
    groupId: 'board-slice',
    packetPath: 'scripts/agent-scratch/orchestration/board-slice/packets/BRD-004.md',
    startingHead: 'deadbeef',
  })
  assert.match(prompt, /BRD-004/)
  assert.match(prompt, /execute-architecture-spec/)
  assert.match(prompt, /Do not push/)
  assert.match(prompt, /Stop after this single recipe/)
  assert.doesNotMatch(prompt, /BRD-005/)
})

// --- no automatic integration ---

test('dispatcher modules never export merge/push/cherry-pick helpers', async () => {
  const dispatchSource = readFileSync(new URL('./dispatch.mjs', import.meta.url), 'utf8')
  // Forbid real git integration argv — prose may say "never cherry-picks".
  assert.doesNotMatch(dispatchSource, /['"]cherry-pick['"]/)
  assert.doesNotMatch(dispatchSource, /['"]push['"]/)
  assert.doesNotMatch(dispatchSource, /merge --ff-only/)
  assert.match(dispatchSource, /never merges/)
  // shell:true forbidden
  assert.doesNotMatch(dispatchSource, /shell:\s*true/)
  assert.match(dispatchSource, /shell:\s*false/)
})

// --- fresh process per recipe (mock spawn) ---

test('sequential run launches a new process per recipe and stops closed on mismatch', async () => {
  // Lightweight simulation of run loop postcondition gate without real git worktrees.
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
    // New process identity + advancing HEAD each launch
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
