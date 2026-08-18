// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, parse } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createNodeProjectsPort } from './projects-ports'

let directory = ''
const projects = createNodeProjectsPort()
const devProjects = createNodeProjectsPort({ showHidden: true })

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'porcelain-projects-port-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('ProjectsPort filesystem adapter', () => {
  it('inspects an existing directory as a Project and rejects files', async () => {
    const project = join(directory, 'alpha')
    const file = join(directory, 'readme.md')
    await mkdir(project)
    await writeFile(file, '# alpha\n', 'utf8')

    expect(await projects.inspectProject(project)).toEqual({
      ok: true,
      value: { path: project, name: 'alpha' },
    })
    expect(await projects.inspectProject(file)).toEqual({
      ok: false,
      error: 'not-a-directory',
    })
  })

  it('maps a missing Project path to not-found', async () => {
    expect(await projects.inspectProject(join(directory, 'missing'))).toEqual({
      ok: false,
      error: 'not-found',
    })
  })

  it('lists directories only and hides dot-directories and files', async () => {
    await mkdir(join(directory, 'visible'))
    await mkdir(join(directory, '.hidden'))
    await writeFile(join(directory, 'file.txt'), '', 'utf8')

    const result = await projects.browseDirectories(directory)
    expect(result).toEqual({
      ok: true,
      value: {
        path: directory,
        parent: dirname(directory),
        entries: [{ name: 'visible', path: join(directory, 'visible'), isRepo: false }],
      },
    })
  })

  it('shows dot-directories when the port opts into showHidden (dev daemon)', async () => {
    await mkdir(join(directory, 'visible'))
    await mkdir(join(directory, '.fleet'))

    const result = await devProjects.browseDirectories(directory)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.entries.map((entry) => entry.name)).toEqual(['.fleet', 'visible'])
  })

  it('flags both .git directories and .git files as repositories', async () => {
    await mkdir(join(directory, 'checkout', '.git'), { recursive: true })
    await mkdir(join(directory, 'worktree'))
    await writeFile(join(directory, 'worktree', '.git'), 'gitdir: /elsewhere\n', 'utf8')

    const result = await projects.browseDirectories(directory)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(new Map(result.value.entries.map((entry) => [entry.name, entry.isRepo]))).toEqual(
      new Map([
        ['checkout', true],
        ['worktree', true],
      ]),
    )
  })

  it('sorts entries with accent-sensitive locale comparison', async () => {
    for (const name of ['Banana', 'apple', 'Cherry']) await mkdir(join(directory, name))
    const result = await projects.browseDirectories(directory)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.entries.map((entry) => entry.name)).toEqual(['apple', 'Banana', 'Cherry'])
  })

  it('reports the parent and null at the filesystem root', async () => {
    const child = join(directory, 'child')
    await mkdir(child)
    const childResult = await projects.browseDirectories(child)
    expect(childResult.ok).toBe(true)
    if (!childResult.ok) return
    expect(childResult.value.parent).toBe(directory)

    const rootResult = await projects.browseDirectories(parse(directory).root)
    expect(rootResult.ok).toBe(true)
    if (!rootResult.ok) return
    expect(rootResult.value.parent).toBeNull()
  })

  it('defaults a nullable browse root to the daemon home', async () => {
    const result = await projects.browseDirectories(null)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.path).toBe(homedir())
    expect(result.value.parent).toBe(dirname(homedir()) === homedir() ? null : dirname(homedir()))
  })

  it('maps missing and non-directory browse roots', async () => {
    const missing = await projects.browseDirectories(join(directory, 'missing'))
    expect(missing).toEqual({ ok: false, error: 'not-found' })

    const file = join(directory, 'file.txt')
    await writeFile(file, '', 'utf8')
    expect(await projects.browseDirectories(file)).toEqual({
      ok: false,
      error: 'not-a-directory',
    })

    expect(await projects.inspectProject(`${directory}\u0000`)).toEqual({
      ok: false,
      error: 'unavailable',
    })
  })
})
