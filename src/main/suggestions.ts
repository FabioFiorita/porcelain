export interface GitSuggestion {
  /** Id of the QUICK_COMMANDS entry this suggestion runs. */
  command: string
  reason: string
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

/**
 * Derive suggested quick commands from `git status --porcelain=v2 --branch`
 * output and `git stash list` output. Pure so it is unit testable.
 */
export function parseSuggestions(statusBranch: string, stashList: string): GitSuggestion[] {
  const suggestions: GitSuggestion[] = []
  const ab = statusBranch.match(/^# branch\.ab \+(\d+) -(\d+)$/m)
  const ahead = ab ? Number(ab[1]) : 0
  const behind = ab ? Number(ab[2]) : 0
  const dirty = statusBranch.split('\n').filter((l) => l !== '' && !l.startsWith('#')).length
  const stashes = stashList.split('\n').filter((l) => l !== '').length

  if (behind > 0) {
    suggestions.push({ command: 'pull', reason: `behind upstream by ${plural(behind, 'commit')}` })
  }
  if (ahead > 0) {
    suggestions.push({ command: 'push', reason: `${plural(ahead, 'unpushed commit')}` })
  }
  if (stashes > 0) {
    suggestions.push({ command: 'stash-pop', reason: `${plural(stashes, 'stash')} waiting` })
  }
  if (dirty > 0) {
    suggestions.push({ command: 'stash', reason: `${plural(dirty, 'uncommitted change')}` })
  }
  return suggestions
}
