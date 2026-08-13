// @vitest-environment node
import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import {
  sessionContractFixtures,
  sessionMismatchFrameSchema,
  sessionReadyFrameSchema,
} from '@porcelain/contracts/session'
import { describe, expect, it } from 'vitest'
import {
  createProjectDataStore,
  PROJECT_MANIFEST_LAYOUT,
  projectManifestPath,
} from '../features/project-data'
import { createProjectsRecentsStore } from '../features/projects'
import { PERSISTED_FORMAT_VERSION } from '../project-data/strict-json-document'
import { decideSessionHandshake } from '../session/session-handshake'
import { withTemporaryDirectory } from './temporary-directory'

type CleanV1Fixture = {
  readonly root: string
  readonly home: string
  readonly userData: string
  readonly project: string
}

async function createCleanV1Fixture(root: string): Promise<CleanV1Fixture> {
  const home = join(root, 'home')
  const userData = join(root, 'user-data')
  const project = join(root, 'repo')
  await mkdir(home)
  await mkdir(userData)
  await mkdir(project)

  const projectRoot = await createProjectDataStore().ensureRoot(project)
  if (!projectRoot.ok) throw new Error(`fixture manifest failed: ${projectRoot.error.code}`)

  const recents = createProjectsRecentsStore({
    path: join(userData, 'projects-recents.json'),
  })
  const recentProject = await recents.addPath(project)
  if (!recentProject.ok) throw new Error('fixture projects-recents seed failed')

  return Object.freeze({ root, home, userData, project })
}

function isDirectChild(root: string, child: string): boolean {
  const path = relative(root, child)
  return path !== '' && !isAbsolute(path) && !path.startsWith(`..${sep}`)
}

describe('LCH-001 clean-v1 launch fixture', () => {
  it('seeds isolated home, userData, and project roots with current v1 formats', async () => {
    await withTemporaryDirectory('porcelain-lch-001-', async (root) => {
      const fixture = await createCleanV1Fixture(root)

      expect(
        [fixture.home, fixture.userData, fixture.project].every((path) =>
          isDirectChild(root, path),
        ),
      ).toBe(true)
      expect([root, fixture.home, fixture.userData, fixture.project].every(isAbsolute)).toBe(true)

      // Clean launch has no home records to migrate or interpret.
      expect(await readdir(fixture.home)).toEqual([])

      const recentsPath = join(fixture.userData, 'projects-recents.json')
      expect(JSON.parse(await readFile(recentsPath, 'utf8'))).toEqual({
        version: PERSISTED_FORMAT_VERSION,
        value: { paths: [fixture.project] },
      })

      const manifestPath = projectManifestPath(fixture.project)
      expect(JSON.parse(await readFile(manifestPath, 'utf8'))).toEqual({
        version: PERSISTED_FORMAT_VERSION,
        value: { layout: PROJECT_MANIFEST_LAYOUT },
      })
      expect(await readdir(join(fixture.project, '.porcelain'))).toEqual(
        expect.arrayContaining(['.gitignore', 'project-manifest.json']),
      )
      await expect(
        stat(join(fixture.project, '.porcelain', 'active-review')),
      ).rejects.toMatchObject({
        code: 'ENOENT',
      })
    })
  })

  it('rehearses matching ready and terminal update-required handshake decisions', () => {
    const epoch = 'lch-001-fixture-epoch'
    const matching = decideSessionHandshake({
      frame: sessionContractFixtures.hello,
      daemonProtocolVersion: PROTOCOL_VERSION,
      epoch,
    })

    expect(matching).toEqual({
      outcome: 'ready',
      frame: { ...sessionContractFixtures.ready, epoch },
    })
    expect(sessionReadyFrameSchema.parse(matching.frame)).toEqual(matching.frame)

    const mismatched = decideSessionHandshake({
      frame: { ...sessionContractFixtures.hello, protocolVersion: PROTOCOL_VERSION + 1 },
      daemonProtocolVersion: PROTOCOL_VERSION,
      epoch,
    })

    expect(mismatched).toEqual({
      outcome: 'mismatch',
      frame: {
        ...sessionContractFixtures.mismatch,
        expected: PROTOCOL_VERSION,
        received: PROTOCOL_VERSION + 1,
      },
    })
    expect(sessionMismatchFrameSchema.parse(mismatched.frame)).toEqual(mismatched.frame)
    expect(mismatched.frame.t).not.toBe('session:ready')
    expect(mismatched.frame.code).toBe('protocol.update-required')
  })
})
