import { Button, ContentUnavailableView, ProgressView, Text, VStack } from '@expo/ui/swift-ui'
import { buttonStyle, frame, padding } from '@expo/ui/swift-ui/modifiers'

import { ScreenHost } from '@/components/screen-host'
import { type DaemonError, daemonErrorMessage } from '@/lib/daemon/errors'
import type { FileView } from '@/lib/daemon/procedures/files'
import { secondary } from '@/theme/modifiers'
import { fileSize } from './file-paths'

export function FilesLoading({
  description = 'Reading the repository from the daemon.',
}: {
  description?: string
}): React.JSX.Element {
  return (
    <ScreenHost>
      <VStack
        alignment="center"
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), padding({ all: 24 })]}
        spacing={12}
      >
        <ProgressView />
        <Text modifiers={[secondary]}>{description}</Text>
      </VStack>
    </ScreenHost>
  )
}

export function FilesQueryState({
  description,
  error,
  onRetry,
  title,
}: {
  description: string
  error: DaemonError
  onRetry: () => void
  title: string
}): React.JSX.Element {
  return (
    <ScreenHost>
      <VStack
        alignment="center"
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), padding({ all: 24 })]}
        spacing={12}
      >
        <ContentUnavailableView
          description={daemonErrorMessage(error)}
          systemImage="wifi.exclamationmark"
          title={title}
        />
        <Text modifiers={[secondary]}>{description}</Text>
        <Button label="Retry" modifiers={[buttonStyle('bordered')]} onPress={onRetry} />
      </VStack>
    </ScreenHost>
  )
}

export function NoVisibleFiles(): React.JSX.Element {
  return (
    <ScreenHost>
      <ContentUnavailableView
        description="Hidden entries stay out of this list until Show hidden is enabled."
        systemImage="folder"
        title="No visible files"
      />
    </ScreenHost>
  )
}

export function NoSearchResults({ query }: { query: string }): React.JSX.Element {
  return (
    <ScreenHost>
      <ContentUnavailableView
        description="Try a different filename or folder."
        systemImage="magnifyingglass"
        title={`No files match “${query}”`}
      />
    </ScreenHost>
  )
}

export function FileViewState({
  onBack,
  view,
}: {
  onBack: () => void
  view: Extract<FileView, { type: 'binary' | 'not-found' | 'too-large' }>
}): React.JSX.Element {
  const content = fileViewCopy(view)

  return (
    <ScreenHost>
      <VStack
        alignment="center"
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), padding({ all: 24 })]}
        spacing={12}
      >
        <ContentUnavailableView
          description={content.description}
          systemImage={content.systemImage}
          title={content.title}
        />
        {view.type === 'not-found' ? (
          <Button label="Back to files" modifiers={[buttonStyle('bordered')]} onPress={onBack} />
        ) : null}
      </VStack>
    </ScreenHost>
  )
}

function fileViewCopy(view: Extract<FileView, { type: 'binary' | 'not-found' | 'too-large' }>): {
  description: string
  systemImage: 'doc' | 'doc.questionmark' | 'externaldrive.badge.xmark'
  title: string
} {
  switch (view.type) {
    case 'binary':
      return {
        description: `This file is binary and cannot be shown as text (${fileSize(view.size)}).`,
        systemImage: 'doc',
        title: 'Binary file',
      }
    case 'too-large':
      return {
        description: `This file is ${fileSize(view.size)}. The mobile viewer opens files up to 10 MB.`,
        systemImage: 'doc.questionmark',
        title: 'Too large to open',
      }
    case 'not-found':
      return {
        description: 'The row you opened is stale; it may have been removed by an agent.',
        systemImage: 'externaldrive.badge.xmark',
        title: 'This file is no longer here',
      }
  }
}
