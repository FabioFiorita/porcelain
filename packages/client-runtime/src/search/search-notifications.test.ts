import {
  FILES_FOREIGN_CONTENT_INDEX,
  FILES_FOREIGN_PATH_INDEX,
} from '@porcelain/client-runtime/files'
import { filesNotificationFixtures } from '@porcelain/contracts/files'
import { describe, expect, it } from 'vitest'

import { searchForeignDependencyEffects, searchNotificationEffects } from './search-notifications'

describe('Search notification effects', () => {
  it('maps scope and tree changes to file-name Search', () => {
    expect(searchNotificationEffects(filesNotificationFixtures['files.scope-changed'])).toEqual([
      { type: 'files', projectPath: '/synthetic/repo' },
    ])
    expect(searchNotificationEffects(filesNotificationFixtures['files.tree-changed'])).toEqual([
      { type: 'files', projectPath: '/synthetic/repo' },
    ])
  })

  it('maps content changes to all Search families exactly once', () => {
    expect(searchNotificationEffects(filesNotificationFixtures['files.content-changed'])).toEqual([
      { type: 'files', projectPath: '/synthetic/repo' },
      { type: 'text', projectPath: '/synthetic/repo' },
      { type: 'code', projectPath: '/synthetic/repo' },
    ])
  })

  it('rebinds Files foreign tokens to the same project', () => {
    expect(
      searchForeignDependencyEffects('/synthetic/repo', [
        FILES_FOREIGN_PATH_INDEX,
        FILES_FOREIGN_CONTENT_INDEX,
        FILES_FOREIGN_CONTENT_INDEX,
      ]),
    ).toEqual([
      { type: 'files', projectPath: '/synthetic/repo' },
      { type: 'text', projectPath: '/synthetic/repo' },
      { type: 'code', projectPath: '/synthetic/repo' },
    ])
  })
})
