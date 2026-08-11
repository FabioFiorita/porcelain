import { runUserAction } from '@porcelain/shared/background'
import { useEffect, useState } from 'react'
import type { Layer } from '@/lib/daemon/procedures/settings'

import {
  buildPattern,
  type DraftLayer,
  deriveLabel,
  layersAreValid,
  type MatchType,
  matchingPaths,
  moveLayer,
  splitNames,
} from './review-layers'
import { type ReviewLayers, useReviewLayers } from './use-settings'

/**
 * The Review panel's editor state, layered on top of `useReviewLayers`.
 *
 * The daemon seam stays in `use-settings.ts` — this is the draft the reader is editing before
 * any of it is saved, which is a different lifetime: it survives a refetch, it can be invalid,
 * and it is thrown away by "Reset to starters". Keeping it out of the daemon hook is what stops
 * that hook from growing a second job.
 */

/** Draft identity for React. A layer has no id on the daemon — position is its whole identity. */
let nextDraftId = 0
function toDraft(layers: readonly Layer[]): DraftLayer[] {
  return layers.map((layer) => ({ ...layer, id: nextDraftId++ }))
}

/** How long "Saved" stays on the button before it reads "Save" again. */
const SAVED_FLASH_MS = 1500

export type ReviewEditor = {
  review: ReviewLayers
  draft: readonly DraftLayer[]
  valid: boolean
  savedFlash: boolean
  add: (layer: Layer) => void
  update: (index: number, next: Layer) => void
  move: (index: number, direction: 1 | -1) => void
  remove: (index: number) => void
  /** Saves the draft; `null` clears the override back to the starters. Total void for UI edges. */
  save: (layers: readonly DraftLayer[] | null) => void
}

export function useReviewEditor(repoPath: string): ReviewEditor {
  const review = useReviewLayers(repoPath)
  const savedLayers = review.layers
  const [draft, setDraft] = useState<DraftLayer[]>([])
  const [savedFlash, setSavedFlash] = useState(false)

  // The daemon's answer is the draft's starting point, and re-seeds it after every save.
  useEffect(() => {
    if (savedLayers !== undefined) setDraft(toDraft(savedLayers))
  }, [savedLayers])

  return {
    add: (layer) => {
      setDraft((current) => [...current, { ...layer, id: nextDraftId++ }])
    },
    draft,
    move: (index, direction) => {
      setDraft((current) => moveLayer(current, index, direction))
    },
    remove: (index) => {
      setDraft((current) => current.filter((_, position) => position !== index))
    },
    review,
    save: (layers): void => {
      // review.save is total (catches into failure); flash only on success.
      runUserAction(
        async () => {
          if (!(await review.save(layers))) return
          setSavedFlash(true)
          setTimeout(() => {
            setSavedFlash(false)
          }, SAVED_FLASH_MS)
        },
        (error) => {
          // review.save already writes failure text when it returns false; log unexpected throws.
          console.error('[use-review-editor] save failed', error)
        },
      )
    },
    savedFlash,
    update: (index, next) => {
      setDraft((current) =>
        current.map((entry, position) => (position === index ? { ...entry, ...next } : entry)),
      )
    },
    valid: layersAreValid(draft),
  }
}

export type PatternBuilderState = {
  matchType: MatchType
  setMatchType: (type: MatchType) => void
  names: string
  setNames: (names: string) => void
  /** The names field parsed into a list — empty means there is nothing to add. */
  parsed: readonly string[]
  /** The regex the current field builds, shown before it is added. */
  preview: string
  /** Which of the currently changed files the preview would claim. */
  matches: readonly string[]
  add: () => void
}

/** The builder above the list: a match type, a names field, and the pattern they make. */
export function usePatternBuilder(
  changedPaths: readonly string[],
  onAdd: (layer: Layer) => void,
): PatternBuilderState {
  const [matchType, setMatchType] = useState<MatchType>('folder')
  const [names, setNames] = useState('')
  const parsed = splitNames(names)
  const preview = buildPattern(matchType, parsed)

  return {
    add: () => {
      if (parsed.length === 0) return
      onAdd({ label: deriveLabel(parsed), pattern: preview })
      setNames('')
    },
    matchType,
    matches: matchingPaths(preview, changedPaths),
    names,
    parsed,
    preview,
    setMatchType,
    setNames,
  }
}
