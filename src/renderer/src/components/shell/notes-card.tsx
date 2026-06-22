import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Toggle } from '@renderer/components/ui/toggle'
import { useRepoNotes, useSetRepoNotes } from '@renderer/hooks/use-repo-notes'
import { cn } from '@renderer/lib/utils'
import Placeholder from '@tiptap/extension-placeholder'
import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Code, Heading, Italic, List, ListOrdered } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Markdown, type MarkdownStorage } from 'tiptap-markdown'

const AUTOSAVE_DELAY_MS = 800

// tiptap-markdown registers a `markdown` storage slice but ships no type
// augmentation for it; declare it so `editor.storage.markdown` is typed without
// any cast escape hatch.
declare module '@tiptap/core' {
  interface Storage {
    markdown: MarkdownStorage
  }
}

function markdownOf(editor: Editor): string {
  return editor.storage.markdown.getMarkdown()
}

/**
 * Per-repo quick notes. A TipTap WYSIWYG (the file viewer deliberately stays a
 * plain textarea — see the decision log) persisted as a markdown string with
 * debounced autosave, mirroring EditorSource's save lifecycle.
 */
export function NotesCard({ repoPath }: { repoPath?: string }): React.JSX.Element {
  const notes = useRepoNotes()

  return (
    <div className="flex h-full flex-col px-3 pb-3">
      <div className="flex h-8 shrink-0 items-center px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Notes
      </div>
      {/* A self-contained porcelain tile (matching the mockup) rather than a
          full-bleed pane — the editor reads as its own card, inset from the rail. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-sidebar-border bg-black/20">
        {notes === undefined ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
        ) : (
          <NotesEditor initialMarkdown={notes} repoPath={repoPath} />
        )}
      </div>
    </div>
  )
}

function NotesEditor({
  initialMarkdown,
  repoPath,
}: {
  initialMarkdown: string
  repoPath?: string
}): React.JSX.Element {
  const { save } = useSetRepoNotes()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedRef = useRef(initialMarkdown)

  // Latest save closure, read from the timer/unmount without re-creating the editor.
  const saveRef = useRef<(editor: Editor) => void>(() => {})
  saveRef.current = (editor: Editor): void => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const next = markdownOf(editor)
    if (next === savedRef.current) return
    savedRef.current = next
    save(repoPath, next)
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { rel: 'noreferrer' } },
      }),
      Markdown.configure({ transformPastedText: true, linkify: true }),
      Placeholder.configure({ placeholder: 'Write a note…' }),
    ],
    content: initialMarkdown,
    editorProps: {
      attributes: {
        class: 'notes-prose prose prose-sm prose-invert max-w-none px-3.5 py-3 focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => saveRef.current(editor), AUTOSAVE_DELAY_MS)
    },
  })

  // Flush pending changes when the card unmounts (repo switch, sidebar close).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (editor) saveRef.current(editor)
    }
  }, [editor])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {editor ? <NotesToolbar editor={editor} /> : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function NotesToolbar({ editor }: { editor: Editor }): React.JSX.Element {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      code: editor.isActive('code'),
      bullet: editor.isActive('bulletList'),
      ordered: editor.isActive('orderedList'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
    }),
  })
  if (!state) return <div className="h-9 shrink-0 border-b border-sidebar-border" />

  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-sidebar-border px-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className={cn('size-7', (state.h1 || state.h2 || state.h3) && 'bg-accent')}
              aria-label="Heading"
            >
              <Heading className="size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-32">
          <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
            Body text
          </DropdownMenuItem>
          {([1, 2, 3] as const).map((level) => (
            <DropdownMenuItem
              key={level}
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            >
              Heading {level}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarToggle
        pressed={state.bold}
        onPressed={() => editor.chain().focus().toggleBold().run()}
        label="Bold"
      >
        <Bold className="size-3.5" />
      </ToolbarToggle>
      <ToolbarToggle
        pressed={state.italic}
        onPressed={() => editor.chain().focus().toggleItalic().run()}
        label="Italic"
      >
        <Italic className="size-3.5" />
      </ToolbarToggle>
      <span className="mx-1 h-4 w-px shrink-0 bg-sidebar-border" />
      <ToolbarToggle
        pressed={state.code}
        onPressed={() => editor.chain().focus().toggleCode().run()}
        label="Inline code"
      >
        <Code className="size-3.5" />
      </ToolbarToggle>
      <ToolbarToggle
        pressed={state.bullet}
        onPressed={() => editor.chain().focus().toggleBulletList().run()}
        label="Bullet list"
      >
        <List className="size-3.5" />
      </ToolbarToggle>
      <ToolbarToggle
        pressed={state.ordered}
        onPressed={() => editor.chain().focus().toggleOrderedList().run()}
        label="Numbered list"
      >
        <ListOrdered className="size-3.5" />
      </ToolbarToggle>
    </div>
  )
}

function ToolbarToggle({
  pressed,
  onPressed,
  label,
  children,
}: {
  pressed: boolean
  onPressed: () => void
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Toggle
      size="sm"
      pressed={pressed}
      onPressedChange={onPressed}
      aria-label={label}
      className="size-7 min-w-0 p-0"
    >
      {children}
    </Toggle>
  )
}
