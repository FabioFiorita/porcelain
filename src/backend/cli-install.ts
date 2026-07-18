import { chmod, copyFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * Install the bundled Porcelain CLI into `~/.porcelain/` so the user's agents can
 * run it as `~/.porcelain/porcelain <noun> <verb>` to drive the review/board/
 * action/note/layer/evidence/comment/chat channels. No per-agent config
 * writing — a CLI needs no registration to be runnable, so all the old Add-MCP
 * machinery is gone.
 *
 * Layout: the daemon bundle lives at `out/main/daemon/server.js` (and the same
 * relative layout in dist-daemon); the CLI bundle is the sibling
 * `out/main/cli/porcelain.js`. Resolved from `__dirname` so cwd never matters.
 *
 * The daemon (and the Mac shell) re-run this on every boot, so a daemon/app
 * upgrade ships new CLI commands automatically without any user action.
 */

/** Directory the CLI is installed into. */
function porcelainDir(): string {
  return join(homedir(), '.porcelain')
}

/** Bundled dependency-free CLI path (next to the daemon chunk). */
function builtCliPath(): string {
  return resolve(__dirname, '..', 'cli', 'porcelain.js')
}

// A tiny POSIX shell wrapper so `~/.porcelain/porcelain` is directly runnable and
// finds its own sibling bundle regardless of cwd.
const WRAPPER = '#!/bin/sh\nexec node "$(dirname "$0")/porcelain.js" "$@"\n'

/**
 * Copy the bundled CLI to `~/.porcelain/porcelain.js` and (re)write the runnable
 * `~/.porcelain/porcelain` wrapper (mode 0755). Idempotent — safe to call on every
 * boot. Returns the wrapper path. `source`/`dir` are injectable for tests and for
 * the Electron shell (which resolves the bundle via `app.getAppPath()`).
 */
export async function ensureCli(
  source: string = builtCliPath(),
  dir: string = porcelainDir(),
): Promise<string> {
  await mkdir(dir, { recursive: true })
  // Atomic installs. Two writers race at every Mac boot (the shell and the daemon both
  // call ensureCli), and an agent may exec the file mid-write. So write each output to a
  // sibling `<name>.tmp` and rename() it into place: rename is atomic on the same
  // filesystem, so a reader/exec only ever sees the old or the new file, never a
  // half-written one. chmod the wrapper tmp to 0o755 BEFORE the rename so the final path
  // never exists non-executable. Mirrors the tmp+rename idiom every channel writer uses
  // (src/cli/*-file.ts).
  const jsPath = join(dir, 'porcelain.js')
  const jsTmp = `${jsPath}.tmp`
  await copyFile(source, jsTmp)
  await rename(jsTmp, jsPath)

  const wrapperPath = join(dir, 'porcelain')
  const wrapperTmp = `${wrapperPath}.tmp`
  await writeFile(wrapperTmp, WRAPPER)
  await chmod(wrapperTmp, 0o755)
  await rename(wrapperTmp, wrapperPath)
  return wrapperPath
}
