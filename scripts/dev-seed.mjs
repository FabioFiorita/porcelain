#!/usr/bin/env node
/** Create sample projects and collaboration data in the active development profile. */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { adminMutation, adminQuery, assertDaemonReachable } from './dev-daemon-client.mjs'
import { devEnv } from './dev-env.mjs'
import { createPlayground, fleetMemberPath, SHAPES } from './playground.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const connector = join(root, 'plugins/porcelain/bin/porcelain-mcp.mjs')

function fail(message) {
  throw new Error(message)
}
export function canvasCall(input, env = devEnv()) {
  const result = spawnSync(process.execPath, [connector], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 15000,
    input: `${JSON.stringify({
      jsonrpc: '2.0',
      id: 'seed',
      method: 'tools/call',
      params: {
        name: 'porcelain_canvas',
        arguments: input,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    })}\n`,
  })
  if (result.error) throw result.error
  if (result.status !== 0) fail(result.stderr || 'Canvas connector failed')
  const reply = JSON.parse(result.stdout)
  if (reply.error || reply.result?.isError || !reply.result) fail(JSON.stringify(reply))
  return reply.result
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

/** Limit cleanup to the named sample projects in this development profile. */
export function isSeedProject(path) {
  return Object.keys(SHAPES).some((shape) => resolve(path) === resolve(fleetMemberPath(shape)))
}

export async function purgeSeeded(titles, query = adminQuery, mutate = adminMutation) {
  const inventory = await query('hubInventory', undefined)
  for (const project of inventory.projects) {
    if (!isSeedProject(project.path)) continue
    const actions = await query('actions', { projectId: project.id })
    for (const action of actions) {
      if (
        titles.actions.has(action.title) &&
        SEEDED_ACTIONS.some(
          (seed) => seed.title === action.title && seed.command === action.command,
        )
      ) {
        await mutate('deleteAction', { projectId: project.id, id: action.id })
      }
    }
  }
}

async function seedAction(projectId, title, command) {
  await adminMutation('addAction', { projectId, title, command })
}
async function seedReview(repo, review) {
  const projectId = await projectIdFor(repo)
  const existing = await adminQuery('listCanvases', { projectId })
  const previous = existing.find((canvas) => canvas.title === review.name)
  canvasCall(reviewCanvasInput(repo, review, previous))
}

export function reviewCanvasInput(repo, review, previous) {
  return {
    workspace: repo,
    op: previous ? 'update' : 'create',
    ...(previous ? { id: previous.id } : {}),
    template: 'review',
    templateData: {
      title: review.name,
      summary: review.thesis,
      sections: review.sections.map(({ title, prose, anchors }) => ({
        title,
        prose,
        ...(anchors ? { references: anchors } : {}),
      })),
      layers: [{ label: 'Sample changes', pattern: '.*' }],
      files: review.files.map(({ path, note }) => ({ path, layer: 'Sample changes', note })),
    },
  }
}

/** The gallery a seeded Evidence Canvas carries — three shots so a row has something to wrap. */
const GALLERY = [
  { file: 'shot-wide.png', alt: 'Wide placeholder image', width: 320, height: 160 },
  { file: 'shot-tall.png', alt: 'Tall placeholder image', width: 160, height: 240 },
  { file: 'shot-square.png', alt: 'Square placeholder image', width: 200, height: 200 },
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
  <li>Sample check — not executed</li>
</ul>
<h2>Results</h2>
<p>Demonstration content only. No checks were run and the images below are placeholders.</p>
<h2>Gallery</h2>
${GALLERY.map(
  (shot) =>
    `<img src="assets/${shot.file}" alt="${shot.alt}" width="${shot.width}" height="${shot.height}">`,
).join('\n')}
`,
    )
    canvasCall({
      workspace: repo,
      op: previous ? 'update' : 'create',
      ...(previous ? { id: previous.id } : {}),
      title,
      kind: 'html',
      sourceDir: source,
      entry: 'index.html',
    })
  } finally {
    rmSync(source, { recursive: true, force: true })
  }
}

const REVIEW = {
  name: 'Playground review',
  thesis: 'Sample review of a changed greeting, with source context and a short explanation.',
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

export async function clearSeededProjects(query = adminQuery, mutate = adminMutation) {
  const recents = await query('recentRepos', undefined)
  for (const project of recents) {
    if (!isSeedProject(project.path)) continue
    await mutate('removeRecentRepo', project.path)
  }
  const inventory = await query('hubInventory', undefined)
  for (const project of inventory.projects) {
    if (!isSeedProject(project.path)) continue
    await mutate('removeHubProject', { projectId: project.id })
  }
}

const SCENARIOS = {
  empty: {
    summary: 'remove seeded projects from navigation; preserve other projects',
    run: clearSeededProjects,
  },
  'one-review': {
    summary: 'one project with working changes, a sample review, and Actions',
    run: async () => {
      const repo = playground('dirty')
      await registerProject(repo)
      await seedReview(repo, REVIEW)
      await seedActionsFor(repo)
    },
  },
  busy: {
    summary: 'four projects in different shapes, Actions, one Review',
    run: async () => {
      for (const shape of ['clean', 'dirty', 'staged', 'history']) {
        await registerProject(playground(shape))
      }
      const reviewed = playground('dirty')
      await seedReview(reviewed, REVIEW)
      await seedActionsFor(reviewed)
    },
  },
  'evidence-heavy': {
    summary: 'one project whose Review carries checks, results prose, and a gallery image',
    run: async () => {
      const repo = playground('dirty')
      await registerProject(repo)
      await seedReview(repo, REVIEW)
      await seedEvidenceCanvas(repo, 'Seeded evidence')
    },
  },
  everything: {
    summary: 'every shape registered, two Reviews, Evidence, pins and hides',
    run: async () => {
      // Every shape, so no surface is empty for want of a fixture: the switcher has eight
      // rows, Worktrees has a linked checkout, and the deep tree has somewhere to go.
      const repos = {}
      for (const shape of Object.keys(SHAPES)) {
        repos[shape] = playground(shape)
        await registerProject(repos[shape])
      }

      for (const { shape, title, review } of SEEDED_REVIEWS) {
        await seedReview(repos[shape], review)
        await seedEvidenceCanvas(repos[shape], title)
      }
      for (const shape of ACTION_SHAPES) await seedActionsFor(repos[shape])
      // Pins and hides are per-project file scope: without them the tree only ever renders
      // its default shape, and the pinned well never appears.
      for (const scope of SEEDED_SCOPES) await seedScope(repos[scope.shape], scope)
    },
  },
}

const HELP = `Porcelain dev seeding — state worth looking at, written through the daemon and shipped MCP connector

Usage:
  pnpm dev:seed [scenario]

Scenarios:
${Object.entries(SCENARIOS)
  .map(([name, { summary }]) => `  ${name.padEnd(16)}${summary}`)
  .join('\n')}

Re-running replaces matching sample data only in the named seed projects. Needs a
running dev daemon (pnpm dev:daemon).
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

  await assertDaemonReachable()
  await purgeSeeded({ actions: SEEDED_ACTION_TITLES })
  await scenario.run()

  const recents = await adminQuery('recentRepos', undefined)
  process.stdout.write(
    `seeded "${name}"\n` +
      `  projects  ${recents.length === 0 ? '(none — Welcome)' : recents.map((p) => p.name).join(', ')}\n`,
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
  SEEDED_ACTION_TITLES,
  SEEDED_ACTIONS,
  SEEDED_REVIEWS,
  SEEDED_SCOPES,
}
