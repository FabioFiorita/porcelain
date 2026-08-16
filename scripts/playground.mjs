#!/usr/bin/env node
/**
 * Disposable playground fixtures for the Porcelain DEV stack.
 *
 * A dev daemon may only open repositories in the playground family
 * (`apps/daemon/src/dev-config.ts`), and until now that family had exactly one member per
 * profile. One repository cannot exercise adding a project, removing one, switching between
 * them, or reviewing anything with a shape — which is why those flows shipped broken.
 *
 * Fleet members live at `~/code/porcelain-playgrounds/.fleet/<profile>/<name>`:
 *   - inside the managed root the dev guard already recognizes, so no guard change and no
 *     third playground location;
 *   - under a `.fleet` segment that no managed worktree slug can take (slugs must start with
 *     `[a-z0-9]`), so a fixture can never collide with a worktree's own playground;
 *   - keyed by profile (`primary` or the worktree slug), so worktrees do not share fixtures.
 *
 * Generation is deterministic and offline: fixed authorship, fixed dates, no network.
 *
 * Usage:
 *   pnpm playground new <shape> [--name <slug>]
 *   pnpm playground list
 *   pnpm playground rm <slug>
 *   pnpm playground reset <slug>
 *   pnpm playground shapes
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DEV_PLAYGROUND, DEV_PROFILE } from './dev-env.mjs'

export const FLEET_SEGMENT = '.fleet'
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/
// One fixed instant for every generated commit: a fixture that changes its own history
// between runs makes diffs and screenshots non-reproducible.
const FIXED_DATE = '2026-01-01T00:00:00+00:00'
const AUTHOR = ['-c', 'user.name=Porcelain Playground', '-c', 'user.email=playground@localhost']

class PlaygroundError extends Error {}

const fail = (message) => {
  throw new PlaygroundError(message)
}

/**
 * The managed playground root this profile's dev guard recognizes.
 *
 * The primary profile's playground is `~/code/porcelain-playground` (singular) and its
 * managed sibling root is `porcelain-playgrounds`; a worktree profile's playground already
 * lives inside that root. Both cases resolve to the same directory — mirroring
 * `recognizedDevPlaygroundPath`, which is what actually authorizes these paths.
 */
export function managedPlaygroundRoot(playground = DEV_PLAYGROUND) {
  const parent = dirname(resolve(playground))
  return basename(parent) === 'porcelain-playgrounds'
    ? parent
    : join(parent, 'porcelain-playgrounds')
}

export function profileKey(profile = DEV_PROFILE) {
  return profile.slug ?? 'primary'
}

export function fleetRoot(playground = DEV_PLAYGROUND, profile = DEV_PROFILE) {
  return join(managedPlaygroundRoot(playground), FLEET_SEGMENT, profileKey(profile))
}

export function fleetMemberPath(slug, playground = DEV_PLAYGROUND, profile = DEV_PROFILE) {
  if (!SLUG_PATTERN.test(slug)) {
    fail(`invalid playground name: ${slug} (lower-case letters, digits and dashes, max 48)`)
  }
  return join(fleetRoot(playground, profile), slug)
}

/**
 * Guard every removal the way `scripts/worktree.mjs` guards worktree teardown: a path is
 * removable only when it is a direct child of this profile's fleet root. Nothing outside
 * the fleet is this command's business, whatever the caller passed.
 */
export function assertRemovable(path, root) {
  const target = resolve(path)
  const within = relative(resolve(root), target)
  if (within === '' || within.startsWith('..') || within.includes(sep) || within.startsWith(sep)) {
    fail(`refusing to remove ${target}: not a direct member of ${root}`)
  }
  return target
}

function git(cwd, args) {
  execFileSync('git', args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: FIXED_DATE,
      GIT_COMMITTER_DATE: FIXED_DATE,
      // A fixture must not inherit the human's signing config; a prompt here hangs the agent.
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
    },
  })
}

const write = (root, relativePath, contents) => {
  const target = join(root, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, contents)
}

