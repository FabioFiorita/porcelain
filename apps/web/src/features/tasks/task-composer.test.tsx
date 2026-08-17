import { TestIds } from '@shared/test-ids'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { emptyComposerValue, fileToUpload, TaskComposer } from './task-composer'
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
