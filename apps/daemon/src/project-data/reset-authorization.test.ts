// @vitest-environment node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { porcelainHome } from '@shared/porcelain-home'
import { describe, expect, it } from 'vitest'
import { withTemporaryDirectory } from '../testing/temporary-directory'
import {
  classifyResetRecord,
  GRANTED_RESET_AUTHORIZATION,
  GRANTED_RESET_TARGETS,
  isForbiddenLiveRoot,
  parseResetAuthorization,
  type ResetRecordDisposition,
  type ResetTargetKind,
  type ResetTargetSpec,
} from './reset-authorization'

const EXPECTED_CLASSIFICATIONS: readonly {
  readonly root: ResetTargetKind
  readonly relativePath: string
  readonly disposition: ResetRecordDisposition
}[] = [
  { root: 'home', relativePath: 'access.json', disposition: 'material' },
  { root: 'home', relativePath: 'admin-token', disposition: 'material' },
  { root: 'home', relativePath: 'action-trust.json', disposition: 'material' },
  { root: 'home', relativePath: 'porcelain', disposition: 'disposable' },
  { root: 'home', relativePath: 'actions.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'board.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'layers.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'scope.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'notes.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'comments.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'reviewed.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'review-sets.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'feature-view.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'loop-evidence', disposition: 'disposable' },
  { root: 'userData', relativePath: 'config.json', disposition: 'material' },
  { root: 'userData', relativePath: 'projects-recents.json', disposition: 'material' },
  { root: 'repoCompanion', relativePath: 'board.json', disposition: 'material' },
  { root: 'repoCompanion', relativePath: 'actions.json', disposition: 'material' },
  { root: 'repoCompanion', relativePath: 'notes.md', disposition: 'material' },
  { root: 'repoCompanion', relativePath: 'layers.json', disposition: 'material' },
  { root: 'repoCompanion', relativePath: 'scope.json', disposition: 'material' },
  { root: 'repoCompanion', relativePath: '.gitignore', disposition: 'material' },
  { root: 'repoCompanion', relativePath: 'active-review', disposition: 'material' },
  { root: 'repoCompanion', relativePath: 'reviews', disposition: 'material' },
  { root: 'repoCompanion', relativePath: 'feature-view.json', disposition: 'disposable' },
  { root: 'repoCompanion', relativePath: 'project-manifest.json', disposition: 'disposable' },
  { root: 'repoCompanion', relativePath: '.migrated-from-home', disposition: 'disposable' },
]

const SYNTHETIC_HOME: ResetTargetSpec = {
  kind: 'home',
  pathTemplate: '/synthetic/home',
  includedByDefault: true,
  rootDisposition: 'mixed',
}

const SYNTHETIC_USER_DATA: ResetTargetSpec = {
  kind: 'userData',
  pathTemplate: '/synthetic/user-data',
  includedByDefault: true,
  rootDisposition: 'material',
}

function authorizationWith(overrides: Record<string, unknown>): Record<string, unknown> {
  return { ...GRANTED_RESET_AUTHORIZATION, ...overrides }
}

describe('parseResetAuthorization', () => {
  it('accepts GRANTED_RESET_AUTHORIZATION field-for-field', () => {
    expect(parseResetAuthorization(GRANTED_RESET_AUTHORIZATION)).toEqual({
      ok: true,
      value: GRANTED_RESET_AUTHORIZATION,
    })
  })

  it('refuses a relative pathTemplate', () => {
    expect(
      parseResetAuthorization(
        authorizationWith({
          targets: [{ ...GRANTED_RESET_TARGETS[0], pathTemplate: 'porcelain' }],
        }),
      ),
    ).toEqual({ ok: false, reason: 'relative-path' })
  })

  it('refuses duplicate kind or pathTemplate', () => {
    expect(
      parseResetAuthorization(
        authorizationWith({
          targets: [SYNTHETIC_HOME, { ...SYNTHETIC_USER_DATA, kind: 'home' }],
        }),
      ),
    ).toEqual({ ok: false, reason: 'duplicate-target' })

    expect(
      parseResetAuthorization(
        authorizationWith({
          targets: [
            SYNTHETIC_HOME,
            { ...SYNTHETIC_USER_DATA, pathTemplate: SYNTHETIC_HOME.pathTemplate },
          ],
        }),
      ),
    ).toEqual({ ok: false, reason: 'duplicate-target' })
  })

  it('refuses a target without rootDisposition', () => {
    const { rootDisposition: _rootDisposition, ...incomplete } = GRANTED_RESET_TARGETS[0]
    expect(
      parseResetAuthorization(
        authorizationWith({
          targets: [incomplete, GRANTED_RESET_TARGETS[1], GRANTED_RESET_TARGETS[2]],
        }),
      ),
    ).toEqual({ ok: false, reason: 'missing-classification' })
  })

  it('refuses approved false or omitted', () => {
    expect(parseResetAuthorization(authorizationWith({ approved: false }))).toEqual({
      ok: false,
      reason: 'absent-approval',
    })

    const { approved: _approved, ...omitted } = GRANTED_RESET_AUTHORIZATION
    expect(parseResetAuthorization(omitted)).toEqual({
      ok: false,
      reason: 'absent-approval',
    })
  })

  it('refuses exportMachinery true', () => {
    const input = authorizationWith({ exportMachinery: false })
    input.exportMachinery = true
    expect(parseResetAuthorization(input)).toEqual({
      ok: false,
      reason: 'export-machinery-present',
    })
  })

  it('refuses agentRunnable true or pnpmWired true', () => {
    expect(parseResetAuthorization(authorizationWith({ agentRunnable: true }))).toEqual({
      ok: false,
      reason: 'agent-runnable',
    })
    expect(parseResetAuthorization(authorizationWith({ pnpmWired: true }))).toEqual({
      ok: false,
      reason: 'agent-runnable',
    })
  })

  it('refuses a home kind paired with the userData template', () => {
    expect(
      parseResetAuthorization(
        authorizationWith({
          targets: [
            {
              kind: 'home',
              pathTemplate: '~/.local/share/porcelain',
              includedByDefault: true,
              rootDisposition: 'mixed',
            },
          ],
        }),
      ),
    ).toEqual({ ok: false, reason: 'unknown-target' })
  })

  it('refuses an extra key on the record', () => {
    expect(parseResetAuthorization(authorizationWith({ extra: true }))).toEqual({
      ok: false,
      reason: 'invalid-shape',
    })
  })
})

describe('classifyResetRecord', () => {
  it('matches every catalog row and returns null for unknown files', () => {
    for (const row of EXPECTED_CLASSIFICATIONS) {
      expect(classifyResetRecord({ root: row.root, relativePath: row.relativePath })).toBe(
        row.disposition,
      )
    }

    for (const root of ['home', 'userData', 'repoCompanion'] as const) {
      expect(classifyResetRecord({ root, relativePath: 'no-such-file' })).toBeNull()
    }
  })

  it('classifies files written under an isolated temporary tree', async () => {
    await withTemporaryDirectory('porcelain-pdt-004-', async (tempDir) => {
      for (const row of EXPECTED_CLASSIFICATIONS) {
        const filePath = join(tempDir, row.root, row.relativePath)
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, '')
        expect(classifyResetRecord({ root: row.root, relativePath: row.relativePath })).toBe(
          row.disposition,
        )
      }
      expect(isForbiddenLiveRoot(tempDir)).toBe(false)
    })
  })
})

describe('isForbiddenLiveRoot', () => {
  it('refuses porcelainHome, production userData, and relative paths', () => {
    expect(isForbiddenLiveRoot(porcelainHome())).toBe(true)
    expect(isForbiddenLiveRoot(join(homedir(), '.local/share/porcelain'))).toBe(true)
    expect(isForbiddenLiveRoot('relative')).toBe(true)
  })
})

describe('reset-authorization module source', () => {
  it('does not mutate the filesystem or import node:fs', async () => {
    const source = await readFile(
      fileURLToPath(new URL('./reset-authorization.ts', import.meta.url)),
      'utf8',
    )
    expect(source).not.toContain('rm(')
    expect(source).not.toContain('rmdir')
    expect(source).not.toContain('rmSync')
    expect(source).not.toContain('unlink')
    expect(source).not.toContain('unlinkSync')
    expect(source).not.toContain('node:fs')
    expect(source).not.toContain('node:fs/promises')
  })

  it('records no export machinery and is not agent-runnable', () => {
    expect(GRANTED_RESET_AUTHORIZATION.exportMachinery).toBe(false)
    expect(GRANTED_RESET_AUTHORIZATION.agentRunnable).toBe(false)
  })
})
