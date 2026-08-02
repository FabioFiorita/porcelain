import { Button, HStack, Image, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import {
  buttonStyle,
  contentShape,
  foregroundStyle,
  frame,
  lineLimit,
  shapes,
} from '@expo/ui/swift-ui/modifiers'

import { totalStats } from '@/features/changes/lib/diff-rows'
import { basename, dirname, formatStats, stagingLabel } from '@/features/changes/lib/format'
import { statusSymbol } from '@/features/changes/lib/status'
import type { FlowFile, FlowGroup } from '@/lib/daemon/procedures/changes'
import { statusTint } from '@/theme/colors'
import { footnote, secondary } from '@/theme/modifiers'

const additionsStyle = foregroundStyle({ color: statusTint('added'), type: 'color' })
const deletionsStyle = foregroundStyle({ color: statusTint('deleted'), type: 'color' })

/**
 * The flow-grouped file list, shared by the working tree and a historical commit — the grouping
 * is the same identity in both, so it is the same component. Layer order and file order come
 * from the daemon and are never re-sorted here.
 *
 * Sections only: the caller owns the `List`, so a summary row can sit above these without
 * nesting one list inside another.
 */
export function FlowGroupList({
  groups,
  onSelect,
  reviewedPaths,
}: {
  groups: readonly FlowGroup[]
  onSelect: (path: string) => void
  reviewedPaths?: readonly string[]
}): React.JSX.Element {
  return (
    <>
      {groups.map((group) => (
        <Section key={group.layer} title={layerTitle(group)}>
          {group.files.map((file) => (
            <FileRow
              file={file}
              key={file.path}
              onSelect={onSelect}
              reviewed={reviewedPaths?.includes(file.path) ?? false}
            />
          ))}
        </Section>
      ))}
    </>
  )
}

function layerTitle(group: FlowGroup): string {
  const totals = totalStats([group])
  const stats = formatStats(totals.additions, totals.deletions)
  const files = `${totals.files} file${totals.files === 1 ? '' : 's'}`

  return [group.layer.toUpperCase(), files, stats].filter((part) => part !== '').join(' · ')
}

function FileRow({
  file,
  onSelect,
  reviewed,
}: {
  file: FlowFile
  onSelect: (path: string) => void
  reviewed: boolean
}): React.JSX.Element {
  const detail = [
    dirname(file.path),
    formatStats(file.additions, file.deletions),
    stagingLabel(file),
  ]
    .filter((part) => part !== '')
    .join(' · ')

  return (
    <Button
      modifiers={[
        buttonStyle('plain'),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
      ]}
      onPress={(): void => onSelect(file.path)}
    >
      <HStack
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
        ]}
        spacing={10}
      >
        <Image
          modifiers={[foregroundStyle({ color: statusTint(file.status), type: 'color' })]}
          size={18}
          systemName={statusSymbol(file.status)}
        />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[lineLimit(1)]}>{basename(file.path)}</Text>
          {detail === '' ? null : <FileDetails file={file} />}
        </VStack>
        <Spacer />
        {reviewed ? (
          <Image
            modifiers={[foregroundStyle({ color: statusTint('added'), type: 'color' })]}
            size={16}
            systemName="checkmark.circle.fill"
          />
        ) : null}
      </HStack>
    </Button>
  )
}

function FileDetails({ file }: { file: FlowFile }): React.JSX.Element | null {
  const directory = dirname(file.path)
  const hasAdditions = file.additions !== undefined && file.additions > 0
  const hasDeletions = file.deletions !== undefined && file.deletions > 0
  const stage = stagingLabel(file)
  if (directory === '' && !hasAdditions && !hasDeletions && stage === '') return null

  return (
    <HStack spacing={4}>
      {directory === '' ? null : (
        <Text modifiers={[footnote, secondary, lineLimit(1)]}>{directory}</Text>
      )}
      {directory === '' || !hasAdditions ? null : <Text modifiers={[footnote, secondary]}>·</Text>}
      {hasAdditions ? (
        <Text modifiers={[footnote, additionsStyle]}>{`+${file.additions}`}</Text>
      ) : null}
      {hasAdditions && hasDeletions ? <Text modifiers={[footnote, secondary]}>·</Text> : null}
      {hasDeletions ? (
        <Text modifiers={[footnote, deletionsStyle]}>{`−${file.deletions}`}</Text>
      ) : null}
      {stage === '' ? null : (
        <>
          {directory !== '' || hasAdditions || hasDeletions ? (
            <Text modifiers={[footnote, secondary]}>·</Text>
          ) : null}
          <Text modifiers={[footnote, secondary]}>{stage}</Text>
        </>
      )}
    </HStack>
  )
}
