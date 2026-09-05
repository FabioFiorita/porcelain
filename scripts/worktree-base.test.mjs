#!/usr/bin/env node
/**
 * Pure and disposable-fixture tests for managed worktree behavior.
 * Never addresses a real Porcelain checkout or runtime home.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { rm } from 'node:fs/promises'
import { hostname, tmpdir } from 'node:os'
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
const codexEnvironment = readFileSync(resolve('.codex/environments/environment.toml'), 'utf8')

function environmentCommand(section) {
  const match = codexEnvironment.match(
    new RegExp(`^\\[${section}\\]\\r?\\nscript = '''\\r?\\n([^\\r\\n]+)`, 'm'),
  )
  assert.ok(match, `missing ${section} command in Codex environment`)
  return match[1]
}

function runEnvironmentCommand(section, cwd, env) {
  const command = environmentCommand(section)
  const match = command.match(/^node scripts\/worktree\.mjs (codex-(?:bootstrap|cleanup))$/)
  assert.ok(match, `unexpected ${section} command in Codex environment: ${command}`)
  execFileSync(process.execPath, ['scripts/worktree.mjs', match[1]], {
    cwd,
    env,
    stdio: 'pipe',
  })
}

function fixtureEnv(home) {
  // os.homedir() uses USERPROFILE on Windows rather than HOME. Set both so a
  // fixture can never allocate a managed profile under the developer's account.
  return { ...process.env, HOME: home, USERPROFILE: home }
}

async function removeFixture(path) {
  await rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function run(command, args, options) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, options)
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', rejectRun)
    child.on('exit', (code) => {
      if (code === 0) resolveRun()
      else rejectRun(new Error(`${command} ${args.join(' ')} exited ${code}: ${stderr}`))
    })
  })
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

test('parseWorktreeConfig: a detached runtime profile does not require a branch', () => {
  const parsed = parseWorktreeConfig({
    version: 1,
    slug: 'codex-ab12',
    branch: null,
    port: 43211,
    base: 'main',
  })
  assert.equal(parsed.ok, true)
  assert.equal(parsed.config.branch, null)
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

for (const useEnvironmentPath of [false, true])
  test(`selected Codex environment uses ${useEnvironmentPath ? 'CODEX_WORKTREE_PATH' : 'the working directory'} for setup and cleanup`, async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'porcelain-codex-hook-')))
    const primary = join(home, 'repo')
    const checkout = join(home, '.codex', 'worktrees', '7f73', 'porcelain with spaces')
    try {
      mkdirSync(primary, { recursive: true })
      git(primary, 'init', '-b', 'main')
      git(primary, 'config', 'user.name', 'Porcelain Test')
      git(primary, 'config', 'user.email', 'porcelain@example.test')
      writeFileSync(join(primary, 'README.md'), 'fixture\n')
      mkdirSync(join(primary, 'scripts'))
      copyFileSync(worktreeScript, join(primary, 'scripts', 'worktree.mjs'))
      git(primary, 'add', 'README.md', 'scripts/worktree.mjs')
      git(primary, '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture')
      mkdirSync(dirname(checkout), { recursive: true })
      git(primary, 'worktree', 'add', '--detach', checkout, 'HEAD')
      const originalHead = git(checkout, 'rev-parse', 'HEAD')

      const env = fixtureEnv(home)
      if (useEnvironmentPath) env.CODEX_WORKTREE_PATH = checkout
      else delete env.CODEX_WORKTREE_PATH
      const commandCwd = useEnvironmentPath ? primary : checkout
      runEnvironmentCommand('setup', commandCwd, env)

      const config = JSON.parse(readFileSync(join(checkout, '.porcelain-worktree.json'), 'utf8'))
      assert.deepEqual(config, {
        version: 1,
        slug: 'codex-7f73',
        branch: null,
        port: 43200,
        base: 'main',
      })
      assert.equal(git(checkout, 'branch', '--show-current'), '')
      assert.equal(git(checkout, 'rev-parse', 'HEAD'), originalHead)
      assert.equal(git(primary, 'branch', '--list', 'work/codex-7f73'), '')
      assert.equal(existsSync(join(home, 'code', 'porcelain-playgrounds', 'codex-7f73')), true)

      git(checkout, 'switch', '-c', 'codex/preserved-work')
      writeFileSync(join(checkout, 'README.md'), 'local commit\n')
      git(checkout, 'add', 'README.md')
      git(checkout, '-c', 'commit.gpgsign=false', 'commit', '-m', 'local work')
      const localHead = git(checkout, 'rev-parse', 'HEAD')
      writeFileSync(join(checkout, 'README.md'), 'uncommitted work\n')
      writeFileSync(join(checkout, 'untracked.txt'), 'new work\n')
      runEnvironmentCommand('cleanup', commandCwd, env)
      assert.equal(git(checkout, 'rev-parse', 'HEAD'), localHead)
      assert.equal(git(checkout, 'branch', '--show-current'), 'codex/preserved-work')
      assert.equal(readFileSync(join(checkout, 'README.md'), 'utf8'), 'uncommitted work\n')
      assert.equal(readFileSync(join(checkout, 'untracked.txt'), 'utf8'), 'new work\n')
      assert.equal(existsSync(join(checkout, '.porcelain-worktree.json')), false)
      assert.equal(existsSync(join(home, '.porcelain-dev-worktrees', 'codex-7f73')), false)
      assert.equal(existsSync(join(home, 'code', 'porcelain-playgrounds', 'codex-7f73')), false)
      runEnvironmentCommand('cleanup', commandCwd, env)
    } finally {
      await removeFixture(home)
    }
  })

test('simultaneous Codex bootstraps reserve distinct disposable profiles', async () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'porcelain-codex-race-')))
  const primary = join(home, 'repo')
  const checkouts = Array.from({ length: 8 }, (_, index) =>
    join(home, '.codex', 'worktrees', `race-${index}`, 'porcelain'),
  )
  try {
    mkdirSync(primary, { recursive: true })
    git(primary, 'init', '-b', 'main')
    git(primary, 'config', 'user.name', 'Porcelain Test')
    git(primary, 'config', 'user.email', 'porcelain@example.test')
    writeFileSync(join(primary, 'README.md'), 'fixture\n')
    mkdirSync(join(primary, 'scripts'))
    copyFileSync(worktreeScript, join(primary, 'scripts', 'worktree.mjs'))
    git(primary, 'add', 'README.md', 'scripts/worktree.mjs')
    git(primary, '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture')
    for (const checkout of checkouts) {
      mkdirSync(dirname(checkout), { recursive: true })
      git(primary, 'worktree', 'add', '--detach', checkout, 'HEAD')
    }

    const env = fixtureEnv(home)
    await Promise.all(
      checkouts.map((checkout) =>
        run('node', ['scripts/worktree.mjs', 'codex-bootstrap', checkout], {
          cwd: checkout,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      ),
    )

    const initialPorts = checkouts.map(
      (checkout) =>
        JSON.parse(readFileSync(join(checkout, '.porcelain-worktree.json'), 'utf8')).port,
    )

    // Repeat one setup concurrently with the fleet: it must observe the already
    // published profile rather than reallocate its checkout's port or fixture.
    await Promise.all(
      checkouts.map((checkout) =>
        run('node', ['scripts/worktree.mjs', 'codex-bootstrap', checkout], {
          cwd: checkout,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      ),
    )

    const configs = checkouts.map((checkout) =>
      JSON.parse(readFileSync(join(checkout, '.porcelain-worktree.json'), 'utf8')),
    )
    assert.equal(new Set(configs.map((config) => config.port)).size, checkouts.length)
    assert.deepEqual(
      configs.map((config) => config.port),
      initialPorts,
      "a repeated setup must retain every checkout's first allocated port",
    )
    assert.equal(new Set(configs.map((config) => config.slug)).size, checkouts.length)
    assert.ok(configs.every((config) => config.branch === null))
    assert.ok(
      configs.every((config) =>
        existsSync(join(home, 'code', 'porcelain-playgrounds', config.slug)),
      ),
    )

    for (const checkout of checkouts) {
      execFileSync('node', ['scripts/worktree.mjs', 'codex-cleanup', checkout], {
        cwd: checkout,
        env,
        stdio: 'pipe',
      })
    }
    assert.ok(checkouts.every((checkout) => existsSync(checkout)))
    assert.ok(
      checkouts.every((checkout) => !existsSync(join(checkout, '.porcelain-worktree.json'))),
    )
  } finally {
    await removeFixture(home)
  }
})

test('Codex bootstrap preserves Git state and launchers resolve isolated profiles', async () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'porcelain-codex-profile-')))
  const primary = join(home, 'repo')
  const checkouts = ['contracts', 'consumers'].map((slug) =>
    join(home, '.codex', 'worktrees', slug, 'porcelain'),
  )
  try {
    mkdirSync(primary, { recursive: true })
    git(primary, 'init', '-b', 'main')
    git(primary, 'config', 'user.name', 'Porcelain Test')
    git(primary, 'config', 'user.email', 'porcelain@example.test')
    writeFileSync(join(primary, 'README.md'), 'committed fixture\n')
    mkdirSync(join(primary, 'scripts'))
    for (const script of ['worktree.mjs', 'dev-env.mjs']) {
      copyFileSync(resolve('scripts', script), join(primary, 'scripts', script))
    }
    git(primary, 'add', '.')
    git(primary, '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture')
    const originalHead = git(primary, 'rev-parse', 'HEAD')
    for (const checkout of checkouts) {
      mkdirSync(dirname(checkout), { recursive: true })
      git(primary, 'worktree', 'add', '--detach', checkout, 'HEAD')
    }
    git(checkouts[1], 'switch', '-c', 'codex/consumer-fixture')
    writeFileSync(join(primary, 'README.md'), 'unrelated primary edits\n')
    const primaryStatus = git(primary, 'status', '--porcelain')
    const env = fixtureEnv(home)
    for (const checkout of checkouts) runEnvironmentCommand('setup', checkout, env)

    // Read the same environment module used by launchers from each checkout.
    // Return only routing fields, never the generated administrator credential.
    const probe = `
      import { resolveDevProfile, devEnv, DEV_WEB_PORT, DEV_METRO_PORT } from './scripts/dev-env.mjs';
      const env = devEnv();
      console.log(JSON.stringify({
        profile: resolveDevProfile(),
        home: env.PORCELAIN_HOME,
        userData: env.PORCELAIN_USER_DATA,
        playground: env.PORCELAIN_DEV_PLAYGROUND,
        daemonPort: Number(env.PORCELAIN_DAEMON_PORT),
        dev: env.PORCELAIN_DEV,
        webPort: DEV_WEB_PORT,
        metroPort: DEV_METRO_PORT,
      }));
    `
    const profiles = [primary, ...checkouts].map((cwd) =>
      JSON.parse(
        execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
          cwd,
          env,
          encoding: 'utf8',
        }),
      ),
    )
    for (const field of ['home', 'userData', 'playground', 'daemonPort', 'webPort', 'metroPort']) {
      assert.equal(new Set(profiles.map((profile) => profile[field])).size, profiles.length, field)
    }
    for (const profile of profiles) {
      assert.equal(profile.dev, '1')
      assert.equal(profile.home, profile.profile.home)
      assert.equal(profile.userData, profile.profile.userData)
      assert.equal(profile.playground, profile.profile.playground)
      assert.equal(profile.daemonPort, profile.profile.port)
      assert.notEqual(profile.home, join(home, '.porcelain'))
      assert.notEqual(profile.daemonPort, 43117)
    }
    assert.equal(git(primary, 'status', '--porcelain'), primaryStatus)
    assert.equal(readFileSync(join(primary, 'README.md'), 'utf8'), 'unrelated primary edits\n')
    assert.equal(git(primary, 'branch', '--show-current'), 'main')
    assert.equal(git(checkouts[0], 'branch', '--show-current'), '')
    assert.equal(git(checkouts[1], 'branch', '--show-current'), 'codex/consumer-fixture')
    for (const cwd of [primary, ...checkouts]) {
      assert.equal(git(cwd, 'rev-parse', 'HEAD'), originalHead)
    }
  } finally {
    await removeFixture(home)
  }
})

test('Codex bootstrap reclaims a lock left by a dead local owner', async () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'porcelain-codex-stale-lock-')))
  const primary = join(home, 'repo')
  const checkouts = ['dead-lock-a', 'dead-lock-b'].map((slug) =>
    join(home, '.codex', 'worktrees', slug, 'porcelain'),
  )
  try {
    mkdirSync(primary, { recursive: true })
    git(primary, 'init', '-b', 'main')
    git(primary, 'config', 'user.name', 'Porcelain Test')
    git(primary, 'config', 'user.email', 'porcelain@example.test')
    writeFileSync(join(primary, 'README.md'), 'fixture\n')
    mkdirSync(join(primary, 'scripts'))
    copyFileSync(worktreeScript, join(primary, 'scripts', 'worktree.mjs'))
    git(primary, 'add', 'README.md', 'scripts/worktree.mjs')
    git(primary, '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture')
    for (const checkout of checkouts) {
      mkdirSync(dirname(checkout), { recursive: true })
      git(primary, 'worktree', 'add', '--detach', checkout, 'HEAD')
    }
    const lock = join(
      primary,
      git(primary, 'rev-parse', '--git-common-dir'),
      'porcelain-managed-worktree-allocation.lock',
    )
    mkdirSync(lock)
    writeFileSync(
      join(lock, 'owner.json'),
      JSON.stringify({ pid: 999_999_999, hostname: hostname(), createdAt: Date.now() }),
    )
    // A reclaimer can crash after rename. Its uniquely named tombstone must not
    // prevent a later allocator from claiming the canonical lock.
    mkdirSync(`${lock}.reclaim-orphan`)

    const env = fixtureEnv(home)
    await Promise.all(
      checkouts.map((checkout) =>
        run('node', ['scripts/worktree.mjs', 'codex-bootstrap', checkout], {
          cwd: checkout,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      ),
    )
    const ports = checkouts.map(
      (checkout) =>
        JSON.parse(readFileSync(join(checkout, '.porcelain-worktree.json'), 'utf8')).port,
    )
    assert.equal(new Set(ports).size, checkouts.length)
    assert.equal(existsSync(lock), false)
    assert.equal(existsSync(`${lock}.reclaim-orphan`), true)
  } finally {
    await removeFixture(home)
  }
})
