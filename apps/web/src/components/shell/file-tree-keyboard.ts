import { normalizeProjectRoot } from '@renderer/features/files'
import { useFilePromptStore } from '@renderer/stores/file-prompt'
import { useSelectionStore } from '@renderer/stores/selection'
import type { KeyboardEvent } from 'react'

export function navigateFileTree(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  const row = event.target
  if (!(row instanceof HTMLButtonElement) || !row.matches('[data-tree-kind]')) return
  const path = row.dataset.path
  if (!path) return
  const keys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'F2']
  if (!keys.includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  const rows = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-tree-kind]'),
  ).filter((entry) => !entry.closest('[data-slot="collapsible-content"][data-closed]'))
  const index = rows.indexOf(row)
  const parent = rows.findLast(
    (entry) =>
      entry.dataset.treeKind === 'dir' &&
      normalizeProjectRoot(path).startsWith(`${normalizeProjectRoot(entry.dataset.path ?? '')}/`),
  )
  let next: HTMLButtonElement | undefined
  switch (event.key) {
    case 'ArrowDown':
      next = rows[index + 1]
      break
    case 'ArrowUp':
      next = rows[index - 1]
      break
    case 'Home':
      next = rows[0]
      break
    case 'End':
      next = rows.at(-1)
      break
    case 'ArrowRight':
      if (row.dataset.treeKind === 'dir') {
        if (row.getAttribute('aria-expanded') !== 'true') row.click()
        else if (
          rows[index + 1]?.dataset.path &&
          normalizeProjectRoot(rows[index + 1]?.dataset.path ?? '').startsWith(
            `${normalizeProjectRoot(path)}/`,
          )
        )
          next = rows[index + 1]
      }
      break
    case 'ArrowLeft':
      if (row.getAttribute('aria-expanded') === 'true') row.click()
      else next = parent
      break
    case 'F2':
      useFilePromptStore.getState().rename(path, row.dataset.treeName ?? '')
      break
  }
  if (next?.dataset.path) {
    next.focus()
    next.scrollIntoView({ block: 'nearest' })
    useSelectionStore
      .getState()
      .setActive({ path: next.dataset.path, kind: next.dataset.treeKind as 'file' | 'dir' })
  }
}
