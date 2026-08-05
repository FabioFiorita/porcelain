#!/usr/bin/env node
/**
 * Ensure every `pnpm <script>` an agent skill tells you to run actually exists.
 *
 * Skills are the manual agents follow before touching the repo, and a renamed or deleted
 * script leaves an instruction that only fails at the moment someone trusts it. Rollbacks
 * are the usual cause: the script goes, the sentence stays.
 *
 * Checks both trees — `.agents/skills` + `.agents/reference` (internal) and `skills/`
 * (shipped) — against the root package.json and every workspace package.
 *
 * A citation is satisfied when the script exists at the root, because that is where a bare
 * `pnpm <script>` runs. A script that only exists in a workspace package must be written
 * `pnpm --dir <path> <script>` (or `pnpm --filter <name> <script>`), which this skips.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Words that follow `pnpm` in prose or as pnpm's own CLI verbs, not project scripts.
const PNPM_BUILTINS = new Set([
  'add',
  'allows',
  'audit',
  'create',
  'dlx',
  'exec',
  'i',
  'install',
  'link',
  'list',
  'ls',
  'outdated',
  'pack',
  'publish',
  'remove',
  'run',
  'store',
  'test',
  'update',
  'why',
])

function readScripts(packageJsonPath) {
  if (!existsSync(packageJsonPath)) return {}
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')).scripts ?? {}
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.md')) out.push(full)
  }
  return out
}

const rootScripts = new Set(Object.keys(readScripts(join(root, 'package.json'))))

// Where a script lives when it is not at the root — used to suggest the fix.
const packageScripts = new Map()
for (const area of ['apps', 'packages']) {
  const areaDir = join(root, area)
  if (!existsSync(areaDir)) continue
  for (const name of readdirSync(areaDir)) {
    const dir = join(area, name)
    for (const script of Object.keys(readScripts(join(root, dir, 'package.json')))) {
      if (!packageScripts.has(script)) packageScripts.set(script, dir)
    }
  }
}

const files = [
  ...walk(join(root, '.agents', 'skills')),
  ...walk(join(root, '.agents', 'reference')),
  ...walk(join(root, 'skills')),
]

const problems = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, index) => {
    // `pnpm --dir x y` / `pnpm --filter x y` target a package explicitly; not our business.
    for (const match of line.matchAll(/(?<!--[\w-]{0,20} )\bpnpm ([a-z][a-z0-9:_-]*)/g)) {
      const script = match[1]
      if (PNPM_BUILTINS.has(script)) continue
      if (rootScripts.has(script)) continue
      // A trailing `*` in prose ("test:e2e:native*") means a family; check the stem.
      if ([...rootScripts].some((known) => known.startsWith(`${script}:`))) continue
      const elsewhere = packageScripts.get(script)
      problems.push({
        file: relative(root, file),
        line: index + 1,
        script,
        hint: elsewhere
          ? `exists in ${elsewhere} — write \`pnpm --dir ${elsewhere} ${script}\``
          : 'no such script anywhere in the workspace',
      })
    }
  })
}

if (problems.length > 0) {
  console.error('Agent skills cite pnpm scripts that do not exist:\n')
  for (const problem of problems) {
    console.error(`  ${problem.file}:${problem.line}  pnpm ${problem.script}`)
    console.error(`    ${problem.hint}`)
  }
  console.error('\nFix the citation, or add the script. A skill that lies costs an agent a run.')
  process.exit(1)
}

console.log(`lint-skill-commands: ok — ${files.length} skill file(s) checked`)
