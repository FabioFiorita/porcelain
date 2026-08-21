import { DiffView } from '@/features/diff/diff-view'
import { changesDiffSource } from '@/features/git'

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
  return (
    <DiffView
      active={active}
      filePath={filePath}
      source={changesDiffSource(base)}
      testID="porcelain-changes-diff"
      onBack={onBack}
      onOpenFile={onOpenFile}
    />
  )
}
