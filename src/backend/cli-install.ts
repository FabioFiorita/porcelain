import { chmod, copyFile, cp, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { porcelainHome } from '../shared/porcelain-home'

/**
 * Install the bundled Porcelain CLI into `PORCELAIN_HOME` (default `~/.porcelain/`)
 * so agents can run `porcelain <noun> <verb>` against the channel files there.
 * No per-agent config writing — agents just run the binary. Dev stack sets
 * `PORCELAIN_HOME=~/.porcelain-dev` so product work never overwrites the
 * production install.
 *
 * Build layout (preserved on install):
 *   out/main/cli/porcelain.js
 *   out/main/chunks/*          ← required by the CLI's `require("../chunks/…")`
 *
 * Install layout (must match those relative requires):
 *   ~/.porcelain/cli/porcelain.js
 *   ~/.porcelain/chunks/*
 *   ~/.porcelain/porcelain     ← wrapper → node cli/porcelain.js
 *
 * Copying only porcelain.js to ~/.porcelain/porcelain.js was a latent bug: the
 * require becomes ~/chunks/… which does not exist. A daemon upgrade that shipped
 * a chunk-splitting CLI broke every agent that ran `~/.porcelain/porcelain`.
 *
 * The daemon (and the Mac shell) re-run this on every boot, so a daemon/app
 * upgrade ships new CLI commands automatically without any user action.
 */

/** Directory the CLI is installed into. */
function porcelainDir(): string {
  return porcelainHome()
}

/** Bundled dependency-free CLI path (next to the daemon chunk). */
function builtCliPath(): string {
  return resolve(__dirname, '..', 'cli', 'porcelain.js')
}

/** Chunks sibling of the CLI entry — `../chunks` from `cli/porcelain.js`. */
function builtChunksDir(cliSource: string): string {
  return resolve(dirname(cliSource), '..', 'chunks')
}

// Wrapper finds cli/porcelain.js next to itself regardless of cwd.
const WRAPPER = '#!/bin/sh\nexec node "$(dirname "$0")/cli/porcelain.js" "$@"\n'

/**
 * Copy the bundled CLI + its chunks into `dir` and write the runnable wrapper.
 * Idempotent — safe on every boot. Returns the wrapper path. `source`/`dir` are
 * injectable for tests and for the Electron shell (`app.getAppPath()`).
 */
export async function ensureCli(
  source: string = builtCliPath(),
  dir: string = porcelainDir(),
): Promise<string> {
  await mkdir(dir, { recursive: true })

  const cliDir = join(dir, 'cli')
  const chunksDir = join(dir, 'chunks')
  await mkdir(cliDir, { recursive: true })
  await mkdir(chunksDir, { recursive: true })

  // Atomic installs. Two writers race at every Mac boot (the shell and the daemon both
  // call ensureCli), and an agent may exec the file mid-write. Write each output to a
  // sibling `<name>.tmp` and rename() into place.
  const jsPath = join(cliDir, 'porcelain.js')
  const jsTmp = `${jsPath}.tmp`
  await copyFile(source, jsTmp)
  await rename(jsTmp, jsPath)

  // Copy every built chunk so require("../chunks/<hash>.js") resolves. Wipe the
  // destination first so renamed hashes from a previous build don't accumulate.
  const chunksSrc = builtChunksDir(source)
  const chunksTmp = `${chunksDir}.tmp`
  await rm(chunksTmp, { recursive: true, force: true })
  await cp(chunksSrc, chunksTmp, { recursive: true })
  await rm(chunksDir, { recursive: true, force: true })
  await rename(chunksTmp, chunksDir)

  // Drop the legacy flat install (pre-layout-fix) so a stale porcelain.js can't
  // be executed by accident and fail on missing ../chunks.
  await rm(join(dir, 'porcelain.js'), { force: true })

  const wrapperPath = join(dir, 'porcelain')
  const wrapperTmp = `${wrapperPath}.tmp`
  await writeFile(wrapperTmp, WRAPPER)
  await chmod(wrapperTmp, 0o755)
  await rename(wrapperTmp, wrapperPath)

  // Sanity: at least one chunk landed (empty chunks dir would mean a broken build).
  const chunkFiles = await readdir(chunksDir)
  if (chunkFiles.length === 0) {
    throw new Error(`ensureCli: no chunks copied from ${chunksSrc}`)
  }

  return wrapperPath
}
