import { Button } from '@renderer/components/ui/button'
import {
  bindingConflict,
  commandShortcutLabel,
  type FileCommandId,
  fileBinding,
  fileCommands,
  useFileBindings,
} from '@renderer/features/commands/file-command-bindings'
import { useHotkeyRecorder } from '@tanstack/react-hotkeys'
import { useState } from 'react'

export function ShortcutsSection(): React.JSX.Element {
  const overrides = useFileBindings((s) => s.overrides)
  const setBinding = useFileBindings((s) => s.setBinding)
  const reset = useFileBindings((s) => s.reset)
  const [editing, setEditing] = useState<FileCommandId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorder = useHotkeyRecorder({
    onRecord: (hotkey) => {
      if (!editing) return
      const conflict = bindingConflict(editing, hotkey, overrides)
      if (conflict) setError(`Already assigned to ${conflict}. Choose another shortcut.`)
      else {
        setBinding(editing, hotkey)
        setError(null)
      }
      setEditing(null)
    },
    onCancel: () => setEditing(null),
    onClear: () => {
      if (editing) setBinding(editing, null)
      setEditing(null)
    },
  })
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Files shortcuts apply while Files is visible, outside text fields and terminals. Select a
        shortcut to record a replacement. Escape cancels; Backspace clears it.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {(Object.keys(fileCommands) as FileCommandId[]).map((id) => {
        const binding = fileBinding(id, overrides)
        return (
          <div key={id} className="flex items-center justify-between gap-3">
            <span className="text-sm">{fileCommands[id]}</span>
            <Button
              variant="outline"
              size="sm"
              data-testid={`shortcut-${id}`}
              onClick={() => {
                setEditing(id)
                setError(null)
                recorder.startRecording()
              }}
            >
              {editing === id && recorder.isRecording
                ? 'Press shortcut…'
                : binding
                  ? commandShortcutLabel(binding)
                  : 'Not assigned'}
            </Button>
          </div>
        )
      })}
      <Button variant="outline" size="sm" onClick={reset}>
        Restore defaults
      </Button>
    </div>
  )
}
