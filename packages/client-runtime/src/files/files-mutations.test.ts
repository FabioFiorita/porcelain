import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import { filesContractFixtures, filesProcedures } from '@porcelain/contracts/files'
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
  filesTreeSubtreeEffect,
  treeEffectsForStructuralPath,
  treeSubtreeEffectsForStructuralPath,
} from './files-effects'
import { filesMutations } from './files-mutations'
import { filesPinsQuery, filesProfileQuery, filesScopeQuery } from './files-queries'

const fixtures = filesContractFixtures

const filesProcedureCatalog = {
  procedures: filesProcedures,
  notification: { parse: (value: unknown) => value },
  publicError: publicErrorSchema,
}

function scopeEffects(repoPath: string) {
  return [
    filesExactEffect(filesScopeQuery(repoPath)),
    // Settings → Personalization reads the two levels apart, so a hide from the
    // tree has to refresh it too — otherwise the tab shows what you just changed.
    filesExactEffect(filesProfileQuery(repoPath)),
    filesExactEffect(filesPinsQuery(repoPath)),
    filesTreeFamilyEffect(repoPath),
  ]
}

describe('filesMutations procedure bindings', () => {
  it('binds each definition to the exact filesProcedures object and name', () => {
    const cases = [
      ['hide', 'hidePath', filesProcedures.hidePath],
      ['unhide', 'unhidePath', filesProcedures.unhidePath],
      ['pin', 'pinPath', filesProcedures.pinPath],
      ['unpin', 'unpinPath', filesProcedures.unpinPath],
      ['writeText', 'writeTextFile', filesProcedures.writeTextFile],
      ['createFile', 'createFile', filesProcedures.createFile],
      ['createFolder', 'createFolder', filesProcedures.createFolder],
      ['rename', 'renamePath', filesProcedures.renamePath],
      ['duplicate', 'duplicatePath', filesProcedures.duplicatePath],
      ['trash', 'trashPath', filesProcedures.trashPath],
    ] as const

    for (const [key, name, procedure] of cases) {
      const definition = filesMutations[key]
      expect(definition.procedure).toBe(procedure)
      expect(definition.procedureName).toBe(name)
      expect(definition.requiresAuthoritativeRefetch).toBe(true)
      expect(Object.hasOwn(definition, 'optimistic')).toBe(false)
    }
  })
})

