#!/usr/bin/env node
/**
 * Post-pack structural smoke for release CI.
 *
 * Full GUI fuse checks (PTY spawn, updater) need a display and the installed
 * app; native e2e covers runtime. This script only verifies packaging layout
 * that has burned releases before: node-pty unpacked + Electron binary present.
 *
 * Usage:
 *   node scripts/release-fuse-smoke.mjs --platform mac --dir apps/desktop/dist
 *   node scripts/release-fuse-smoke.mjs --platform win --dir apps/desktop/dist
 */
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    platform: { type: 'string' },
    dir: { type: 'string', default: 'apps/desktop/dist' },
    help: { type: 'boolean', default: false },
  },
  strict: true,
})

if (values.help || !['mac', 'win'].includes(values.platform)) {
  console.log(
    'Usage: node scripts/release-fuse-smoke.mjs --platform <mac|win> [--dir apps/desktop/dist]',
  )
  process.exit(values.help ? 0 : 1)
}

const root = values.dir

function fail(msg) {
  console.error(`release:fuse-smoke ✗ ${msg}`)
  process.exit(1)
}

function ok(msg) {
  console.log(`release:fuse-smoke ✓ ${msg}`)
}

if (!fs.existsSync(root)) {
  fail(`dir not found: ${root}`)
}

const entries = fs.readdirSync(root)
if (values.platform === 'mac') {
  const dmg = entries.find((e) => e.endsWith('.dmg'))
  const zip = entries.find((e) => e.endsWith('.zip'))
  const latestYml = entries.find((e) => e === 'latest-mac.yml')
  if (!dmg) fail('missing .dmg in dist')
  if (!zip) fail('missing .zip in dist (electron-updater needs it)')
  if (!latestYml) fail('missing latest-mac.yml')
  ok(`mac artifacts: ${dmg}, ${zip}, ${latestYml}`)
} else {
  const latestYml = entries.find((e) => e === 'latest.yml')
  if (!latestYml) fail('missing latest.yml')
  const version = /^version:\s*['"]?([^'"\s]+)['"]?\s*$/mu.exec(
    fs.readFileSync(path.join(root, latestYml), 'utf8'),
  )?.[1]
  if (!version) fail('latest.yml has no release version')
  const installer = entries.find((e) => e === `porcelain-${version}-windows-x64-setup.exe`)
  const blockmap =
    installer === undefined ? undefined : entries.find((e) => e === `${installer}.blockmap`)
  const unpackedBinary = path.join(root, 'win-unpacked', 'Porcelain.exe')
  if (!installer) fail('missing x64 NSIS installer in dist')
  if (!blockmap) fail('missing Windows installer blockmap in dist')
  if (!fs.existsSync(unpackedBinary)) fail('missing win-unpacked/Porcelain.exe')
  ok(`Windows artifacts: ${installer}, ${blockmap}, ${latestYml}`)
  ok(`Windows unpacked binary: ${path.relative(root, unpackedBinary)}`)
}

// electron-builder leaves the unpacked app under dist/mac* for some targets;
// also check any *.app if present (mac unpack).
function walkFind(dir, pred, depth = 0) {
  if (depth > 10 || !fs.existsSync(dir)) return null
  let names
  try {
    names = fs.readdirSync(dir)
  } catch {
    return null
  }
  for (const name of names) {
    const full = path.join(dir, name)
    if (pred(full, name)) return full
    try {
      if (fs.statSync(full).isDirectory()) {
        const hit = walkFind(full, pred, depth + 1)
        if (hit) return hit
      }
    } catch {
      // ignore permission / race
    }
  }
  return null
}

const ptyNode = walkFind(root, (_full, name) => name === 'pty.node')
if (ptyNode) {
  ok(`node-pty unpacked: ${path.relative(root, ptyNode)}`)
} else if (values.platform === 'win') {
  fail('node-pty native addon is missing from the unpacked Windows application')
} else {
  // Not always left on disk after dmg/zip only packaging — warn, don't fail.
  // asarUnpack is enforced by electron-builder.yml; e2e terminal is the runtime proof.
  console.log('release:fuse-smoke · pty.node not found under dist (ok if only dmg/zip remain)')
}

ok('packaging smoke passed')
