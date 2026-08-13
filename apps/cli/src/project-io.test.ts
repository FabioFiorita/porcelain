import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  PROJECT_COMPANION_LAYOUT,
  PROJECT_FILES,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureProjectDir, writeProjectJson } from './project-io'

let repo = ''

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'porcelain-cli-project-io-'))
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

const manifestPath = (): string => projectPorcelainPath(repo, PROJECT_FILES.manifest)

const writeManifestFile = (value: unknown): void => {
  mkdirSync(join(repo, '.porcelain'), { recursive: true })
  writeFileSync(manifestPath(), JSON.stringify(value, null, 2))
}

describe('companion root guard', () => {
  it('writes normally into a root with no manifest, and never creates one', () => {
    writeProjectJson(repo, PROJECT_FILES.board, { version: 1, cards: [] })
    expect(existsSync(projectPorcelainPath(repo, PROJECT_FILES.board))).toBe(true)
    expect(existsSync(projectPorcelainPath(repo, PROJECT_FILES.gitignore))).toBe(true)
    // Project Data is the only writer of the root marker; the next daemon write fills it in.
    expect(existsSync(manifestPath())).toBe(false)
  })

  it('writes normally into a valid v1 root', () => {
    writeManifestFile({ version: 1, value: { layout: PROJECT_COMPANION_LAYOUT } })
    expect(() => {
      writeProjectJson(repo, PROJECT_FILES.board, { version: 1, cards: [] })
    }).not.toThrow()
    expect(existsSync(projectPorcelainPath(repo, PROJECT_FILES.board))).toBe(true)
  })

  // A newer Porcelain laid this root out; converting it silently is how someone
  // loses data they cannot get back. Refuse the write and name the path.
  it('refuses every write into a root that declares another version', () => {
    writeManifestFile({ version: 99, value: { layout: PROJECT_COMPANION_LAYOUT } })
    const message = `${manifestPath()} declares an unsupported companion layout — upgrade Porcelain (this CLI writes version 1 ${PROJECT_COMPANION_LAYOUT})`

    expect(() => ensureProjectDir(repo)).toThrow(message)
    expect(() => {
      writeProjectJson(repo, PROJECT_FILES.board, { version: 1, cards: [] })
    }).toThrow(message)
    expect(existsSync(projectPorcelainPath(repo, PROJECT_FILES.board))).toBe(false)
  })

  it('refuses a root that declares another layout', () => {
    writeManifestFile({ version: 1, value: { layout: 'project-companion-v2' } })
    expect(() => ensureProjectDir(repo)).toThrow(/unsupported companion layout/)
  })

  // Unreadable is not incompatible: the daemon owns repair, and a CLI that
  // refused here would strand an agent behind a file it may not touch.
  it('treats an unparseable manifest as no manifest', () => {
    mkdirSync(join(repo, '.porcelain'), { recursive: true })
    writeFileSync(manifestPath(), '{ not json')
    expect(() => ensureProjectDir(repo)).not.toThrow()
  })
})
