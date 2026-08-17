import type { HubProject, HubWorktree } from '@porcelain/contracts/projects'
import type { SearchResult } from '@porcelain/contracts/search'
import type { TaskAttachmentUpload, TaskLink, TaskPathRef } from '@porcelain/contracts/tasks'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useHubInventories } from '@renderer/features/projects'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { compactInputClass } from '@renderer/lib/controls'
import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useQuery } from '@tanstack/react-query'
import { Paperclip } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { textareaCaretOffset } from './task-caret'
import { TaskComposerChips, TaskComposerPictures } from './task-composer-chips'
import { TaskComposerMentions } from './task-composer-mentions'
import { TaskImageLightbox } from './task-image-lightbox'
import { TaskMarkdownEditor } from './task-markdown-editor'
import {
  extractHashTags,
  liftCompletedTokens,
  mentionAtCursor,
  replaceMention,
} from './task-mentions'

export type ComposerPicture = TaskAttachmentUpload & { previewUrl?: string }

export type TaskComposerValue = {
  title: string
  notes: string
  projectId: string | null
  worktreeId: string | null
  pathRefs: TaskPathRef[]
  tags: string[]
  links: TaskLink[]
  uploads: ComposerPicture[]
}

export function emptyComposerValue(): TaskComposerValue {
  return {
    title: '',
    notes: '',
    projectId: null,
    worktreeId: null,
    pathRefs: [],
    tags: [],
    links: [],
    uploads: [],
  }
}

function sniffImageMime(file: File, bytes: Uint8Array): string | null {
  if (file.type.startsWith('image/')) return file.type
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (bytes[0] === 0x52 && bytes[8] === 0x57) return 'image/webp'
  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.gif')) return 'image/gif'
  if (name.endsWith('.webp')) return 'image/webp'
  return null
}

export function fileToUpload(file: File): Promise<ComposerPicture> {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    const contentBase64 = btoa(binary)
    const mime = sniffImageMime(file, bytes)
    return {
      name: file.name || 'paste.png',
      contentBase64,
      previewUrl: mime === null ? undefined : `data:${mime};base64,${contentBase64}`,
    }
  })
}

export function composerTags(value: TaskComposerValue): string[] {
  return extractHashTags(value.title, value.notes, ...value.tags.map((tag) => `#${tag}`))
}

function flattenProjects(inventories: ReturnType<typeof useHubInventories>): readonly HubProject[] {
  return inventories.flatMap((source) => source.inventory.projects)
}

function worktreeFor(
  project: HubProject | undefined,
  preferredId: string | null,
): HubWorktree | undefined {
  if (project === undefined) return undefined
  return (
    project.worktrees.find((worktree) => worktree.id === preferredId) ??
    project.worktrees.find((worktree) => worktree.isPrimary) ??
    project.worktrees[0]
  )
}

export type TaskComposerProps = {
  value: TaskComposerValue
  onChange: (value: TaskComposerValue) => void
  existingPictures?: readonly { id: string; name: string; previewUrl?: string }[]
  onRemoveExisting?: (id: string) => void
  knownTags?: readonly string[]
}

