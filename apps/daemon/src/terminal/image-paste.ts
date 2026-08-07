import { randomBytes } from 'node:crypto'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MAX_PASTE_IMAGE_BYTES } from '@porcelain/contracts'
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
 * its own `Read` tool. So the daemon writes the file, then types that mention into the
 * PTY exactly as `initial-input.ts` proves synthetic input can — `pty.write()` does not
 * distinguish a real keystroke from a daemon-authored one.
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

/**
 * Decode, size-check, and write a pasted image for `id`'s session, then type a
 * natural-language mention of its path into the PTY. Never throws — every failure mode
 * is a typed result the caller replies with over the WS protocol.
 */
export async function pasteImageToTerminal(params: {
  id: string
  mime: string
  dataBase64: string
}): Promise<PasteImageResult> {
  startSweeping()
  const { id, mime, dataBase64 } = params
  // Checked before any write: a dead session leaves nothing on disk for the sweep to
  // have to reclaim.
  if (!hasTerminal(id)) return { result: 'no-session' }

  const buffer = Buffer.from(dataBase64, 'base64')
  if (buffer.byteLength > MAX_PASTE_IMAGE_BYTES) return { result: 'too-large' }

  const ext = MIME_EXTENSIONS[mime] ?? 'bin'
  const dir = porcelainHomePath(PASTE_DIR, id)
  const path = join(dir, `${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`)
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(path, buffer)
  } catch {
    return { result: 'write-failed' }
  }

  // Inserted at the cursor, not submitted (no trailing `\r`) — a real terminal paste
  // lands inline and lets the user's own surrounding message survive. Not wrapped in
  // bracketed-paste escapes either: Claude Code's TUI collapses those into an opaque
  // "[Pasted text #1]" placeholder, which would hide the path from the model and defeat
  // the whole mechanism. Plain unescaped text is what the model reliably reads.
  const quotedPath = path.includes(' ') ? `"${path}"` : path
  writeTerminal(id, `Analyze this image: ${quotedPath} `)

  return { result: 'ok', path }
}
