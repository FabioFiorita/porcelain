import { DiffView } from '@/features/diff/diff-view'
import { changesDiffSource } from '@/features/git'
import { useReviewed } from './reviewed-data'

/**
 * The Changes tab's binding of the shared diff surface: the working tree or the branch range,
 * with the reviewed tick this tab owns.
 *
 * The tick lives here rather than in the surface because reviewing is a Changes idea — a
 * historical commit's diff renders the same rows with nothing to tick off.
 */
export function ChangesDiffView({
  active,
  base,
  filePath,
  onBack,
  onOpenFile,
}: {
  active: boolean
  /** Branch scope base ref; `undefined` reads the working tree. */
  base: string | undefined
  filePath: string
  onBack?: () => void
  onOpenFile?: (path: string) => void
}): React.JSX.Element {
  const scope =
    base === undefined ? { type: 'working' as const } : { type: 'branch' as const, base }
  const reviewed = useReviewed(scope, active)
  return (
    <DiffView
      active={active}
      filePath={filePath}
      source={changesDiffSource(base)}
      reviewed={{
        isReviewed: reviewed.paths.has(filePath),
        onToggle: () => reviewed.onToggle(filePath, !reviewed.paths.has(filePath)),
      }}
      testID="porcelain-changes-diff"
      onBack={onBack}
      onOpenFile={onOpenFile}
    />
  )
}
