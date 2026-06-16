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
    <div className="flex h-full flex-col border-t border-sidebar-border">
      <div className="flex h-7 shrink-0 items-center px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Notes
      </div>
      {notes === undefined ? (
        <div className="px-2 py-1 text-xs text-muted-foreground">Loading…</div>
      ) : (
        <NotesEditor initialMarkdown={notes} repoPath={repoPath} />
      )}
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
      Placeholder.configure({ placeholder: 'Jot a quick note…' }),
    ],
    content: initialMarkdown,
    editorProps: {
      attributes: {
        class: 'notes-prose prose prose-sm prose-invert max-w-none px-2 py-1.5 focus:outline-none',
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
      <div className="min-h-0 flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
      {editor ? <NotesToolbar editor={editor} /> : null}
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
  if (!state) return <div className="h-9 shrink-0 border-t border-sidebar-border" />

  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-t border-sidebar-border px-1">
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
