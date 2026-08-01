import { Button, HStack, Image, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import { font, foregroundStyle, lineLimit } from '@expo/ui/swift-ui/modifiers'

import { totalStats } from '@/features/changes/lib/diff-rows'
import { basename, dirname, formatStats, stagingLabel } from '@/features/changes/lib/format'
import { statusSymbol } from '@/features/changes/lib/status'
import type { FlowFile, FlowGroup } from '@/lib/daemon/procedures/changes'
import { statusTint } from '@/theme/colors'
import { footnote, secondary } from '@/theme/modifiers'

const caption = font({ textStyle: 'caption' })

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
        <Section header={<LayerHeader group={group} />} key={group.layer}>
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

function LayerHeader({ group }: { group: FlowGroup }): React.JSX.Element {
  const totals = totalStats([group])
  const stats = formatStats(totals.additions, totals.deletions)
  const files = `${totals.files} file${totals.files === 1 ? '' : 's'}`

  return (
    <Text modifiers={[caption, secondary]}>
      {[group.layer.toUpperCase(), files, stats].filter((part) => part !== '').join(' · ')}
    </Text>
  )
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
    <Button onPress={(): void => onSelect(file.path)}>
      <HStack spacing={10}>
        <Image
          modifiers={[foregroundStyle({ color: statusTint(file.status), type: 'color' })]}
          size={18}
          systemName={statusSymbol(file.status)}
        />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[lineLimit(1)]}>{basename(file.path)}</Text>
          {detail === '' ? null : (
            <Text modifiers={[footnote, secondary, lineLimit(1)]}>{detail}</Text>
          )}
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
