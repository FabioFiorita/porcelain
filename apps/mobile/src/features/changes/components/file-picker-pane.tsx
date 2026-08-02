import { Button, HStack, Image, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import {
  buttonStyle,
  font,
  foregroundStyle,
  lineLimit,
  listStyle,
} from '@expo/ui/swift-ui/modifiers'

import { basename, dirname, formatStats } from '@/features/changes/lib/format'
import { statusSymbol } from '@/features/changes/lib/status'
import type { FileStatus } from '@/lib/daemon/procedures/changes'
import { statusTint } from '@/theme/colors'
import { footnote, secondary } from '@/theme/modifiers'

export type FilePickerFile = {
  readonly additions?: number
  readonly deletions?: number
  readonly path: string
  readonly status?: FileStatus
}

export function FilePickerPane({
  files,
  onSelect,
  selectedPath,
}: {
  readonly files: readonly FilePickerFile[]
  readonly onSelect: (path: string) => void
  readonly selectedPath: string | null
}): React.JSX.Element {
  return (
    <List modifiers={[listStyle('insetGrouped')]}>
      <Section title={`Files · ${files.length}`}>
        {files.map((file) => {
          const selected = file.path === selectedPath
          const details = [dirname(file.path), formatStats(file.additions, file.deletions)]
            .filter((part) => part !== '')
            .join(' · ')
          return (
            <Button
              key={file.path}
              modifiers={[buttonStyle('plain')]}
              onPress={(): void => onSelect(file.path)}
            >
              <HStack spacing={8}>
                <Image
                  modifiers={[foregroundStyle({ color: statusTint(file.status), type: 'color' })]}
                  size={16}
                  systemName={statusSymbol(file.status)}
                />
                <VStack alignment="leading" spacing={2}>
                  <Text
                    modifiers={[lineLimit(1), ...(selected ? [font({ weight: 'semibold' })] : [])]}
                  >
                    {basename(file.path)}
                  </Text>
                  {details === '' ? null : (
                    <Text modifiers={[footnote, secondary, lineLimit(1)]}>{details}</Text>
                  )}
                </VStack>
                <Spacer />
                {selected ? (
                  <Image
                    modifiers={[foregroundStyle({ style: 'primary', type: 'hierarchical' })]}
                    size={16}
                    systemName="checkmark.circle.fill"
                  />
                ) : null}
              </HStack>
            </Button>
          )
        })}
      </Section>
    </List>
  )
}
