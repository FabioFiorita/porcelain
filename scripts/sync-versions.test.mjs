import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

test('version synchronization updates packages without changing internal skills', () => {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-version-test-'))
  try {
    for (const dir of ['scripts', 'apps/daemon', 'apps/desktop', '.agents/skills/runtime'])
      mkdirSync(join(root, dir), { recursive: true })
    const script = join(root, 'scripts/sync-versions.mjs')
    copyFileSync(resolve('scripts/sync-versions.mjs'), script)
    for (const name of ['daemon', 'desktop'])
      writeFileSync(join(root, `apps/${name}/package.json`), JSON.stringify({ version: '1.0.0' }))
    const skill = join(root, '.agents/skills/runtime/SKILL.md')
    const text = '---\nname: runtime\ndescription: Runtime setup\n---\n'
    writeFileSync(skill, text)
    execFileSync(process.execPath, [script, '--set', '1.1.0'], { cwd: root })
    execFileSync(process.execPath, [script, '--check'], { cwd: root })
    assert.equal(JSON.parse(readFileSync(join(root, 'apps/desktop/package.json'))).version, '1.1.0')
    assert.equal(readFileSync(skill, 'utf8'), text)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
