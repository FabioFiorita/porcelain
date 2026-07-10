import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

interface TrashMacosModule {
  resolveBinary(moduleUrl: string | URL): URL
}

function isTrashMacosModule(value: unknown): value is TrashMacosModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    'resolveBinary' in value &&
    typeof value.resolveBinary === 'function'
  )
}

async function loadMacosModule(): Promise<TrashMacosModule> {
  const moduleUrl = pathToFileURL(join(process.cwd(), 'node_modules/trash/lib/macos.js'))
  const loaded: unknown = await import(/* @vite-ignore */ moduleUrl.href)
  if (!isTrashMacosModule(loaded)) throw new Error('trash macOS helper resolver is missing')
  return loaded
}

describe('trash macOS packaging', () => {
  it('executes the helper from app.asar.unpacked in a packaged app', async () => {
    const { resolveBinary } = await loadMacosModule()

    expect(
      resolveBinary(
        'file:///Applications/Porcelain.app/Contents/Resources/app.asar/node_modules/trash/lib/macos.js',
      ).href,
    ).toBe(
      'file:///Applications/Porcelain.app/Contents/Resources/app.asar.unpacked/node_modules/trash/lib/macos-trash',
    )
  })

  it('keeps the installed package path outside Electron unchanged', async () => {
    const { resolveBinary } = await loadMacosModule()

    expect(resolveBinary('file:///opt/porcelain/node_modules/trash/lib/macos.js').href).toBe(
      'file:///opt/porcelain/node_modules/trash/lib/macos-trash',
    )
  })
})
