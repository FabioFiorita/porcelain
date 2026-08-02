import { HStack, RNHostView, VStack } from '@expo/ui/swift-ui'
import { frame } from '@expo/ui/swift-ui/modifiers'
import type { ReactElement } from 'react'

import { ScreenHost } from '@/components/screen-host'
import { FilePickerPane } from '@/features/changes/components/file-picker-pane'
import { useChangesPaneStore } from '@/features/changes/data/pane-store'
import { useLayout } from '@/lib/layout-runtime'

export function ChangesLayout({
  children,
}: {
  readonly children: ReactElement
}): React.JSX.Element {
  const layout = useLayout()
  const pane = useChangesPaneStore((state) => state.pane)
  const showPane = layout.usesSplitView && pane !== null

  return (
    <ScreenHost>
      <HStack
        modifiers={[frame({ alignment: 'topLeading', maxHeight: Infinity, maxWidth: Infinity })]}
        spacing={0}
      >
        <VStack
          modifiers={[frame({ alignment: 'topLeading', maxHeight: Infinity, maxWidth: Infinity })]}
        >
          <RNHostView>{children}</RNHostView>
        </VStack>
        {showPane && layout.sidePaneWidth !== null && pane !== null ? (
          <VStack
            modifiers={[
              frame({
                alignment: 'topLeading',
                maxHeight: Infinity,
                width: layout.sidePaneWidth,
              }),
            ]}
          >
            <FilePickerPane
              files={pane.files}
              onSelect={pane.onSelect}
              selectedPath={pane.selectedPath}
            />
          </VStack>
        ) : null}
      </HStack>
    </ScreenHost>
  )
}