describe('filesMutations affectedEffects tables', () => {
  it('hide/unhide/pin/unpin use scope+pins+tree-family without root exact trees', () => {
    const cases = [
      { key: 'hide' as const, input: fixtures.hidePath.input },
      { key: 'unhide' as const, input: fixtures.unhidePath.input },
      { key: 'pin' as const, input: fixtures.pinPath.input },
      { key: 'unpin' as const, input: fixtures.unpinPath.input },
    ]
    for (const { key, input } of cases) {
      const effects = filesMutations[key].affectedEffects(input)
      expect(effects).toEqual(scopeEffects(input.repoPath))
      expect(effects.some((e) => e.type === 'exact' && e.query.name === 'tree')).toBe(false)
      expect(effects.some((e) => e.type === 'tree-family')).toBe(true)
    }
  })

  it('writeText includes structural trees plus content and preview', () => {
    const input = fixtures.writeTextFile.input
    expect(filesMutations.writeText.affectedEffects(input)).toEqual([
      ...treeEffectsForStructuralPath(input.projectPath, input.path),
      ...contentPreviewEffects(input.projectPath, input.path),
    ])
  })

  it('createFile includes structural trees, pins, content, and preview', () => {
    const input = fixtures.createFile.input
    const effects = filesMutations.createFile.affectedEffects(input)
    expect(effects).toEqual([
      ...treeEffectsForStructuralPath(input.projectPath, input.path),
      filesExactEffect(filesPinsQuery(input.projectPath)),
      ...contentPreviewEffects(input.projectPath, input.path),
    ])
  })

  it('createFolder includes structural trees and pins without content or preview', () => {
    const input = fixtures.createFolder.input
    const effects = filesMutations.createFolder.affectedEffects(input)
    expect(effects).toEqual([
      ...treeEffectsForStructuralPath(input.projectPath, input.path),
      filesExactEffect(filesPinsQuery(input.projectPath)),
    ])
    expect(effects.some((e) => e.type === 'exact' && e.query.name === 'content')).toBe(false)
    expect(effects.some((e) => e.type === 'exact' && e.query.name === 'preview')).toBe(false)
  })

  it('rename invalidates descendant trees and content for from and to plus pins', () => {
    const input = fixtures.renamePath.input
    expect(filesMutations.rename.affectedEffects(input)).toEqual(
      dedupeFilesQueryEffects([
        ...treeSubtreeEffectsForStructuralPath(input.projectPath, input.from),
        ...treeSubtreeEffectsForStructuralPath(input.projectPath, input.to),
        filesExactEffect(filesPinsQuery(input.projectPath)),
        filesContentSubtreeEffect(input.projectPath, input.from),
        filesContentSubtreeEffect(input.projectPath, input.to),
      ]),
    )
  })

  it('duplicate base omits destination; result adds destination tree/content subtrees', () => {
    const input = fixtures.duplicatePath.input
    const output = fixtures.duplicatePath.output
    const base = filesMutations.duplicate.affectedEffects(input)
    expect(base).toEqual([
      ...treeEffectsForStructuralPath(input.projectPath, input.path),
      filesExactEffect(filesPinsQuery(input.projectPath)),
    ])
    expect(base.some((e) => e.type === 'exact' && e.query.name === 'content')).toBe(false)

    const complete = filesMutations.duplicate.affectedEffectsForResult(input, output)
    expect(complete).toEqual([
      ...treeEffectsForStructuralPath(input.projectPath, input.path),
      filesExactEffect(filesPinsQuery(input.projectPath)),
      filesTreeSubtreeEffect(input.projectPath, output),
      filesContentSubtreeEffect(input.projectPath, output),
    ])
    expect(complete).toContainEqual(filesTreeSubtreeEffect(input.projectPath, output))
    expect(complete).toContainEqual(filesContentSubtreeEffect(input.projectPath, output))
  })

  it('trash invalidates descendant trees/content plus its parent and pins', () => {
    const input = fixtures.trashPath.input
    expect(filesMutations.trash.affectedEffects(input)).toEqual([
      ...treeSubtreeEffectsForStructuralPath(input.projectPath, input.path),
      filesExactEffect(filesPinsQuery(input.projectPath)),
      filesContentSubtreeEffect(input.projectPath, input.path),
    ])
  })
})

describe('filesMutations foreignDependencies order', () => {
  it('returns exact foreign token subsets in declared order', () => {
    expect(filesMutations.hide.foreignDependencies(fixtures.hidePath.input)).toEqual([
      FILES_FOREIGN_PATH_INDEX,
    ])
    expect(filesMutations.unhide.foreignDependencies(fixtures.unhidePath.input)).toEqual([
      FILES_FOREIGN_PATH_INDEX,
    ])
    expect(filesMutations.pin.foreignDependencies(fixtures.pinPath.input)).toEqual([])
    expect(filesMutations.unpin.foreignDependencies(fixtures.unpinPath.input)).toEqual([])
    expect(filesMutations.createFile.foreignDependencies(fixtures.createFile.input)).toEqual([
      FILES_FOREIGN_WORKING_TREE,
      FILES_FOREIGN_PATH_INDEX,
    ])
    expect(filesMutations.createFolder.foreignDependencies(fixtures.createFolder.input)).toEqual([
      FILES_FOREIGN_WORKING_TREE,
      FILES_FOREIGN_PATH_INDEX,
    ])
    expect(filesMutations.writeText.foreignDependencies(fixtures.writeTextFile.input)).toEqual([
      FILES_FOREIGN_WORKING_TREE,
      FILES_FOREIGN_PATH_INDEX,
      FILES_FOREIGN_CONTENT_INDEX,
    ])
    expect(filesMutations.duplicate.foreignDependencies(fixtures.duplicatePath.input)).toEqual([
      FILES_FOREIGN_WORKING_TREE,
      FILES_FOREIGN_PATH_INDEX,
      FILES_FOREIGN_CONTENT_INDEX,
    ])
    expect(filesMutations.rename.foreignDependencies(fixtures.renamePath.input)).toEqual([
      FILES_FOREIGN_WORKING_TREE,
      FILES_FOREIGN_PATH_INDEX,
      FILES_FOREIGN_CONTENT_INDEX,
    ])
    expect(filesMutations.trash.foreignDependencies(fixtures.trashPath.input)).toEqual([
      FILES_FOREIGN_WORKING_TREE,
      FILES_FOREIGN_PATH_INDEX,
      FILES_FOREIGN_CONTENT_INDEX,
    ])
  })
})

