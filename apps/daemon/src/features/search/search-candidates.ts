import { directoriesOf } from './fuzzy'

// The finder searches visible files PLUS their ancestor folders. Both the
// hidden-path filtering and the directory derivation run over the full file
// list, so they're recomputed only when the list or the hidden set changes —
// never on every search keystroke (only the fuzzy scoring runs per keystroke).
export interface SearchCandidates {
  paths: readonly string[]
  dirs: ReadonlySet<string>
}

const searchCandidatesCache = new Map<
  string,
  { files: readonly string[]; hiddenKey: string; candidates: SearchCandidates }
>()

function visibleFilePaths(
  repoPath: string,
  files: readonly string[],
  hidden: ReadonlySet<string>,
): string[] {
  if (hidden.size === 0) return [...files]
  return files.filter((file) => {
    for (const h of hidden) {
      const rel = h.startsWith(`${repoPath}/`) ? h.slice(repoPath.length + 1) : h
      if (file === rel || file.startsWith(`${rel}/`)) return false
    }
    return true
  })
}

export function searchCandidates(
  repoPath: string,
  files: string[],
  hidden: ReadonlySet<string>,
): SearchCandidates {
  const hiddenKey = [...hidden].sort().join('\0')
  const cached = searchCandidatesCache.get(repoPath)
  if (cached && cached.files === files && cached.hiddenKey === hiddenKey) return cached.candidates
  const visible = visibleFilePaths(repoPath, files, hidden)
  const dirs = directoriesOf(visible)
  const candidates: SearchCandidates = { paths: [...visible, ...dirs], dirs: new Set(dirs) }
  searchCandidatesCache.set(repoPath, { files, hiddenKey, candidates })
  return candidates
}
