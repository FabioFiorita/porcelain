// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { ReviewDoc } from '../../review/doc-set'
import type { EvidenceAssetBody } from '../../review/evidence-assets-list'
import { createClearEvidence } from './clear-evidence'
import { createReadEvidenceAsset } from './read-evidence-asset'
import { createReadEvidenceDoc } from './read-evidence-doc'
import { createReadEvidencePack } from './read-evidence-pack'
import type { ReviewEvidencePack, ReviewEvidenceStore } from './review-evidence-capabilities'

/**
 * In-memory capability fakes: they answer from the case's own synthetic data and
 * record call order and arguments, never reimplementing the filesystem, the document
 * reader, or the gallery.
 */

const REPO = '/synthetic/repo'

const PACK: ReviewEvidencePack = {
  title: 'Evidence',
  updatedAt: '2026-08-11T00:00:00.000Z',
  checks: [{ label: 'pnpm lint', status: 'pass' }],
  results: [
    { file: 'run-log.md', label: 'Run log', medium: 'markdown', bytes: 12, state: 'available' },
  ],
  assets: [
    {
      file: 'shot.png',
      label: 'Shot',
      mime: 'image/png',
      kind: 'image',
      bytes: 2048,
      state: 'available',
    },
  ],
}

const DOC: ReviewDoc = { file: 'run-log.md', label: 'Run log', medium: 'markdown', body: 'log' }

const BODY: EvidenceAssetBody = {
  file: 'shot.png',
  mime: 'image/png',
  bytes: 2048,
  dataUrl: 'data:image/png;base64,AAAA',
}

type StoreConfig = {
  pack?: ReviewEvidencePack | null
  asset?: EvidenceAssetBody | null
  fail?: boolean
}

function storeFake(
  config: StoreConfig = {},
  calls: unknown[] = [],
): { store: ReviewEvidenceStore; calls: unknown[] } {
  const store: ReviewEvidenceStore = {
    readPack: async (repoPath) => {
      calls.push(['readPack', repoPath])
      if (config.fail) throw new Error('disk exploded')
      return config.pack === undefined ? PACK : config.pack
    },
    readResults: async (repoPath) => {
      calls.push(['readResults', repoPath])
      if (config.fail) throw new Error('disk exploded')
      return [DOC]
    },
    readAsset: async (repoPath, file) => {
      calls.push(['readAsset', repoPath, file])
      return config.asset === undefined ? BODY : config.asset
    },
    clear: async (repoPath) => {
      calls.push(['clear', repoPath])
    },
  }
  return { store, calls }
}

describe('review evidence operations', () => {
  it('calls one store method per operation with the repo path the wire supplied', async () => {
    const { store, calls } = storeFake()

    expect(await createReadEvidencePack({ store })({ projectPath: REPO })).toEqual(PACK)
    expect(
      await createReadEvidenceDoc({ store })({ projectPath: REPO, file: 'run-log.md' }),
    ).toEqual(DOC)
    expect(
      await createReadEvidenceAsset({ store })({ projectPath: REPO, file: 'shot.png' }),
    ).toEqual(BODY)
    expect(await createClearEvidence({ store })({ projectPath: REPO })).toBeUndefined()

    expect(calls).toEqual([
      ['readPack', REPO],
      ['readResults', REPO],
      ['readAsset', REPO, 'shot.png'],
      ['clear', REPO],
    ])
  })

  it('reads an absent pack as null without touching documents or assets', async () => {
    const { store, calls } = storeFake({ pack: null })

    expect(await createReadEvidencePack({ store })({ projectPath: REPO })).toBeNull()

    expect(calls).toEqual([['readPack', REPO]])
  })

  it('answers a document the set does not hold with null, never another set member', async () => {
    const { store } = storeFake()

    expect(
      await createReadEvidenceDoc({ store })({ projectPath: REPO, file: 'absent.md' }),
    ).toBeNull()
    expect(
      await createReadEvidenceDoc({ store })({ projectPath: REPO, file: '../escape.md' }),
    ).toBeNull()
  })

  it('passes a client-supplied asset name through unchanged and returns null unaltered', async () => {
    const { store, calls } = storeFake({ asset: null })

    expect(
      await createReadEvidenceAsset({ store })({ projectPath: REPO, file: '../escape.png' }),
    ).toBeNull()
    expect(calls).toEqual([['readAsset', REPO, '../escape.png']])
  })

  it('propagates a rejecting store rather than collapsing it into null', async () => {
    const { store } = storeFake({ fail: true })

    await expect(createReadEvidencePack({ store })({ projectPath: REPO })).rejects.toThrow(
      'disk exploded',
    )
    await expect(
      createReadEvidenceDoc({ store })({ projectPath: REPO, file: 'run-log.md' }),
    ).rejects.toThrow('disk exploded')
  })
})
