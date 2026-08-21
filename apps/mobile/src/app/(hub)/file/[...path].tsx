import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'

import { FileViewer, pathFromSegments } from '@/features/files'

/**
 * One file, pushed over the tree — or over a search, or over a diff, since every surface that
 * knows a repo-relative path opens the file the same way.
 */
export default function FilesFileRoute(): React.JSX.Element {
  const { line, path } = useLocalSearchParams<{ line?: string; path: string[] }>()
  const focused = useIsFocused()
  const router = useRouter()
  // A deep link carries whatever the URL says; anything that is not a positive integer is a
  // file opened at the top, not a crash.
  const parsed = line === undefined ? Number.NaN : Number(line)
  const at = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined

  return (
    <FileViewer
      active={focused}
      filePath={pathFromSegments(path)}
      line={at}
      onBack={() => {
        router.back()
      }}
    />
  )
}
