import { join } from 'node:path'
import { app } from 'electron'
import { ensureCli as ensureCliInHome } from '../backend/cli-install'

/**
 * The Electron shell's boot-time CLI install. The backend `ensureCli` resolves the
 * bundle relative to the DAEMON chunk (`out/main/daemon/`), but the Mac app boots
 * from `out/main/index.js`, so the shell resolves the built CLI via
 * `app.getAppPath()` (readable inside app.asar) and hands it to the shared installer
 * — one wrapper-writing implementation, two entry points.
 */
function builtCliPath(): string {
  return join(app.getAppPath(), 'out', 'main', 'cli', 'porcelain.js')
}

/** Copy the bundled CLI to ~/.porcelain and refresh the runnable wrapper. Idempotent. */
export async function ensureCli(): Promise<string> {
  return ensureCliInHome(builtCliPath())
}
