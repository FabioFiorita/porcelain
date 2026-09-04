import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const script = path.join(root, 'scripts', 'windows-signing-mode.mjs')
const ownedDirs = []

afterEach(() => {
  for (const dir of ownedDirs.splice(0)) rmSync(dir, { force: true, recursive: true })
})

function selectMode({ link = '', password = '' } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'porcelain-windows-signing-'))
  ownedDirs.push(dir)
  const output = path.join(dir, 'github-output.txt')
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      CSC_LINK: link,
      CSC_KEY_PASSWORD: password,
      GITHUB_OUTPUT: output,
    },
  })
  return {
    ...result,
    output: result.status === 0 ? readFileSync(output, 'utf8') : '',
  }
}

test('selects the explicitly unsigned release when neither credential exists', () => {
  const result = selectMode()
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.output, 'enabled=false\n')
  assert.match(result.stderr, /publishing an unsigned installer/)
})

test('selects Authenticode signing only when both credentials exist', () => {
  const result = selectMode({ link: 'certificate', password: 'password' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.output, 'enabled=true\n')
  assert.match(result.stdout, /will be Authenticode signed/)
})

test('rejects either form of partial Windows signing configuration', () => {
  for (const credentials of [
    { link: 'certificate', password: '' },
    { link: '', password: 'password' },
  ]) {
    const result = selectMode(credentials)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Configure both WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD/)
  }
})
