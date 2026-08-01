import { describe, expect, it } from 'vitest'
import {
  coerceExcalidrawScene,
  MAX_SCENE_BYTES,
  parseExcalidrawScene,
  serializeExcalidrawScene,
} from './excalidraw-scene'

const minimal = {
  type: 'excalidraw',
  version: 2,
  elements: [{ id: 'a', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }],
  appState: { viewBackgroundColor: '#fff' },
  files: {},
}

describe('parseExcalidrawScene', () => {
  it('accepts a minimal .excalidraw export', () => {
    const result = parseExcalidrawScene(JSON.stringify(minimal))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.scene.elements).toHaveLength(1)
    expect(result.scene.type).toBe('excalidraw')
  })

  it('rejects empty, non-JSON, and missing elements', () => {
    expect(parseExcalidrawScene('').ok).toBe(false)
    expect(parseExcalidrawScene('not-json').ok).toBe(false)
    expect(parseExcalidrawScene(JSON.stringify({ type: 'excalidraw' })).ok).toBe(false)
  })

  it('rejects oversize payloads', () => {
    const fat = {
      elements: [{ id: 'x', type: 'text', text: 'x'.repeat(MAX_SCENE_BYTES) }],
    }
    const result = parseExcalidrawScene(JSON.stringify(fat))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/over the/)
  })
})

describe('coerceExcalidrawScene', () => {
  it('returns null for non-objects', () => {
    expect(coerceExcalidrawScene(null)).toBeNull()
    expect(coerceExcalidrawScene([])).toBeNull()
  })
})

describe('serializeExcalidrawScene', () => {
  it('round-trips a coerced scene', () => {
    const scene = coerceExcalidrawScene(minimal)
    expect(scene).not.toBeNull()
    if (!scene) return
    const result = serializeExcalidrawScene(scene)
    expect(result.ok).toBe(true)
  })
})
