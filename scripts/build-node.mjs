#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
/**
 * Independent Node builds for the daemon and agent CLI — no electron-vite.
 *
 * Writes into the existing runtime layout so shell spawn, ensureCli, and
 * porcelain-daemon packaging keep working:
 *
 *   apps/desktop/out/main/daemon/server.js
 *   apps/desktop/out/main/cli/porcelain.js
 *
 * CLI is a single dependency-free CJS file (Node builtins only). Daemon externalizes
 * the same runtime deps the npm package declares (trpc, ws, node-pty, trash, zod).
 *
 * Usage:
 *   node scripts/build-node.mjs           # both
 *   node scripts/build-node.mjs daemon
 *   node scripts/build-node.mjs cli
 */
import * as esbuild from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outMain = join(root, 'apps', 'desktop', 'out', 'main')
const sharedSrc = join(root, 'packages', 'shared', 'src')
const contractsSrc = join(root, 'packages', 'contracts', 'src')

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { help: { type: 'boolean', default: false } },
  strict: true,
})

if (values.help) {
  console.log(`Usage: node scripts/build-node.mjs [daemon|cli|all]
Independent esbuild of daemon + agent CLI into apps/desktop/out/main/.`)
  process.exit(0)
}

const target = positionals[0] ?? 'all'
if (!['daemon', 'cli', 'all'].includes(target)) {
  console.error(`[build-node] unknown target: ${target}`)
  process.exit(1)
}

// Product version — same stamp as release (sync-versions). Prefer daemon package.
const versionPkg = existsSync(join(root, 'apps', 'daemon', 'package.json'))
  ? join(root, 'apps', 'daemon', 'package.json')
  : join(root, 'apps', 'desktop', 'package.json')
const { version } = JSON.parse(readFileSync(versionPkg, 'utf8'))

/** Resolve @shared/* and @porcelain/{shared,contracts}/* to TS sources. */
function workspaceAliasPlugin() {
  return {
    name: 'porcelain-workspace-alias',
    setup(build) {
      const map = [
        [/^@shared\/(.+)$/, sharedSrc],
        [/^@porcelain\/shared\/(.+)$/, sharedSrc],
        [/^@porcelain\/shared$/, join(sharedSrc, 'index.ts')],
        [/^@porcelain\/contracts\/(.+)$/, contractsSrc],
        [/^@porcelain\/contracts$/, join(contractsSrc, 'index.ts')],
      ]
      for (const [filter, base] of map) {
        build.onResolve({ filter }, (args) => {
          if (typeof base === 'string' && base.endsWith('.ts')) {
            return { path: base }
          }
          const sub = args.path.match(filter)?.[1]
          if (sub === undefined) return { path: base }
          const bare = join(base, sub)
          for (const candidate of [`${bare}.ts`, join(bare, 'index.ts'), bare]) {
            if (existsSync(candidate)) return { path: candidate }
          }
          return { path: `${bare}.ts` }
        })
      }
    },
  }
}

const define = { __PORCELAIN_VERSION__: JSON.stringify(version) }
const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  logLevel: 'info',
  define,
  plugins: [workspaceAliasPlugin()],
}

async function buildDaemon() {
  const outfile = join(outMain, 'daemon', 'server.js')
  mkdirSync(dirname(outfile), { recursive: true })
  await esbuild.build({
    ...common,
    entryPoints: [join(root, 'apps', 'daemon', 'src', 'server.ts')],
    outfile,
    // Match porcelain-daemon runtime deps — not bundled so native modules compile on host.
    external: ['@trpc/server', '@trpc/client', 'ws', 'node-pty', 'trash', 'zod'],
  })
  console.log(`[build-node] daemon → ${outfile}`)
}

async function buildCli() {
  const outfile = join(outMain, 'cli', 'porcelain.js')
  mkdirSync(dirname(outfile), { recursive: true })
  // Fully bundled: agents run plain `node porcelain.js` with zero install.
  // No shared chunks — ensureCli treats a missing chunks dir as single-file.
  await esbuild.build({
    ...common,
    entryPoints: [join(root, 'apps', 'cli', 'src', 'porcelain.ts')],
    outfile,
    // Node builtins only; do not externalize workspace packages.
    packages: 'bundle',
  })
  // Drop stale electron-vite chunk siblings so installs don't pick up dead hashes.
  const chunks = join(outMain, 'chunks')
  if (existsSync(chunks)) {
    rmSync(chunks, { recursive: true, force: true })
    console.log(`[build-node] removed stale ${chunks} (CLI is single-file now)`)
  }
  console.log(`[build-node] cli → ${outfile}`)
}

if (target === 'daemon' || target === 'all') await buildDaemon()
if (target === 'cli' || target === 'all') await buildCli()
