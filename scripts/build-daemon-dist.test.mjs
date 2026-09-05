import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'

test('daemon packaging uses daemon dependencies and excludes stale shell chunks', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-package-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const write = (name, value) => {
    const file = join(root, name)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, value)
  }
  write('scripts/porcelain-host.js', '// launcher')
  copyFileSync(
    resolve('scripts/build-daemon-dist.mjs'),
    join(root, 'scripts/build-daemon-dist.mjs'),
  )
  const daemon = JSON.parse(readFileSync(resolve('apps/daemon/package.json'), 'utf8'))
  write('apps/daemon/package.json', JSON.stringify(daemon))
  write(
    'apps/desktop/package.json',
    JSON.stringify({ version: '0.0.0', dependencies: { ws: 'wrong' } }),
  )
  for (const name of [
    'main/daemon/server.js',
    'main/contracts/protocol.js',
    'renderer/index.html',
    'main/chunks/stale.js',
  ]) {
    write(`apps/desktop/out/${name}`, '// fixture')
  }
  const run = () =>
    execFileSync(process.execPath, [join(root, 'scripts/build-daemon-dist.mjs')], {
      cwd: root,
      stdio: 'pipe',
    })
  run()
  const packaged = JSON.parse(readFileSync(join(root, 'dist-daemon/package.json'), 'utf8'))
  assert.equal(packaged.version, daemon.version)
  assert.equal(packaged.dependencies.ws, daemon.dependencies.ws)
  assert.ok(!existsSync(join(root, 'dist-daemon/main/chunks')))
  assert.ok(existsSync(join(root, 'dist-daemon/renderer/index.html')))
  assert.ok(existsSync(join(root, 'dist-daemon/bin/porcelain.js')))
  write('dist-daemon/keep-until-valid', 'previous package')
  rmSync(join(root, 'apps/desktop/out/renderer/index.html'))
  assert.throws(run)
  assert.ok(existsSync(join(root, 'dist-daemon/keep-until-valid')))
})
