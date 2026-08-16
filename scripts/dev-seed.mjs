#!/usr/bin/env node
/**
 * Seed the DEV daemon with state worth looking at.
 *
 * An empty database is a bad test. Porcelain is a review layer, and until now every session
 * started with nothing to review: an agent built a Canvas, a Task and a diff by hand before
 * it could see the surface it had just changed, and threw all of it away at the end.
 *
 * Everything here is written through the **shipped CLI** — the same commands an agent runs.
 * State produced by the real commands is state the product can actually reach; direct store
 * writes would prove nothing and rot the moment a store changes. Reads go through the
 * daemon's typed procedures (dev-daemon-client.mjs), never by parsing CLI prose.
 *
 * Re-running is safe: seeded Tasks carry a tag and are removed first, seeded Actions and
 * Canvases are matched by title and replaced, and a Review set is a replace by definition.
 *
 * Usage:
 *   pnpm dev:seed                 # the default scenario
 *   pnpm dev:seed one-review
 *   pnpm dev:seed busy
 *   pnpm dev:seed evidence-heavy
 *   pnpm dev:seed everything      # every shape registered, every surface carrying state
 *   pnpm dev:seed empty           # strip seeded state and land on Welcome
 *   pnpm dev:seed --list
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { adminMutation, adminQuery, assertDaemonReachable } from './dev-daemon-client.mjs'
import { devEnv } from './dev-env.mjs'
import { createPlayground, fleetMemberPath, SHAPES } from './playground.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = join(root, 'apps', 'desktop', 'out', 'main', 'cli', 'porcelain.js')

/** Marks everything this seeder owns, so a re-run can take it back without touching anything else. */
const SEED_TAG = 'dev-seed'

function fail(message) {
  throw new Error(message)
}

