/**
 * Pure validation for agent-authored Excalidraw scenes.
 * Dependency-free so the CLI can mirror the same caps (see `src/cli/excalidraw-scene.ts`
 * if it needs a local copy — this module stays importable from backend + renderer).
 *
 * A scene is inert JSON rendered by OUR component — no HTML, no iframe. Size-capped
 * so a review-set write can't blow the channel.
 */

/** Hard cap on serialized scene JSON (1 MiB). */
export const MAX_SCENE_BYTES = 1_048_576

/** Evidence-dir filename for an Excalidraw body (sibling of index.html). */
export const EVIDENCE_SCENE_FILENAME = 'canvas.excalidraw'

/**
 * Minimal shape we accept. Elements must be an array; appState/files optional.
 * We do not deeply validate element fields — Excalidraw is the renderer and
 * tolerates unknown props; we only gate type/size.
 */
export interface ExcalidrawScene {
  type?: string
  version?: number
  source?: string
  elements: unknown[]
  appState?: Record<string, unknown>
  files?: Record<string, unknown>
}

export type ParseSceneResult =
  | { ok: true; scene: ExcalidrawScene; bytes: number }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse a UTF-8 string (file contents or CLI payload) into a size-capped scene.
 * Accepts either a raw `{ elements, … }` or a full `.excalidraw` export document.
 */
export function parseExcalidrawScene(raw: string): ParseSceneResult {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, error: 'scene must be a non-empty JSON string' }
  }
  const bytes = Buffer.byteLength(raw, 'utf8')
  if (bytes > MAX_SCENE_BYTES) {
    return {
      ok: false,
      error: `scene is ${bytes} bytes, over the ${MAX_SCENE_BYTES}-byte limit`,
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'scene is not valid JSON' }
  }
  const scene = coerceExcalidrawScene(parsed)
  if (!scene) {
    return {
      ok: false,
      error: 'scene must be an object with an elements array (Excalidraw export shape)',
    }
  }
  return { ok: true, scene, bytes }
}

/** Coerce unknown JSON into a scene, or null when the shape is unusable. */
export function coerceExcalidrawScene(value: unknown): ExcalidrawScene | null {
  if (!isRecord(value)) return null
  if (!Array.isArray(value.elements)) return null
  const scene: ExcalidrawScene = { elements: value.elements }
  if (typeof value.type === 'string') scene.type = value.type
  if (typeof value.version === 'number') scene.version = value.version
  if (typeof value.source === 'string') scene.source = value.source
  if (isRecord(value.appState)) scene.appState = value.appState
  if (isRecord(value.files)) scene.files = value.files
  return scene
}

/** Serialize a scene for storage (review-sets.json); re-checks the byte cap. */
export function serializeExcalidrawScene(scene: ExcalidrawScene): ParseSceneResult {
  const raw = JSON.stringify(scene)
  return parseExcalidrawScene(raw)
}
