import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { useCreateFile, useCreateFolder, useRenamePath } from '@renderer/hooks/use-files'
import { type FilePromptKind, useFilePromptStore } from '@renderer/stores/file-prompt'
import { useState } from 'react'

const TITLE = { 'new-file': 'New file', 'new-folder': 'New folder', rename: 'Rename' } as const

function parentDir(path: string): string {
  return path.slice(0, path.lastIndexOf('/'))
}

/**
 * The name-prompt for the file tree (new file / new folder / rename), driven by the
 * file-prompt store and mounted once in AppShell. Each op surfaces its own conflict
 * error (the main process refuses to clobber) instead of failing silently.
 *
 * The actual dialog is keyed by `openSeq` and only mounted while a prompt is active, so
 * every open is a fresh instance — see the store for why (a reopen race otherwise reset
 * the input and dropped the submit).
 */
export function FilePromptDialog(): React.JSX.Element | null {
  const kind = useFilePromptStore((s) => s.kind)
  const openSeq = useFilePromptStore((s) => s.openSeq)
  const dir = useFilePromptStore((s) => s.dir)
  const target = useFilePromptStore((s) => s.target)
  const initialName = useFilePromptStore((s) => s.initialName)
  const close = useFilePromptStore((s) => s.close)

  if (kind === null) return null
  return (
    <FilePrompt
      key={openSeq}
      kind={kind}
      dir={dir}
      target={target}
      initialName={initialName}
      onClose={close}
    />
  )
}

function FilePrompt({
  kind,
  dir,
  target,
  initialName,
  onClose,
}: {
  kind: FilePromptKind
  dir: string
  target: string
  initialName: string
  onClose: () => void
}): React.JSX.Element {
  const { create: createFile } = useCreateFile()
  const { create: createFolder } = useCreateFolder()
  const { rename } = useRenamePath()
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    const trimmed = name.trim()
    if (trimmed === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      if (kind === 'new-file') await createFile(`${dir}/${trimmed}`)
      else if (kind === 'new-folder') await createFolder(`${dir}/${trimmed}`)
      else await rename(target, `${parentDir(target)}/${trimmed}`)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete that')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLE[kind]}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              await submit()
            }
          }}
          placeholder={kind === 'new-folder' ? 'Folder name' : 'File name'}
          aria-label="Name"
          className="rounded-md"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={name.trim() === '' || busy} onClick={submit}>
            {kind === 'rename' ? 'Rename' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