describe('filesMutations mock dispatch', () => {
  it('dispatches each bound procedure through the validating daemon mock', async () => {
    const daemon = createValidatingDaemonMock(filesProcedureCatalog, {
      hidePath: () => ({ ok: true, value: fixtures.hidePath.output }),
      unhidePath: () => ({ ok: true, value: fixtures.unhidePath.output }),
      pinPath: () => ({ ok: true, value: fixtures.pinPath.output }),
      unpinPath: () => ({ ok: true, value: fixtures.unpinPath.output }),
      writeTextFile: () => ({ ok: true, value: fixtures.writeTextFile.output }),
      createFile: () => ({ ok: true, value: fixtures.createFile.output }),
      createFolder: () => ({ ok: true, value: fixtures.createFolder.output }),
      renamePath: () => ({ ok: true, value: fixtures.renamePath.output }),
      duplicatePath: () => ({ ok: true, value: fixtures.duplicatePath.output }),
      trashPath: () => ({ ok: true, value: fixtures.trashPath.output }),
    })

    const outcomes = await Promise.all([
      daemon.dispatch({
        procedure: filesMutations.hide.procedureName,
        kind: filesMutations.hide.procedure.kind,
        input: fixtures.hidePath.input,
      }),
      daemon.dispatch({
        procedure: filesMutations.unhide.procedureName,
        kind: filesMutations.unhide.procedure.kind,
        input: fixtures.unhidePath.input,
      }),
      daemon.dispatch({
        procedure: filesMutations.pin.procedureName,
        kind: filesMutations.pin.procedure.kind,
        input: fixtures.pinPath.input,
      }),
      daemon.dispatch({
        procedure: filesMutations.unpin.procedureName,
        kind: filesMutations.unpin.procedure.kind,
        input: fixtures.unpinPath.input,
      }),
      daemon.dispatch({
        procedure: filesMutations.writeText.procedureName,
        kind: filesMutations.writeText.procedure.kind,
        input: fixtures.writeTextFile.input,
      }),
      daemon.dispatch({
        procedure: filesMutations.createFile.procedureName,
        kind: filesMutations.createFile.procedure.kind,
        input: fixtures.createFile.input,
      }),
      daemon.dispatch({
        procedure: filesMutations.createFolder.procedureName,
        kind: filesMutations.createFolder.procedure.kind,
        input: fixtures.createFolder.input,
      }),
      daemon.dispatch({
        procedure: filesMutations.rename.procedureName,
        kind: filesMutations.rename.procedure.kind,
        input: fixtures.renamePath.input,
      }),
      daemon.dispatch({
        procedure: filesMutations.duplicate.procedureName,
        kind: filesMutations.duplicate.procedure.kind,
        input: fixtures.duplicatePath.input,
      }),
      daemon.dispatch({
        procedure: filesMutations.trash.procedureName,
        kind: filesMutations.trash.procedure.kind,
        input: fixtures.trashPath.input,
      }),
    ])

    expect(outcomes.every((outcome) => outcome.ok)).toBe(true)
    expect(daemon.requests().map((request) => request.procedure)).toEqual([
      'hidePath',
      'unhidePath',
      'pinPath',
      'unpinPath',
      'writeTextFile',
      'createFile',
      'createFolder',
      'renamePath',
      'duplicatePath',
      'trashPath',
    ])
  })
})