const commit = (root, message) => git(root, [...AUTHOR, 'commit', '-m', message])

const commitAll = (root, message) => {
  git(root, ['add', '-A'])
  commit(root, message)
}

function baseRepo(root, slug, shape) {
  mkdirSync(root, { recursive: true })
  git(root, ['init', '-b', 'main'])
  write(
    root,
    'README.md',
    `# ${slug}\n\nDisposable Porcelain fixture (shape: ${shape}). Anything here may be deleted.\n`,
  )
  write(root, '.gitignore', 'node_modules/\n')
  write(root, 'src/greeting.ts', "export const greeting = 'hello porcelain'\n")
  commitAll(root, 'chore: initialize playground')
}

/**
 * Each shape exists to make one Porcelain surface exercisable. Adding a shape means naming
 * the surface it unlocks — a fixture nothing reviews is a fixture nobody needs.
 */
export const SHAPES = {
  clean: {
    summary: 'committed tree, nothing pending — add/remove project, switcher, empty states',
    build: () => {},
  },
  dirty: {
    summary: 'unstaged edits and an untracked file — Changes tab, working-tree diff',
    build: (root) => {
      write(root, 'src/greeting.ts', "export const greeting = 'hello, reviewer'\n")
      write(root, 'src/pending.ts', 'export const pending = true\n')
    },
  },
  staged: {
    summary: 'staged and unstaged edits to the same tree — the staged/unstaged split',
    build: (root) => {
      write(root, 'src/staged.ts', 'export const staged = true\n')
      git(root, ['add', 'src/staged.ts'])
      write(root, 'src/greeting.ts', "export const greeting = 'hello again'\n")
    },
  },
  conflicted: {
    summary: 'a merge stopped mid-conflict — conflict surfaces and resolution',
    build: (root) => {
      git(root, ['checkout', '-b', 'feature'])
      write(root, 'src/greeting.ts', "export const greeting = 'hello from feature'\n")
      commitAll(root, 'feat: greet from feature')
      git(root, ['checkout', 'main'])
      write(root, 'src/greeting.ts', "export const greeting = 'hello from main'\n")
      commitAll(root, 'feat: greet from main')
      try {
        git(root, ['merge', 'feature'])
      } catch {
        // The stopped merge IS the fixture; a clean merge here would mean the shape failed.
        return
      }
      fail('conflicted shape produced a clean merge — fixture generation is wrong')
    },
  },
  history: {
    summary: 'many commits across branches — Process and Execution tabs, log-driven views',
    build: (root) => {
      for (let index = 1; index <= 12; index += 1) {
        write(root, `src/step-${index}.ts`, `export const step${index} = ${index}\n`)
        commitAll(root, `feat: add step ${index}`)
      }
      git(root, ['checkout', '-b', 'work/in-progress'])
      write(root, 'src/step-13.ts', 'export const step13 = 13\n')
      commitAll(root, 'feat: add step 13')
      git(root, ['checkout', 'main'])
    },
  },
  monorepo: {
    summary: 'nested workspace packages — deep file trees and path handling',
    build: (root) => {
      write(
        root,
        'package.json',
        `${JSON.stringify({ name: 'fixture', private: true }, null, 2)}\n`,
      )
      write(root, 'pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n  - 'apps/*'\n")
      for (const pkg of ['packages/core', 'packages/ui', 'apps/web']) {
        write(root, `${pkg}/package.json`, `${JSON.stringify({ name: basename(pkg) }, null, 2)}\n`)
        write(root, `${pkg}/src/index.ts`, `export const name = '${basename(pkg)}'\n`)
      }
      commitAll(root, 'chore: lay out workspace packages')
    },
  },
  worktrees: {
    summary: 'a repository with its own linked worktrees — Hub Worktrees surfaces',
    build: (root) => {
      git(root, ['branch', 'work/alpha'])
      git(root, ['worktree', 'add', join(root, '..', `${basename(root)}-alpha`), 'work/alpha'])
    },
  },
}

export function createPlayground(shape, slug, playground = DEV_PLAYGROUND, profile = DEV_PROFILE) {
  const definition = SHAPES[shape]
  if (definition === undefined) {
    fail(`unknown shape: ${shape} (known: ${Object.keys(SHAPES).join(', ')})`)
  }
  const path = fleetMemberPath(slug, playground, profile)
  if (existsSync(path)) fail(`playground already exists: ${path}`)
  try {
    baseRepo(path, slug, shape)
    definition.build(path)
  } catch (error) {
    // A half-built fixture is worse than none: it registers, opens, and lies about its shape.
    rmSync(path, { recursive: true, force: true })
    throw error
  }
  return path
}

export function listPlaygrounds(playground = DEV_PLAYGROUND, profile = DEV_PROFILE) {
  const root = fleetRoot(playground, profile)
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ slug: entry.name, path: join(root, entry.name) }))
    .sort((left, right) => left.slug.localeCompare(right.slug))
}

export function removePlayground(slug, playground = DEV_PLAYGROUND, profile = DEV_PROFILE) {
  const root = fleetRoot(playground, profile)
  const path = assertRemovable(fleetMemberPath(slug, playground, profile), root)
  if (!existsSync(path)) fail(`no playground named ${slug} in ${root}`)
  // A `worktrees` fixture leaves a sibling checkout; it is inside the same fleet root.
  const sibling = join(root, `${slug}-alpha`)
  if (existsSync(sibling)) rmSync(assertRemovable(sibling, root), { recursive: true, force: true })
  rmSync(path, { recursive: true, force: true })
  return path
}

const HELP = `Porcelain playground fleet — disposable dev fixtures (never a real checkout)

Usage:
  pnpm playground new <shape> [--name <slug>]
  pnpm playground list
  pnpm playground rm <slug>
  pnpm playground reset <slug>
  pnpm playground shapes

Shapes:
${Object.entries(SHAPES)
  .map(([name, { summary }]) => `  ${name.padEnd(12)}${summary}`)
  .join('\n')}
`

function shapeOf(slug) {
  return Object.keys(SHAPES).find((shape) => slug === shape || slug.startsWith(`${shape}-`))
}

function main(argv) {
  const [command, ...rest] = argv
  const positional = []
  let name = null
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--name') {
      name = rest[i + 1] ?? fail('--name requires a value')
      i += 1
      continue
    }
    positional.push(rest[i])
  }

  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(HELP)
    return
  }
  if (command === 'shapes') {
    process.stdout.write(HELP.slice(HELP.indexOf('Shapes:')))
    return
  }
  if (command === 'list') {
    const members = listPlaygrounds()
    if (members.length === 0) {
      process.stdout.write(
        `no playgrounds yet in ${fleetRoot()}\n  create one: pnpm playground new dirty\n`,
      )
      return
    }
    process.stdout.write(
      `${members.map(({ slug, path }) => `${slug.padEnd(20)}${path}`).join('\n')}\n`,
    )
    return
  }
  if (command === 'new') {
    const shape = positional[0] ?? fail(`new requires a shape (${Object.keys(SHAPES).join(', ')})`)
    const path = createPlayground(shape, name ?? shape)
    process.stdout.write(`${path}\n`)
    return
  }
  if (command === 'rm') {
    const slug = positional[0] ?? fail('rm requires a playground name')
    process.stdout.write(`removed ${removePlayground(slug)}\n`)
    return
  }
  if (command === 'reset') {
    const slug = positional[0] ?? fail('reset requires a playground name')
    const shape =
      shapeOf(slug) ?? fail(`cannot infer a shape from ${slug}; recreate it with \`new\``)
    removePlayground(slug)
    process.stdout.write(`${createPlayground(shape, slug)}\n`)
    return
  }
  fail(`unknown command: ${command}\n\n${HELP}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(`[playground] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

export { PlaygroundError }
