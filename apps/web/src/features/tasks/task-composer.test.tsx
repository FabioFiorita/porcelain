import { hubInventorySchema, projectsContractFixtures } from '@porcelain/contracts/projects'
import { TestIds } from '@shared/test-ids'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import {
  emptyComposerValue,
  fileToUpload,
  projectsOnEnvironment,
  TaskComposer,
} from './task-composer'
import { renderTasks } from './test-support'

function Harness(): React.JSX.Element {
  const [value, setValue] = useState(emptyComposerValue())
  return (
    <div>
      <TaskComposer value={value} onChange={setValue} />
      <span data-testid="upload-count">{value.uploads.length}</span>
    </div>
  )
}

describe('TaskComposer', () => {
  it('turns a File into a named base64 upload', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'shot.png', { type: 'image/png' })
    const upload = await fileToUpload(file)
    expect(upload.name).toBe('shot.png')
    expect(upload.contentBase64).toBe(btoa('\u0001\u0002\u0003\u0004'))
    expect(upload.previewUrl).toBe(`data:image/png;base64,${upload.contentBase64}`)
    expect(upload.previewUrl?.startsWith('blob:')).toBe(false)
  })

  it('opens an @ picker from the notes body', async () => {
    renderTasks(<Harness />)
    const notes = screen.getByTestId(TestIds.tasksComposerNotes)
    fireEvent.change(notes, { target: { value: 'see @src', selectionStart: 8 } })
    fireEvent.keyUp(notes, { key: 'c' })
    await waitFor(() =>
      expect(screen.getByTestId(TestIds.tasksComposerFileSearch)).toBeInTheDocument(),
    )
  })

  it('lifts a finished URL out of the body into a chip', async () => {
    renderTasks(<Harness />)
    const notes = screen.getByTestId(TestIds.tasksComposerNotes)
    fireEvent.change(notes, {
      target: { value: 'see https://herdr.dev/ more', selectionStart: 4 },
    })
    await waitFor(() => expect(screen.getByRole('link', { name: 'herdr.dev' })).toBeInTheDocument())
    expect(notes).toHaveValue('see more')
  })

  it('commits `# Title` + Enter to a heading and hides the hash', () => {
    renderTasks(<Harness />)
    const notes = screen.getByTestId(TestIds.tasksComposerNotes)
    fireEvent.change(notes, { target: { value: '# Hello notes', selectionStart: 13 } })
    fireEvent.keyDown(notes, { key: 'Enter' })
    expect(screen.getByTestId(TestIds.tasksComposerMarkdown)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hello notes' })).toBeInTheDocument()
    expect(screen.queryByDisplayValue('# Hello notes')).not.toBeInTheDocument()
    expect(screen.getByTestId(TestIds.tasksComposerNotes)).toHaveValue('')
  })

  it('adds a pasted image as an upload chip', async () => {
    renderTasks(<Harness />)
    const file = new File([new Uint8Array([9, 8, 7])], 'paste.png', { type: 'image/png' })
    fireEvent.paste(screen.getByTestId(TestIds.tasksComposerNotes), {
      clipboardData: { files: [file] },
    })
    await waitFor(() => expect(screen.getByTestId('upload-count')).toHaveTextContent('1'))
    expect(screen.getByTestId(TestIds.tasksComposerPicture('paste.png'))).toBeInTheDocument()
  })
})

const localInventory = hubInventorySchema.parse(projectsContractFixtures.hubInventory.output)
const remoteInventory = hubInventorySchema.parse({
  ...localInventory,
  environment: { ...localInventory.environment, id: 'env-remote', name: 'Beelink (work)' },
  projects: localInventory.projects.map((project) => ({
    ...project,
    id: `remote-${project.id}`,
    name: `remote-${project.name}`,
    environmentId: 'env-remote',
    worktrees: project.worktrees.map((worktree) => ({
      ...worktree,
      id: `remote-${worktree.id}`,
      projectId: `remote-${project.id}`,
    })),
  })),
})

function names(projects: readonly { name: string }[]): string[] {
  return projects.map((project) => project.name)
}

describe('projectsOnEnvironment', () => {
  const inventories = [
    { environmentId: null, current: true, inventory: localInventory },
    { environmentId: 'env-remote', current: false, inventory: remoteInventory },
  ]

  it('gives This device only the Projects on this device', () => {
    expect(names(projectsOnEnvironment(inventories, null))).toEqual(names(localInventory.projects))
  })

  it('gives a named Environment only its own Projects', () => {
    expect(names(projectsOnEnvironment(inventories, 'env-remote'))).toEqual(
      names(remoteInventory.projects),
    )
  })

  /**
   * The Electron shape: the Task target is the shell's saved GROUP id, while every Project in
   * that inventory carries the id its own daemon announced. Filtering on the Project field
   * would return nothing here — and nothing at all for This device, whose target is `null`.
   */
  it('matches the source a Project arrived from, not the id the Project carries', () => {
    const shellSources = [
      { environmentId: null, current: true, inventory: localInventory },
      { environmentId: 'group-7', current: false, inventory: remoteInventory },
    ]
    expect(names(projectsOnEnvironment(shellSources, 'group-7'))).toEqual(
      names(remoteInventory.projects),
    )
    expect(remoteInventory.projects.every((project) => project.environmentId !== 'group-7')).toBe(
      true,
    )
  })

  it('resolves a source still known only by the id its daemon announced', () => {
    const bootstrapping = [
      { environmentId: null, current: true, inventory: localInventory },
      { environmentId: 'connection-secondary', current: false, inventory: remoteInventory },
    ]
    expect(names(projectsOnEnvironment(bootstrapping, 'env-remote'))).toEqual(
      names(remoteInventory.projects),
    )
  })

  it('offers nothing for an Environment that reported no inventory', () => {
    expect(projectsOnEnvironment(inventories, 'env-unknown')).toEqual([])
  })
})
