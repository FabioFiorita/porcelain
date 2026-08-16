import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import {
  filesChangeSchema,
  filesContractFixtures,
  filesNotificationFixtures,
  filesProcedures,
} from '@porcelain/contracts/files'
import { describe, expect, it } from 'vitest'
import {
  contentPreviewEffects,
  dedupeFilesQueryEffects,
  FILES_FOREIGN_CONTENT_INDEX,
  FILES_FOREIGN_PATH_INDEX,
  FILES_FOREIGN_WORKING_TREE,
  filesContentSubtreeEffect,
  filesExactEffect,
  filesTreeFamilyEffect,
  treeSubtreeEffectsForStructuralPath,
} from './files-effects'
import {
  filesNotificationEffects,
  filesNotificationForeignDependencies,
} from './files-notifications'
import { filesPinsQuery, filesScopeQuery, filesTreeQuery } from './files-queries'

const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other-repo'

const filesCatalog = {
  procedures: {
    readFile: filesProcedures.readFile,
  },
  notification: filesChangeSchema,
  publicError: publicErrorSchema,
}

describe('filesNotificationEffects', () => {
  it('scope-changed maps to scope+pins+tree-family for the notification project only', () => {
    const notification = filesNotificationFixtures['files.scope-changed']
    expect(filesNotificationEffects(notification)).toEqual([
      filesExactEffect(filesScopeQuery(PROJECT)),
      filesExactEffect(filesPinsQuery(PROJECT)),
      filesTreeFamilyEffect(PROJECT),
    ])
    expect(filesNotificationEffects(notification)).not.toEqual(
      filesNotificationEffects({ ...notification, projectPath: OTHER }),
    )
  })

  it('tree-changed invalidates tree/content subtrees plus exact parents and pins', () => {
    const notification = filesNotificationFixtures['files.tree-changed']
    const effects = filesNotificationEffects(notification)
    expect(effects[0]).toEqual(filesExactEffect(filesPinsQuery(PROJECT)))
    // Shared parent/self paths across notification.paths are first-seen deduped.
    expect(effects).toEqual(
      dedupeFilesQueryEffects([
        filesExactEffect(filesPinsQuery(PROJECT)),
        ...treeSubtreeEffectsForStructuralPath(PROJECT, 'src'),
        filesContentSubtreeEffect(PROJECT, 'src'),
        ...treeSubtreeEffectsForStructuralPath(PROJECT, 'src/added.ts'),
        filesContentSubtreeEffect(PROJECT, 'src/added.ts'),
      ]),
    )
    expect(effects.some((e) => e.type === 'content-subtree')).toBe(true)
    expect(effects.some((e) => e.type === 'exact' && e.query.name === 'scope')).toBe(false)
    expect(
      effects.every((e) => (e.type === 'exact' ? e.query.projectPath : e.projectPath) === PROJECT),
    ).toBe(true)
  })

  it('tree-changed root marker invalidates exact root trees without subtree/content effects', () => {
    const notification = filesChangeSchema.parse({
      kind: 'files.tree-changed',
      projectPath: PROJECT,
      paths: ['.'],
    })
    expect(filesNotificationEffects(notification)).toEqual([
      filesExactEffect(filesPinsQuery(PROJECT)),
      filesExactEffect(filesTreeQuery(PROJECT, '.', false)),
      filesExactEffect(filesTreeQuery(PROJECT, '.', true)),
    ])
  })

  it('content-changed couples preview, skips ".", and never expands trees (create-missing stays content-only on wire)', () => {
    const base = filesNotificationFixtures['files.content-changed']
    const withRoot = filesChangeSchema.parse({
      ...base,
      paths: ['.', 'src/open-document.ts'],
    })
    const effects = filesNotificationEffects(withRoot)
    expect(effects).toEqual(contentPreviewEffects(PROJECT, 'src/open-document.ts'))
    expect(effects.some((e) => e.type === 'exact' && e.query.name === 'tree')).toBe(false)
    expect(effects.some((e) => e.type === 'tree-family')).toBe(false)
    expect(effects.some((e) => e.type === 'exact' && e.query.name === 'pins')).toBe(false)
  })
})

describe('filesNotificationForeignDependencies', () => {
  // Coarse notification foreign signals are broader than precise mutation foreign sets
  // (mutations know the exact op; notifications only carry kind + paths). content-changed
  // path-index recovery is Search-only and does not repair Files tree facts.
  it('scope-changed foreign is path-index only; tree/content foreign are working-tree+path-index+content-index (broader than mutation rows; path-index does not repair Files trees)', () => {
    expect(
      filesNotificationForeignDependencies(filesNotificationFixtures['files.scope-changed']),
    ).toEqual([FILES_FOREIGN_PATH_INDEX])

    const three = [
      FILES_FOREIGN_WORKING_TREE,
      FILES_FOREIGN_PATH_INDEX,
      FILES_FOREIGN_CONTENT_INDEX,
    ]
    expect(
      filesNotificationForeignDependencies(filesNotificationFixtures['files.tree-changed']),
    ).toEqual(three)
    expect(
      filesNotificationForeignDependencies(filesNotificationFixtures['files.content-changed']),
    ).toEqual(three)
  })
})

describe('files notification contract mock rejection', () => {
  it('rejects malformed notifications via createValidatingDaemonMock + filesChangeSchema', () => {
    const daemon = createValidatingDaemonMock(filesCatalog, {
      readFile: () => ({
        ok: true,
        value: filesContractFixtures.readFile.output,
      }),
    })

    const seen: unknown[] = []
    daemon.subscribe((notification) => {
      const parsed = filesChangeSchema.parse(notification)
      seen.push({
        effects: filesNotificationEffects(parsed),
        foreign: filesNotificationForeignDependencies(parsed),
      })
    })

    const valid = filesNotificationFixtures['files.content-changed']
    expect(daemon.emit(valid)).toEqual(valid)
    expect(seen).toHaveLength(1)

    expect(() => daemon.emit({ kind: 'files.tree-changed' })).toThrow()
    expect(() =>
      daemon.emit({ kind: 'files.scope-changed', projectPath: PROJECT, paths: ['x'] }),
    ).toThrow()
    expect(() =>
      daemon.emit({ kind: 'files.content-changed', projectPath: PROJECT, paths: [] }),
    ).toThrow()
    expect(seen).toHaveLength(1)
  })
})