function porcelain(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    env: devEnv(),
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    fail(`porcelain ${args.join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return result.stdout
}

/** A fleet playground for this shape, created on demand so seeding never needs a setup step. */
function playground(shape) {
  const path = fleetMemberPath(shape)
  if (!existsSync(path)) createPlayground(shape, shape)
  return path
}

async function registerProject(path) {
  const info = await adminMutation('openRepoPath', path)
  return info
}

async function projectIdFor(path) {
  const inventory = await adminQuery('hubInventory', undefined)
  const project = inventory.projects.find((candidate) => candidate.path === path)
  // Seeding that quietly writes nothing is worse than seeding that fails: the surface then
  // looks empty for a reason nobody can see.
  if (project === undefined) fail(`no Hub project for ${path} — registration did not take`)
  return project.id
}

/**
 * Remove what a previous run left behind. Seeded Tasks are tagged; Actions and Canvases are
 * matched by the exact titles this file writes, so a Task or Action the human added by hand
 * is never in scope.
 */
async function purgeSeeded(titles) {
  const tasks = await adminQuery('listTasks')
  for (const task of tasks) {
    if (task.tags?.includes(SEED_TAG)) await adminMutation('deleteTask', { taskId: task.id })
  }
  const inventory = await adminQuery('hubInventory', undefined)
  for (const project of inventory.projects) {
    const actions = await adminQuery('actions', { projectId: project.id })
    for (const action of actions) {
      if (titles.actions.has(action.title)) {
        await adminMutation('deleteAction', { projectId: project.id, id: action.id })
      }
    }
  }
}

async function seedTask(fields) {
  await adminMutation('createTask', { ...fields, tags: [...(fields.tags ?? []), SEED_TAG] })
}

async function seedAction(projectId, title, command) {
  await adminMutation('addAction', { projectId, title, command })
}

function seedReview(repo, review) {
  porcelain([
    'review',
    'set',
    '--repo',
    repo,
    '--name',
    review.name,
    '--thesis',
    review.thesis,
    '--files',
    JSON.stringify(review.files),
    '--sections',
    JSON.stringify(review.sections),
  ])
}

/** The gallery a seeded Evidence Canvas carries — three shots so a row has something to wrap. */
const GALLERY = [
  { file: 'shot-wide.png', alt: 'The Review, four tabs', width: 320, height: 160 },
  { file: 'shot-tall.png', alt: 'The Changes tab', width: 160, height: 240 },
  { file: 'shot-square.png', alt: 'The Evidence checks', width: 200, height: 200 },
]

/**
 * Evidence is a Canvas bundle, so it needs real files on disk. Written to a temp directory
 * the daemon copies from, then removed — the bundle lives in daemon-root state afterwards.
 */
async function seedEvidenceCanvas(repo, title) {
  // `canvas set` creates without --id and replaces with it, so a re-run would otherwise
  // stack a second Canvas under the same title.
  const projectId = await projectIdFor(repo)
  const existing = await adminQuery('listCanvases', { projectId })
  const previous = existing.find((canvas) => canvas.title === title)
  const source = mkdtempSync(join(tmpdir(), 'porcelain-seed-evidence-'))
  try {
    mkdirSync(join(source, 'assets'), { recursive: true })
    // 1x1 PNGs at three declared sizes: one image cannot show how the gallery lays a row out.
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    for (const shot of GALLERY) writeFileSync(join(source, 'assets', shot.file), pixel)
    writeFileSync(
      join(source, 'index.html'),
      `<!doctype html>
<meta charset="utf-8">
<title>${title}</title>
<h1>${title}</h1>
<h2>Checks</h2>
<ul>
  <li>lint — pass</li>
  <li>unit (3107) — pass</li>
  <li>browser e2e (32) — pass</li>
</ul>
<h2>Results</h2>
<p>The seeded run closed its loop: every check above ran against this fixture.</p>
<h2>Gallery</h2>
${GALLERY.map(
  (shot) =>
    `<img src="assets/${shot.file}" alt="${shot.alt}" width="${shot.width}" height="${shot.height}">`,
).join('\n')}
`,
    )
    porcelain([
      'canvas',
      'set',
      '--repo',
      repo,
      '--title',
      title,
      '--kind',
      'html',
      '--source-dir',
      source,
      '--entry',
      'index.html',
      ...(previous === undefined ? [] : ['--id', previous.id]),
    ])
  } finally {
    rmSync(source, { recursive: true, force: true })
  }
}

const REVIEW = {
  name: 'Playground review',
  thesis:
    'A seeded Review so the four tabs have something to render. Intent states the change, ' +
    'Process walks the files in flow order, Execution shows the diff, Evidence carries the proof.',
  files: [
    {
      path: 'src/greeting.ts',
      source: 'changed',
      note: 'The entry point the walkthrough opens on',
    },
    { path: 'README.md', source: 'context', note: 'Why this fixture exists' },
  ],
  sections: [
    {
      title: 'Intent',
      prose: 'Change the greeting so the Changes tab has a diff worth reading.',
      anchors: [{ path: 'src/greeting.ts', startLine: 1, endLine: 1 }],
    },
    {
      title: 'Walkthrough',
      prose:
        'One exported constant, one caller. The flow is deliberately short so the surface, not the fixture, is what you end up reading.',
    },
  ],
}

/** A Review against a deep tree: the two-file fixture proves nothing about path handling. */
const WORKSPACE_REVIEW = {
  name: 'Workspace review',
  thesis:
    'The same Review shape against nested workspace packages, so file rows, path elision and ' +
    'the walkthrough are read against a tree deeper than one src/ directory.',
  files: [
    {
      path: 'packages/core/src/index.ts',
      source: 'context',
      note: 'The package everything imports',
    },
    { path: 'packages/ui/src/index.ts', source: 'context', note: 'The rendering layer' },
    { path: 'apps/web/src/index.ts', source: 'context', note: 'The consumer' },
    { path: 'pnpm-workspace.yaml', source: 'context', note: 'What makes these one workspace' },
  ],
  sections: [
    {
      title: 'Intent',
      prose: 'Read one exported name through three packages without leaving the Review.',
      anchors: [{ path: 'packages/core/src/index.ts', startLine: 1, endLine: 1 }],
    },
    {
      title: 'Walkthrough',
      prose:
        'core declares the name, ui re-declares its own, web consumes. Deliberately shallow logic — the tree, not the code, is the fixture.',
      anchors: [{ path: 'apps/web/src/index.ts', startLine: 1, endLine: 1 }],
    },
  ],
}

/**
 * One list drives both writing and purging. Keeping the purge set separate invited the drift
 * where a new Action is seeded but never reclaimed, so every re-run stacks another copy.
 */
const SEEDED_ACTIONS = [
  { title: 'Run the fixture tests', command: 'echo "no tests in a fixture" && exit 0' },
  { title: 'Show the working tree', command: 'git status --short' },
  { title: 'Read the last five commits', command: 'git log --oneline -5' },
  { title: 'Fail on purpose', command: 'echo "this action is meant to fail" && exit 3' },
]
const SEEDED_ACTION_TITLES = new Set(SEEDED_ACTIONS.map((action) => action.title))

/**
 * Which Review lands on which shape, and which paths each project pins and hides. Declared
 * rather than inlined because every path here must exist in that shape's fixture: a pin or
 * an anchor pointed at a file the shape never writes fails silently — the surface renders,
 * just without the state the seed claims to have made. `dev-seed.test.mjs` builds the
 * shapes and checks each path.
 */
const SEEDED_REVIEWS = [
  { shape: 'dirty', title: 'Seeded evidence', review: REVIEW },
  { shape: 'monorepo', title: 'Workspace evidence', review: WORKSPACE_REVIEW },
]
const SEEDED_SCOPES = [
  { shape: 'dirty', pinned: ['src/greeting.ts'], hidden: ['.gitignore'] },
  {
    shape: 'monorepo',
    pinned: ['packages/core/src/index.ts', 'pnpm-workspace.yaml'],
    hidden: ['package.json'],
  },
]
/** Shapes that carry the saved Actions — more than one, so the list is not a single-project surface. */
const ACTION_SHAPES = ['dirty', 'monorepo', 'history']

/**
 * Pin and hide real paths so a project's file scope is not its default shape. Both writes
 * are set-valued on the daemon side, so a re-run lands on the same scope rather than
 * stacking — nothing here needs reclaiming by the purge.
 */
async function seedScope(repo, { pinned = [], hidden = [] }) {
  for (const path of pinned) await adminMutation('pinPath', { repoPath: repo, path })
  for (const path of hidden) await adminMutation('hidePath', { repoPath: repo, path })
}

async function seedActionsFor(path) {
  const projectId = await projectIdFor(path)
  for (const { title, command } of SEEDED_ACTIONS) await seedAction(projectId, title, command)
}

const SCENARIOS = {
  empty: {
    summary: 'no projects, no Tasks — the Welcome screen',
    run: async () => {
      const recents = await adminQuery('recentRepos', undefined)
      for (const project of recents) {
        await adminMutation('removeRecentRepo', project.path)
      }
      const inventory = await adminQuery('hubInventory', undefined)
      for (const project of inventory.projects) {
        await adminMutation('removeHubProject', { projectId: project.id })
      }
    },
  },
  'one-review': {
    summary: 'one project with a dirty tree, a Review across all four tabs, a few Tasks',
    run: async () => {
      const repo = playground('dirty')
      await registerProject(repo)
      seedReview(repo, REVIEW)
      await seedActionsFor(repo)
      await seedTask({ title: 'Read the seeded Review', status: 'doing' })
      await seedTask({ title: 'Check the Changes tab against git status', status: 'todo' })
      await seedTask({ title: 'Confirm the walkthrough anchors resolve', status: 'done' })
    },
  },
  busy: {
    summary: 'four projects in different shapes, Tasks in every status, Actions, one Review',
    run: async () => {
      for (const shape of ['clean', 'dirty', 'staged', 'history']) {
        await registerProject(playground(shape))
      }
      const reviewed = playground('dirty')
      seedReview(reviewed, REVIEW)
      await seedActionsFor(reviewed)
      await seedTask({ title: 'Switch between the four projects', status: 'doing' })
      await seedTask({ title: 'Open the staged fixture and read the split', status: 'todo' })
      await seedTask({ title: 'Resolve the conflicted fixture', status: 'blocked' })
      await seedTask({ title: 'Walk the deep history', status: 'todo' })
      await seedTask({ title: 'Register a second project', status: 'done' })
    },
  },
  'evidence-heavy': {
    summary: 'one project whose Review carries checks, results prose, and a gallery image',
    run: async () => {
      const repo = playground('dirty')
      await registerProject(repo)
      seedReview(repo, REVIEW)
      await seedEvidenceCanvas(repo, 'Seeded evidence')
      await seedTask({ title: 'Read the Evidence tab', status: 'doing' })
    },
  },
  everything: {
    summary: 'every shape registered, two Reviews, Evidence, Tasks in every status, pins and hides',
    run: async () => {
      // Every shape, so no surface is empty for want of a fixture: the switcher has eight
      // rows, Worktrees has a linked checkout, and the deep tree has somewhere to go.
      const repos = {}
      for (const shape of Object.keys(SHAPES)) {
        repos[shape] = playground(shape)
        await registerProject(repos[shape])
      }

      for (const { shape, title, review } of SEEDED_REVIEWS) {
        seedReview(repos[shape], review)
        await seedEvidenceCanvas(repos[shape], title)
      }
      for (const shape of ACTION_SHAPES) await seedActionsFor(repos[shape])
      // Pins and hides are per-project file scope: without them the tree only ever renders
      // its default shape, and the pinned well never appears.
      for (const scope of SEEDED_SCOPES) await seedScope(repos[scope.shape], scope)

      const dirtyId = await projectIdFor(repos.dirty)
      const monorepoId = await projectIdFor(repos.monorepo)
      await seedTask({
        title: 'Read the seeded Review end to end',
        status: 'doing',
        notes: 'Intent → Process → Execution → Evidence. Every tab should carry something.',
        tags: ['review'],
        references: { projectId: dirtyId },
      })
      await seedTask({
        title: 'Compare the workspace Review against the deep tree',
        status: 'todo',
        tags: ['review', 'monorepo'],
        references: { projectId: monorepoId },
      })
      await seedTask({
        title: 'Resolve the conflicted fixture',
        status: 'blocked',
        notes: 'The merge is stopped on purpose — this is the conflict surface fixture.',
        tags: ['git'],
      })
      await seedTask({
        title: 'Open the staged fixture and read the split',
        status: 'todo',
        tags: ['git', 'diff'],
      })
      await seedTask({
        title: 'Walk the deep history',
        status: 'todo',
        links: [{ url: 'https://git-scm.com/docs/git-log', label: 'git log' }],
      })
      await seedTask({ title: 'Register every playground shape', status: 'done', tags: ['setup'] })
    },
  },
}

const HELP = `Porcelain dev seeding — state worth looking at, written through the shipped CLI

Usage:
  pnpm dev:seed [scenario]

Scenarios:
${Object.entries(SCENARIOS)
  .map(([name, { summary }]) => `  ${name.padEnd(16)}${summary}`)
  .join('\n')}

Re-running is safe: seeded Tasks are tagged \`${SEED_TAG}\` and removed first; Reviews and
Canvases are replaced by title. Needs a running dev daemon (pnpm dev:daemon).
`

async function main(argv) {
  const [name = 'one-review'] = argv
  if (name === '--help' || name === '-h' || name === 'help' || name === '--list') {
    process.stdout.write(HELP)
    return
  }
  const scenario = SCENARIOS[name]
  if (scenario === undefined) {
    fail(`unknown scenario: ${name} (known: ${Object.keys(SCENARIOS).join(', ')})`)
  }
  if (!existsSync(cli)) fail(`${cli} missing — run \`pnpm build\` first`)

  await assertDaemonReachable()
  await purgeSeeded({ actions: SEEDED_ACTION_TITLES })
  await scenario.run()

  const tasks = await adminQuery('listTasks')
  const recents = await adminQuery('recentRepos', undefined)
  process.stdout.write(
    `seeded "${name}"\n` +
      `  projects  ${recents.length === 0 ? '(none — Welcome)' : recents.map((p) => p.name).join(', ')}\n` +
      `  tasks     ${tasks.length}\n`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`[dev:seed] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}

export {
  ACTION_SHAPES,
  SCENARIOS,
  SEED_TAG,
  SEEDED_ACTION_TITLES,
  SEEDED_ACTIONS,
  SEEDED_REVIEWS,
  SEEDED_SCOPES,
}
