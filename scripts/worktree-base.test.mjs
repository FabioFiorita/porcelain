#!/usr/bin/env node
/**
 * Pure and disposable-fixture tests for managed worktree behavior.
 * Never addresses a real Porcelain checkout or runtime home.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import {
  codexSlugForPath,
  DEFAULT_BASE,
  normalizeBaseRef,
  parseWorktreeConfig,
  planCreateGitArgs,
  planRemoveGuard,
} from './worktree.mjs'

const worktreeScript = resolve('scripts/worktree.mjs')

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

test('codexSlugForPath derives a stable valid slug from the harness allocation', () => {
  assert.equal(codexSlugForPath('/home/fabio/.codex/worktrees/1b28/porcelain'), 'codex-1b28')
  assert.equal(codexSlugForPath('/Users/fabio/.codex/worktrees/Task_42/porcelain'), 'codex-task-42')
})

test('normalizeBaseRef defaults path: main is accepted', () => {
  assert.equal(normalizeBaseRef('main'), 'main')
  assert.equal(normalizeBaseRef('  main  '), 'main')
})

test('normalizeBaseRef strips refs/heads/ and rejects unsafe values', () => {
  assert.equal(normalizeBaseRef('refs/heads/work/integration'), 'work/integration')
  const errors = []
  const onError = (message) => {
    errors.push(message)
    return undefined
  }
  assert.equal(normalizeBaseRef('', onError), undefined)
  assert.equal(normalizeBaseRef('-evil', onError), undefined)
  assert.equal(normalizeBaseRef('../x', onError), undefined)
  assert.equal(normalizeBaseRef('has space', onError), undefined)
  assert.equal(normalizeBaseRef('foo;rm', onError), undefined)
  assert.ok(errors.length >= 4)
})

test('parseWorktreeConfig: legacy profile without base defaults to main', () => {
  const parsed = parseWorktreeConfig({
    version: 1,
    slug: 'task-one',
    branch: 'work/task-one',
    port: 43200,
  })
  assert.equal(parsed.ok, true)
  assert.equal(parsed.config.base, DEFAULT_BASE)
  assert.equal(parsed.config.slug, 'task-one')
})

test('parseWorktreeConfig: explicit base is stored normalized', () => {
  const parsed = parseWorktreeConfig({
    version: 1,
    slug: 'arch-group',
    branch: 'work/arch-group',
    port: 43210,
    base: 'refs/heads/work/integration',
  })
  assert.equal(parsed.ok, true)
  assert.equal(parsed.config.base, 'work/integration')
})

test('parseWorktreeConfig: unknown fields do not break version-1 profiles', () => {
  const parsed = parseWorktreeConfig({
    version: 1,
    slug: 'task-two',
    branch: 'work/task-two',
    port: 43201,
    futureField: true,
  })
  assert.equal(parsed.ok, true)
  assert.equal(parsed.config.base, 'main')
})

test('parseWorktreeConfig: invalid base fails closed', () => {
  const parsed = parseWorktreeConfig({
    version: 1,
    slug: 'task-three',
    branch: 'work/task-three',
    port: 43202,
    base: '../etc/passwd',
  })
  assert.equal(parsed.ok, false)
})

test('planCreateGitArgs uses base (default main)', () => {
  assert.deepEqual(planCreateGitArgs({ branch: 'work/a', path: '/tmp/a' }), [
    'worktree',
    'add',
    '-b',
    'work/a',
    '/tmp/a',
    'main',
  ])
  assert.deepEqual(
    planCreateGitArgs({ branch: 'work/b', path: '/tmp/b', base: 'work/integration' }),
    ['worktree', 'add', '-b', 'work/b', '/tmp/b', 'work/integration'],
  )
})

test('planRemoveGuard: default-main merge safety without force', () => {
  assert.equal(
    planRemoveGuard({ force: false, dirtyLines: [], reachableFromBase: true }).allow,
    true,
  )
  const blocked = planRemoveGuard({
    force: false,
    dirtyLines: [],
    reachableFromBase: false,
    base: 'main',
  })
  assert.equal(blocked.allow, false)
  assert.match(blocked.reason, /main/)
})

test('planRemoveGuard: non-main base refusal message uses that base', () => {
  const blocked = planRemoveGuard({
    force: false,
    dirtyLines: [],
    reachableFromBase: false,
    base: 'work/integration',
  })
  assert.equal(blocked.allow, false)
  assert.match(blocked.reason, /work\/integration/)
})

test('planRemoveGuard: dirty blocks; force allows without reachability', () => {
  const dirty = planRemoveGuard({
    force: false,
    dirtyLines: [' M file.ts'],
    reachableFromBase: true,
  })
  assert.equal(dirty.allow, false)
  assert.equal(
    planRemoveGuard({ force: true, dirtyLines: [' M file.ts'], reachableFromBase: false }).allow,
    true,
  )
})

test('fixture config file round-trip defaults base for old profiles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'worktree-base-'))
  try {
    const path = join(dir, '.porcelain-worktree.json')
    writeFileSync(
      path,
      JSON.stringify({ version: 1, slug: 'fixture', branch: 'work/fixture', port: 43250 }),
    )
    const value = JSON.parse(readFileSync(path, 'utf8'))
    const parsed = parseWorktreeConfig(value)
    assert.equal(parsed.ok, true)
    assert.equal(parsed.config.base, 'main')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('Codex bootstrap and cleanup fall back to the harness checkout working directory', () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'porcelain-codex-hook-')))
  const primary = join(home, 'repo')
  const checkout = join(home, '.codex', 'worktrees', '7f73', 'porcelain')
  try {
    mkdirSync(primary, { recursive: true })
    git(primary, 'init', '-b', 'main')
    git(primary, 'config', 'user.name', 'Porcelain Test')
    git(primary, 'config', 'user.email', 'porcelain@example.test')
    writeFileSync(join(primary, 'README.md'), 'fixture\n')
    git(primary, 'add', 'README.md')
    git(primary, '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture')
    mkdirSync(dirname(checkout), { recursive: true })
    git(primary, 'worktree', 'add', '--detach', checkout, 'HEAD')

    const env = { ...process.env, HOME: home }
    execFileSync(process.execPath, [worktreeScript, 'codex-bootstrap'], {
      cwd: checkout,
      env,
      stdio: 'pipe',
    })

    const config = JSON.parse(readFileSync(join(checkout, '.porcelain-worktree.json'), 'utf8'))
    assert.deepEqual(config, {
      version: 1,
      slug: 'codex-7f73',
      branch: 'work/codex-7f73',
      port: 43200,
      base: 'main',
    })
    assert.equal(git(checkout, 'branch', '--show-current'), 'work/codex-7f73')
    assert.equal(existsSync(join(home, 'code', 'porcelain-playgrounds', 'codex-7f73')), true)

    execFileSync(process.execPath, [worktreeScript, 'codex-cleanup'], {
      cwd: checkout,
      env,
      stdio: 'pipe',
    })
    assert.equal(existsSync(checkout), false)
    assert.equal(git(primary, 'branch', '--list', 'work/codex-7f73'), '')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
