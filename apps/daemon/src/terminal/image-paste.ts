import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  MAX_PASTE_FILE_BYTES,
  MAX_PASTE_IMAGE_BYTES,
  terminalFilePromptReference,
  terminalImagePromptReference,
} from '@porcelain/contracts'
import { porcelainHomePath } from '@shared/porcelain-home'
import { hasTerminal, writeTerminal } from './terminal-manager'

/**
 * Client → PTY image paste. The client and the PTY are never the same machine (even the
 * "local" Electron case: the daemon owns the PTY, the shell client owns the clipboard —
 * see `ws-protocol.ts`'s `terminal:paste-image`), so this is a real file transfer, not a
 * clipboard forward. The image lands under the daemon's own per-user home
 * (`porcelainHomePath`), never under `<repo>/.porcelain/` — that directory is NOT
 * gitignored (only `.porcelain-worktree.json` is), so a pasted screenshot there would
 * show up as an untracked file in `git status`, the exact surface this product is built
 * around keeping clean.
 *
 * A bare typed path does not make Claude Code see the image — confirmed by testing the
 * CLI directly. What DOES work, per Claude Code's own docs, is mentioning the path in
 * natural language ("Analyze this image: /path"), which the model reliably reads with
 * its own `Read` tool. Immediate paste therefore writes the file, then types that mention into
 * the PTY exactly as `initial-input.ts` proves synthetic input can — `pty.write()` does not
 * distinguish a real keystroke from a daemon-authored one. A command composer can request only
 * the upload result, then insert several returned paths in one terminal write after they all pass.
 */

const MIME_EXTENSIONS: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const PASTE_DIR = 'terminal-pastes'

/** How long a pasted image's temp file survives before the sweep reclaims it. */
export const PASTE_RETENTION_MS = 24 * 60 * 60_000
const SWEEP_INTERVAL_MS = 60 * 60_000

let sweepTimer: ReturnType<typeof setInterval> | undefined

/**
 * Start the reaper on first use, same rule as `terminal-manager.ts`'s `startSweeping` —
 * never at import, so a module that merely imports this one doesn't leak a timer. This
 * single interval also covers orphan cleanup after a daemon crash/restart: whatever is
 * left over from a previous process ages out on the next sweep, so there is no separate
 * crash-recovery path to maintain.
 */
function startSweeping(): void {
  if (sweepTimer !== undefined) return
  sweepTimer = setInterval(() => void sweepPastedImages(), SWEEP_INTERVAL_MS)
  sweepTimer.unref()
  void sweepPastedImages()
}

/** Delete pasted-image files older than `PASTE_RETENTION_MS`. Missing root is not an error. */
export async function sweepPastedImages(now: number = Date.now()): Promise<void> {
  const root = porcelainHomePath(PASTE_DIR)
  let terminalDirs: string[]
  try {
    terminalDirs = await readdir(root)
  } catch {
    return
  }
  for (const terminalId of terminalDirs) {
    const dir = join(root, terminalId)
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      continue
    }
    for (const file of files) {
      const path = join(dir, file)
      const info = await stat(path).catch(() => null)
      if (info !== null && now - info.mtimeMs > PASTE_RETENTION_MS) {
        await rm(path, { force: true }).catch(() => {})
      }
    }
  }
}

export type PasteImageResult = {
  result: 'ok' | 'too-large' | 'no-session' | 'write-failed'
  path?: string
}

export type PasteFileResult = PasteImageResult

/**
 * A client filename is presentation data, never a filesystem path. Normalise both path
 * separators before taking the final component, then retain only a small portable filename
 * alphabet. The daemon still prefixes it with random bytes, so two matching uploads cannot
 * collide and a name like `../../.ssh/config` cannot escape this scratch directory.
 */
function safeFilename(filename: string): string {
  const leaf = filename.replaceAll('\\', '/').split('/').at(-1) ?? ''
  const safe = leaf.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+$/, '')
  return (safe === '' ? 'attachment' : safe).slice(0, 120)
}

async function saveAttachment(params: {
  id: string
  dataBase64: string
  filename: string
  maxBytes: number
}): Promise<PasteImageResult> {
  startSweeping()
  if (!hasTerminal(params.id)) return { result: 'no-session' }

  const buffer = Buffer.from(params.dataBase64, 'base64')
  if (buffer.byteLength > params.maxBytes) return { result: 'too-large' }

  const dir = porcelainHomePath(PASTE_DIR, params.id)
  const path = join(
    dir,
    `${Date.now()}-${randomBytes(4).toString('hex')}-${safeFilename(params.filename)}`,
  )
  try {
    await mkdir(dir, { mode: 0o700, recursive: true })
    await chmod(dir, 0o700)
    await writeFile(path, buffer, { mode: 0o600 })
  } catch {
    return { result: 'write-failed' }
  }
  return { path, result: 'ok' }
}

/**
 * Decode, size-check, and write a pasted image for `id`'s session. Unless `insert` is false,
 * type a natural-language mention of its path into the PTY. Never throws — every failure mode is
 * a typed result the caller replies with over the WS protocol.
 */
export async function pasteImageToTerminal(params: {
  id: string
  mime: string
  dataBase64: string
  insert?: boolean
}): Promise<PasteImageResult> {
  const { id, mime, dataBase64 } = params
  const ext = MIME_EXTENSIONS[mime] ?? 'bin'
  const outcome = await saveAttachment({
    id,
    dataBase64,
    filename: `image.${ext}`,
    maxBytes: MAX_PASTE_IMAGE_BYTES,
  })
  if (outcome.result !== 'ok' || outcome.path === undefined) return outcome

  // Inserted at the cursor, not submitted (no trailing `\r`) — a real terminal paste
  // lands inline and lets the user's own surrounding message survive. Not wrapped in
  // bracketed-paste escapes either: Claude Code's TUI collapses those into an opaque
  // "[Pasted text #1]" placeholder, which would hide the path from the model and defeat
  // the whole mechanism. Plain unescaped text is what the model reliably reads.
  if (params.insert !== false) writeTerminal(id, terminalImagePromptReference(outcome.path))

  return outcome
}

/**
 * Store a generic attachment on the daemon host and refer to the minted path in the PTY. This
 * intentionally shares image retention/permissions but never treats a browser or phone URI as
 * meaningful on the daemon: only the transferred bytes exist there.
 */
export async function pasteFileToTerminal(params: {
  id: string
  filename: string
  mime: string
  dataBase64: string
  insert?: boolean
}): Promise<PasteFileResult> {
  const outcome = await saveAttachment({
    id: params.id,
    dataBase64: params.dataBase64,
    filename: params.filename,
    maxBytes: MAX_PASTE_FILE_BYTES,
  })
  if (outcome.result !== 'ok' || outcome.path === undefined) return outcome
  if (params.insert !== false) writeTerminal(params.id, terminalFilePromptReference(outcome.path))
  return outcome
}
