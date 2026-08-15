import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  listEvidenceAssets,
  MAX_ASSET_BYTES,
  MAX_ASSETS,
  MAX_LINK_BYTES,
  readEvidenceAsset,
} from './evidence-assets-list'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const MP4 = Buffer.from('fake-mp4-bytes')

let dir = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'porcelain-assets-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('listEvidenceAssets', () => {
  it('is empty when the directory does not exist', async () => {
    expect(await listEvidenceAssets(join(dir, 'nope'))).toEqual([])
  })

  it('lists images name-sorted, with a label from the file name', async () => {
    await writeFile(join(dir, '02-after.png'), PNG)
    await writeFile(join(dir, '01-before.png'), PNG)
    const assets = await listEvidenceAssets(dir)
    expect(assets.map((a) => [a.file, a.label])).toEqual([
      ['01-before.png', '01 before'],
      ['02-after.png', '02 after'],
    ])
    expect(assets[0]).toMatchObject({ kind: 'image', mime: 'image/png', bytes: PNG.byteLength })
  })

  it('maps the mime from the extension', async () => {
    await writeFile(join(dir, 'a.jpg'), PNG)
    await writeFile(join(dir, 'b.webp'), PNG)
    await writeFile(join(dir, 'c.svg'), '<svg/>')
    expect(
      (await listEvidenceAssets(dir))
        .filter((asset) => asset.kind !== 'link')
        .map((asset) => asset.mime),
    ).toEqual(['image/jpeg', 'image/webp', 'image/svg+xml'])
  })

  it('lists supported video assets alongside images', async () => {
    await writeFile(join(dir, 'capture.webm'), MP4)
    await writeFile(join(dir, 'recording.MP4'), MP4)

    expect(await listEvidenceAssets(dir)).toEqual([
      {
        file: 'capture.webm',
        label: 'Capture',
        kind: 'video',
        mime: 'video/webm',
        bytes: MP4.byteLength,
      },
      {
        file: 'recording.MP4',
        label: 'Recording',
        kind: 'video',
        mime: 'video/mp4',
        bytes: MP4.byteLength,
      },
    ])
  })

  it('lists safe .url files as links without reading remote content', async () => {
    await writeFile(join(dir, 'reference.url'), 'https://example.com/evidence\n')
    expect(await listEvidenceAssets(dir)).toEqual([
      {
        file: 'reference.url',
        label: 'Reference',
        kind: 'link',
        href: 'https://example.com/evidence',
        bytes: Buffer.byteLength('https://example.com/evidence\n'),
      },
    ])
  })

  it('skips unsafe, empty, and oversized .url files', async () => {
    await writeFile(join(dir, 'bad.url'), 'javascript:alert(1)')
    await writeFile(join(dir, 'empty.url'), '')
    await writeFile(join(dir, 'huge.url'), Buffer.alloc(MAX_LINK_BYTES + 1, 0x61))
    expect(await listEvidenceAssets(dir)).toEqual([])
  })

  it('ignores unsupported files, dotfiles and sub-directories', async () => {
    await writeFile(join(dir, 'notes.txt'), 'nope')
    await writeFile(join(dir, '.hidden.png'), PNG)
    await mkdir(join(dir, 'nested.png'), { recursive: true })
    await writeFile(join(dir, 'shot.png'), PNG)
    expect((await listEvidenceAssets(dir)).map((a) => a.file)).toEqual(['shot.png'])
  })

  it('stops at MAX_ASSETS', async () => {
    await Promise.all(
      Array.from({ length: MAX_ASSETS + 5 }, (_, i) =>
        writeFile(join(dir, `${String(i).padStart(3, '0')}.png`), PNG),
      ),
    )
    expect(await listEvidenceAssets(dir)).toHaveLength(MAX_ASSETS)
  })

  it('lists an over-cap image even though its bytes cannot be served', async () => {
    await writeFile(join(dir, 'huge.png'), Buffer.alloc(MAX_ASSET_BYTES + 1))
    const [asset] = await listEvidenceAssets(dir)
    expect(asset?.file).toBe('huge.png')
    expect(await readEvidenceAsset(dir, 'huge.png')).toBeNull()
  })

  it('skips a symlink even when its target is a real image', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'porcelain-assets-outside-'))
    try {
      await writeFile(join(outside, 'real.png'), PNG)
      await symlink(join(outside, 'real.png'), join(dir, 'link.png'))
      expect(await listEvidenceAssets(dir)).toEqual([])
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })
})

describe('readEvidenceAsset', () => {
  it('returns a data URL for a listed image', async () => {
    await writeFile(join(dir, 'shot.png'), PNG)
    expect(await readEvidenceAsset(dir, 'shot.png')).toEqual({
      file: 'shot.png',
      mime: 'image/png',
      bytes: PNG.byteLength,
      dataUrl: `data:image/png;base64,${PNG.toString('base64')}`,
    })
  })

  it('returns a video data URL with the video MIME', async () => {
    await writeFile(join(dir, 'capture.mp4'), MP4)
    expect(await readEvidenceAsset(dir, 'capture.mp4')).toEqual({
      file: 'capture.mp4',
      mime: 'video/mp4',
      bytes: MP4.byteLength,
      dataUrl: `data:video/mp4;base64,${MP4.toString('base64')}`,
    })
  })

  it('refuses traversal, absolute paths and dotfiles', async () => {
    await writeFile(join(dir, '.secret.png'), PNG)
    await writeFile(join(dir, 'sibling.png'), PNG)
    for (const file of [
      '../sibling.png',
      'sub/../../sibling.png',
      '..\\sibling.png',
      '/etc/passwd',
      '.secret.png',
    ]) {
      expect(await readEvidenceAsset(dir, file)).toBeNull()
    }
  })

  it('returns null for a missing file and for an unsupported file', async () => {
    await writeFile(join(dir, 'notes.txt'), 'nope')
    expect(await readEvidenceAsset(dir, 'notes.txt')).toBeNull()
    expect(await readEvidenceAsset(dir, 'gone.png')).toBeNull()
    await writeFile(join(dir, 'reference.url'), 'https://example.com')
    expect(await readEvidenceAsset(dir, 'reference.url')).toBeNull()
  })

  it('refuses a symlink even when its target resolves inside dir and is a real image', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'porcelain-assets-outside-'))
    try {
      const secret = join(outside, 'secret.png')
      await writeFile(secret, PNG)
      await symlink(secret, join(dir, 'link.png'))
      expect(await readEvidenceAsset(dir, 'link.png')).toBeNull()
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })
})