export function TaskComposer({
  value,
  onChange,
  existingPictures = [],
  onRemoveExisting,
  knownTags = [],
}: TaskComposerProps): React.JSX.Element {
  const inventories = useHubInventories()
  const selection = useHubSelectionStore((s) => s.selection)
  const projects = useMemo(() => flattenProjects(inventories), [inventories])
  const projectItems = useMemo(
    () => [
      { label: 'No project', value: 'none' },
      ...projects.map((entry) => ({ label: entry.name, value: entry.id })),
    ],
    [projects],
  )
  const project = projects.find((entry) => entry.id === value.projectId)
  const worktree = worktreeFor(project, value.worktreeId)
  const fileInput = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const didDefaultProject = useRef(false)
  const [cursor, setCursor] = useState(0)
  const [highlight, setHighlight] = useState(0)
  const [caret, setCaret] = useState({ top: 0, left: 0 })
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null)
  const utils = trpc.useUtils()

  useEffect(() => {
    if (didDefaultProject.current || value.projectId !== null) return
    if (selection.kind === 'home') return
    if (projects.every((entry) => entry.id !== selection.projectId)) return
    didDefaultProject.current = true
    const projectId = selection.projectId
    const preferred = selection.kind === 'worktree' ? selection.worktreeId : null
    const next = projects.find((entry) => entry.id === projectId)
    onChange({
      ...value,
      projectId,
      worktreeId: worktreeFor(next, preferred)?.id ?? null,
    })
  }, [onChange, projects, selection, value])

  const mention = mentionAtCursor(value.notes, cursor)
  const fileQuery = mention?.kind === 'file' ? mention.query : ''
  const tagQuery = mention?.kind === 'tag' ? mention.query : ''

  const search = useQuery({
    enabled: worktree !== undefined && mention?.kind === 'file' && fileQuery.trim() !== '',
    queryKey: ['tasks', 'file-search', worktree?.path, fileQuery],
    queryFn: async (): Promise<SearchResult[]> => {
      if (worktree === undefined) return []
      return utils.client.searchFiles.query({ repoPath: worktree.path, query: fileQuery.trim() })
    },
  })

  const tagHits = useMemo(() => {
    if (mention?.kind !== 'tag') return []
    const q = tagQuery.toLowerCase()
    const hits = [...new Set(knownTags)].filter((tag) => q === '' || tag.toLowerCase().includes(q))
    if (tagQuery !== '' && !hits.some((tag) => tag.toLowerCase() === q)) hits.unshift(tagQuery)
    return hits.slice(0, 8)
  }, [knownTags, mention?.kind, tagQuery])

  const fileHits = search.data ?? []
  const suggestionCount = mention?.kind === 'file' ? fileHits.length : tagHits.length

  useEffect(() => {
    const token = `${mention?.kind ?? ''}:${fileQuery}:${tagQuery}`
    setHighlight(token.length >= 0 ? 0 : 0)
  }, [fileQuery, mention?.kind, tagQuery])

  function applyProject(projectId: string, preferredWorktree: string | null): void {
    if (projectId === '' || projectId === 'none') {
      onChange({ ...value, projectId: null, worktreeId: null })
      return
    }
    const next = projects.find((entry) => entry.id === projectId)
    const preferred =
      preferredWorktree ??
      (selection.kind === 'worktree' && selection.projectId === projectId
        ? selection.worktreeId
        : null)
    onChange({
      ...value,
      projectId,
      worktreeId: worktreeFor(next, preferred)?.id ?? null,
    })
  }

  const applyNotes = (raw: string, nextCursor: number): void => {
    const lifted = liftCompletedTokens(raw, nextCursor)
    const nextPaths = [...value.pathRefs]
    if (project !== undefined && worktree !== undefined) {
      for (const path of lifted.paths) {
        if (nextPaths.some((entry) => entry.path === path)) continue
        nextPaths.push({
          projectId: project.id,
          worktreeId: worktree.id,
          path,
          kind: path.endsWith('/') ? 'folder' : 'file',
        })
      }
    }
    const nextLinks = [...value.links]
    for (const link of lifted.links) {
      if (nextLinks.some((entry) => entry.url === link.url)) continue
      nextLinks.push(link)
    }
    onChange({
      ...value,
      notes: lifted.notes,
      tags: [...value.tags, ...lifted.tags.filter((tag) => !value.tags.includes(tag))],
      pathRefs: nextPaths,
      links: nextLinks,
    })
    setCursor(lifted.cursor)
  }

  const addFiles = async (files: FileList | File[]): Promise<void> => {
    const uploads = await Promise.all([...files].map((file) => fileToUpload(file)))
    onChange({ ...value, uploads: [...value.uploads, ...uploads] })
  }

  const acceptFile = (result: SearchResult): void => {
    if (
      mention === null ||
      mention.kind !== 'file' ||
      project === undefined ||
      worktree === undefined
    ) {
      return
    }
    const pathRef: TaskPathRef = {
      projectId: project.id,
      worktreeId: worktree.id,
      path: result.path,
      kind: result.kind === 'dir' ? 'folder' : 'file',
    }
    const already = value.pathRefs.some((entry) => entry.path === pathRef.path)
    onChange({
      ...value,
      notes: replaceMention(value.notes, mention, '').text,
      pathRefs: already ? value.pathRefs : [...value.pathRefs, pathRef],
    })
  }

  const acceptTag = (tag: string): void => {
    if (mention === null || mention.kind !== 'tag') return
    const trimmed = tag.trim()
    if (trimmed === '') return
    onChange({
      ...value,
      notes: replaceMention(value.notes, mention, '').text,
      tags: value.tags.includes(trimmed) ? value.tags : [...value.tags, trimmed],
    })
  }

  const acceptHighlight = (): void => {
    if (mention?.kind === 'file' && fileHits[highlight] !== undefined)
      acceptFile(fileHits[highlight])
    if (mention?.kind === 'tag' && tagHits[highlight] !== undefined) acceptTag(tagHits[highlight])
  }

  return (
    <div data-testid={TestIds.tasksComposer} className="flex flex-col gap-2">
      <Select
        items={projectItems}
        value={value.projectId ?? 'none'}
        onValueChange={(next: string | null) => applyProject(next ?? 'none', null)}
      >
        <SelectTrigger
          data-testid={TestIds.tasksComposerProject}
          aria-label="Project"
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="none">No project</SelectItem>
            {projects.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Input
        data-testid={TestIds.tasksComposerTitle}
        aria-label="Task title"
        placeholder="Task title"
        className={cn(compactInputClass, 'w-full')}
        value={value.title}
        onChange={(event) => onChange({ ...value, title: event.target.value })}
      />
      <TaskMarkdownEditor
        notes={value.notes}
        onChange={applyNotes}
        inputRef={notesRef}
        onCursor={(nextCursor) => {
          setCursor(nextCursor)
          if (notesRef.current === null) return
          const next = textareaCaretOffset(notesRef.current)
          setCaret((current) =>
            current.top === next.top && current.left === next.left ? current : next,
          )
        }}
        onKeyDown={(event) => {
          if (mention === null || suggestionCount === 0) return
          if (event.key === 'Tab' || event.key === 'Enter') {
            event.preventDefault()
            acceptHighlight()
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setHighlight((index) => Math.min(index + 1, suggestionCount - 1))
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlight((index) => Math.max(index - 1, 0))
          }
        }}
        onPaste={(event) => {
          const files = [...event.clipboardData.files]
          if (files.length === 0) return
          event.preventDefault()
          runUserAction(
            () => addFiles(files),
            (error) => toastUserActionError('Attach file', error),
          )
        }}
      >
        <TaskComposerMentions
          mention={mention}
          caret={caret}
          hasWorktree={worktree !== undefined}
          fileQuery={fileQuery}
          fileHits={fileHits}
          tagHits={tagHits}
          highlight={highlight}
          onAcceptFile={acceptFile}
          onAcceptTag={acceptTag}
        />
      </TaskMarkdownEditor>
      <TaskComposerChips
        tags={value.tags}
        pathRefs={value.pathRefs}
        links={value.links}
        onRemoveTag={(tag) =>
          onChange({ ...value, tags: value.tags.filter((entry) => entry !== tag) })
        }
        onRemovePath={(path) =>
          onChange({ ...value, pathRefs: value.pathRefs.filter((entry) => entry.path !== path) })
        }
        onRemoveLink={(url) =>
          onChange({ ...value, links: value.links.filter((entry) => entry.url !== url) })
        }
      />
      <TaskComposerPictures
        existing={existingPictures}
        uploads={value.uploads}
        onPreview={setPreview}
        onRemoveExisting={onRemoveExisting}
        onRemoveUpload={(index) =>
          onChange({ ...value, uploads: value.uploads.filter((_, item) => item !== index) })
        }
      />
      <div className="flex items-center gap-2">
        <input
          ref={fileInput}
          data-testid={TestIds.tasksComposerAttach}
          type="file"
          accept="image/*,.pdf,.txt,.log,.md"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files !== null) {
              runUserAction(
                () => addFiles(event.target.files ?? []),
                (error) => toastUserActionError('Attach file', error),
              )
            }
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Attach a file"
          onClick={() => fileInput.current?.click()}
        >
          <Paperclip />
        </Button>
        <span className="text-2xs text-muted-foreground">
          # title + Enter · @ file · #tag · paste
        </span>
      </div>
      <TaskImageLightbox image={preview} onClose={() => setPreview(null)} />
    </div>
  )
}
