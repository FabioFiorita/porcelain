import { View } from 'react-native'

import { EmptyNote } from '@/components/panel-chrome'
import { PhoneHeader } from '@/features/shell/phone-header'

const COPY: Record<string, { title: string; body: string }> = {
  canvas: {
    title: 'Canvas is not on mobile yet',
    body: 'Agent-authored Canvases for this Project exist on the daemon and render in the web and Electron clients. Mobile has no viewer for them.',
  },
  git: {
    title: 'Git is not on mobile yet',
    body: 'The Git surface — commands, suggestions, and commit — exists in the web client. Mobile can stage and commit from Changes, but has no Git surface.',
  },
}

/**
 * A web surface with no mobile panel. It says so plainly instead of rendering an empty shell
 * that reads as a bug, and it is a real screen so the row is honest about being tappable.
 */
export function UnbuiltSurfaceScreen({ surface }: { surface: string }): React.JSX.Element {
  const copy = COPY[surface] ?? {
    title: 'Not on mobile yet',
    body: 'This surface exists in the web client and has no mobile panel.',
  }
  return (
    <View className="flex-1 bg-background" testID={`porcelain-unbuilt-${surface}`}>
      <PhoneHeader
        companion={false}
        search={false}
        title={copy.title.split(' is ')[0] ?? 'Surface'}
      />
      <EmptyNote body={copy.body} testID={`porcelain-unbuilt-note-${surface}`} title={copy.title} />
    </View>
  )
}
