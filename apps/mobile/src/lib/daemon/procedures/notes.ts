import { z } from 'zod'

import { defineMutation, defineQuery } from '../procedure'

/**
 * Per-repo quick notes, the second half of the Files companion ("Pinned & notes"). Config-store
 * state, never git: the daemon returns '' for a repo that has never been written to.
 */
export const repoNotesQuery = defineQuery<string, string>('repoNotes', z.string())

export const setRepoNotesMutation = defineMutation<{ repoPath: string; notes: string }, void>(
  'setRepoNotes',
  z.void(),
)
