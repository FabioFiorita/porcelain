#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
/**
 * Independent Node build for the daemon — no electron-vite.
 *
 * Writes into the existing runtime layout so shell spawn and porcelain
 * packaging keep working:
 *
 *   apps/desktop/out/main/daemon/server.js
 *   apps/desktop/out/main/contracts/protocol.js
 *
 * Daemon externalizes the same runtime deps the npm package declares (trpc, ws,
 * node-pty, trash, zod). The agent CLI target is gone: agents reach Porcelain over
 * MCP now, and the daemon is the only writer of its own home.
 *
 * Usage:
 *   node scripts/build-node.mjs           # daemon + protocol
 *   node scripts/build-node.mjs daemon
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
  console.log(`Usage: node scripts/build-node.mjs [daemon|all]
Independent esbuild of the daemon into apps/desktop/out/main/.`)
  process.exit(0)
}

const target = positionals[0] ?? 'all'
if (!['daemon', 'all'].includes(target)) {
  console.error(`[build-node] unknown target: ${target}`)
  process.exit(1)
}

// Product version — same stamp as release (sync-versions). Prefer daemon package.
const versionPkg = join(root, 'apps', 'daemon', 'package.json')
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
    // Match @fabiofiorita/porcelain runtime deps — not bundled so native modules compile on host.
    external: ['@trpc/server', '@trpc/client', 'ws', 'node-pty', 'trash', 'zod'],
  })
  console.log(`[build-node] daemon → ${outfile}`)
}

/**
 * The wire protocol constants, built as one requirable CJS module.
 *
 * `scripts/porcelain-host.js` is plain CommonJS with no bundler and no workspace resolution, but
 * it is a repository-owned daemon client: it must announce the same protocol version the
 * daemon enforces, from the same contracts definition, never a copied literal. It already
 * requires the built daemon out of this layout — this puts the contracts it needs beside it,
 * in both the monorepo (`apps/desktop/out/main/`) and the published package (`main/`).
 */
async function buildProtocol() {
  const outfile = join(outMain, 'contracts', 'protocol.js')
  mkdirSync(dirname(outfile), { recursive: true })
  await esbuild.build({
    ...common,
    entryPoints: [join(contractsSrc, 'protocol.ts')],
    outfile,
    // zod stays external, exactly as in the daemon bundle: it is a declared dependency of
    // the @fabiofiorita/porcelain package, and bundling it would grow two constants to 500 kB.
    external: ['zod'],
  })
  console.log(`[build-node] protocol → ${outfile}`)
}

if (target === 'daemon' || target === 'all') await buildDaemon()
if (target === 'daemon' || target === 'all') await buildProtocol()
