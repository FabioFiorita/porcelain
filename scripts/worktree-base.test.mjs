#!/usr/bin/env node
/**
 * Pure and disposable-fixture tests for managed worktree behavior.
 * Never addresses a real Porcelain checkout or runtime home.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { windowsProcessIdentity } from './windows-process.mjs'
import { codexSlugForPath, parseWorktreeConfig, withAllocationLock } from './worktree.mjs'

const worktreeScript = resolve('scripts/worktree.mjs')

test('allocation is released by the OS when its owner crashes', async () => {
  const home = realpathSync.native(mkdtempSync(join(tmpdir(), 'porcelain-lock-crash-')))
  let child
  try {
    git(home, 'init', '-b', 'main')
    const code = `
      const { withAllocationLock } = await import(${JSON.stringify(pathToFileURL(worktreeScript).href)});
      await withAllocationLock(process.argv[1], () => {
        process.stdout.write('locked');
        return new Promise(() => {});
      });
    `
    child = spawn(process.execPath, ['--input-type=module', '-e', code, home], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await Promise.race([
      once(child.stdout, 'data'),
      once(child, 'exit').then(() => {
        throw new Error('Lock owner exited before acquisition')
      }),
    ])
    const exited = once(child, 'exit')
    child.kill('SIGKILL')
    await exited
    let acquired = false
    await withAllocationLock(home, () => {
      acquired = true
    })
    assert.equal(acquired, true)
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await removeFixture(home)
  }
})

test('profiles validate runtime allocations and ignore Git policy fields', () => {
  assert.deepEqual(
    parseWorktreeConfig({
      version: 1,
      slug: 'task-one',
      port: 43200,
      branch: 'any/branch',
      base: '../unused',
    }),
    {
      ok: true,
      config: { version: 1, slug: 'task-one', port: 43200 },
    },
  )
  for (const invalid of [
    { slug: '../escape', port: 43200 },
    { slug: 'task-one', port: 43117 },
  ]) {
    assert.equal(parseWorktreeConfig({ version: 1, ...invalid }).ok, false)
  }
})
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

for (const useEnvironmentPath of [false, true])
  test(`selected Codex environment uses ${useEnvironmentPath ? 'CODEX_WORKTREE_PATH' : 'the working directory'} for setup and cleanup`, async () => {
    const home = realpathSync.native(mkdtempSync(join(tmpdir(), 'porcelain-codex-hook-')))
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
      copyFileSync(
        resolve('scripts/windows-process.mjs'),
        join(primary, 'scripts/windows-process.mjs'),
      )
      git(primary, 'add', 'README.md', 'scripts/worktree.mjs', 'scripts/windows-process.mjs')
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
        port: 43200,
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

test('plain Git checkout setup and cleanup preserve both checkouts and their files', async () => {
  const home = realpathSync.native(mkdtempSync(join(tmpdir(), 'porcelain-git-profile-')))
  const primary = join(home, 'repo')
  const checkout = join(home, 'feature checkout')
  let launcher
  let unrelated
  try {
    mkdirSync(join(primary, 'scripts'), { recursive: true })
    copyFileSync(worktreeScript, join(primary, 'scripts/worktree.mjs'))
    copyFileSync(
      resolve('scripts/windows-process.mjs'),
      join(primary, 'scripts/windows-process.mjs'),
    )
    git(primary, 'init', '-b', 'main')
    git(primary, 'config', 'user.name', 'Porcelain Test')
    git(primary, 'config', 'user.email', 'porcelain@example.test')
    git(primary, 'add', '.')
    git(primary, '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture')
    git(primary, 'worktree', 'add', '-b', 'feature', checkout)
    const env = fixtureEnv(home)
    const command = (verb) =>
      run('node', ['scripts/worktree.mjs', verb, checkout], {
        cwd: primary,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    await command('setup')
    const config = readFileSync(join(checkout, '.porcelain-worktree.json'), 'utf8')
    await command('setup')
    assert.equal(readFileSync(join(checkout, '.porcelain-worktree.json'), 'utf8'), config)
    writeFileSync(join(checkout, 'unfinished.txt'), 'keep my work')
    if (process.platform === 'win32') {
      const daemon = join(checkout, 'scripts/dev-daemon.mjs')
      writeFileSync(
        daemon,
        `import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)']);
process.send({child: child.pid}); setInterval(()=>{},1000);`,
      )
      launcher = spawn(process.execPath, [daemon], {
        cwd: checkout,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      })
      const [ready] = await once(launcher, 'message')
      unrelated = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' })
      const runtime = join(home, '.porcelain-dev-worktrees', JSON.parse(config).slug)
      mkdirSync(runtime, { recursive: true })
      const record = join(runtime, 'dev-daemon.json')
      const identity = windowsProcessIdentity(launcher.pid)
      writeFileSync(
        record,
        JSON.stringify({ pid: launcher.pid, worktreeRoot: checkout, started: 'wrong' }),
      )
      await assert.rejects(command('cleanup'))
      assert.doesNotThrow(() => process.kill(launcher.pid, 0))
      assert.equal(existsSync(record), true)
      writeFileSync(
        record,
        JSON.stringify({ pid: launcher.pid, worktreeRoot: checkout, started: identity.started }),
      )
      await command('cleanup')
      assert.throws(() => process.kill(ready.child, 0))
      assert.throws(() => process.kill(launcher.pid, 0))
      assert.doesNotThrow(() => process.kill(unrelated.pid, 0))
    }
    await command('cleanup')
    assert.equal(readFileSync(join(checkout, 'unfinished.txt'), 'utf8'), 'keep my work')
    assert.equal(git(checkout, 'branch', '--show-current'), 'feature')
    assert.equal(existsSync(join(primary, 'scripts/worktree.mjs')), true)
    assert.equal(existsSync(join(checkout, '.porcelain-worktree.json')), false)
    assert.equal(
      existsSync(join(home, 'code/porcelain-playgrounds', JSON.parse(config).slug)),
      false,
    )
  } finally {
    for (const child of [launcher, unrelated]) {
      if (!child?.pid) continue
      try {
        execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        })
      } catch {}
    }
    await removeFixture(home)
  }
})

test('simultaneous Codex bootstraps reserve distinct disposable profiles', async () => {
  const home = realpathSync.native(mkdtempSync(join(tmpdir(), 'porcelain-codex-race-')))
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
    copyFileSync(
      resolve('scripts/windows-process.mjs'),
      join(primary, 'scripts/windows-process.mjs'),
    )
    git(primary, 'add', 'README.md', 'scripts/worktree.mjs', 'scripts/windows-process.mjs')
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
    assert.ok(configs.every((config) => !('branch' in config)))
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
  const home = realpathSync.native(mkdtempSync(join(tmpdir(), 'porcelain-codex-profile-')))
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
    for (const script of ['worktree.mjs', 'windows-process.mjs', 'dev-env.mjs']) {
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
