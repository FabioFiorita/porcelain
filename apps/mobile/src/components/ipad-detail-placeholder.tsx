import { ContentUnavailableView } from '@expo/ui/swift-ui'

import { ScreenHost } from '@/components/screen-host'

/** Secondary column when nothing is selected yet (list lives in the supplementary column). */
export function IPadDetailPlaceholder({
  description,
  title,
}: {
  description: string
  title: string
}): React.JSX.Element {
  return (
    <ScreenHost>
      <ContentUnavailableView
        description={description}
        systemImage="rectangle.split.2x1"
        title={title}
      />
    </ScreenHost>
  )
}
