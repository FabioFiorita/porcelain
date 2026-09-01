import type { ReviewCanvasDocument } from '@porcelain/contracts/projects'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { markdownToHtml, PreviewView, readerDocument } from '@/features/files'
import { cn } from '@/lib/utils'

export function ReviewCanvasView({
  document,
  scheme,
}: {
  document: ReviewCanvasDocument
  scheme: 'light' | 'dark'
}): React.JSX.Element {
  const [active, setActive] = useState<'why' | 'how'>('why')
  const content = active === 'why' ? document.why : document.how

  return (
    <View className="flex-1" testID="porcelain-review-canvas">
      <View
        accessibilityRole="tablist"
        className="h-14 shrink-0 flex-row items-center gap-2 border-b border-border px-4 py-2"
      >
        {(['why', 'how'] as const).map((view) => {
          const selected = active === view
          const label = view === 'why' ? 'Why' : 'How'
          return (
            <Pressable
              key={view}
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={cn(
                'min-h-9 justify-center rounded-2xl px-4 will-change-pressable',
                selected ? 'bg-muted' : 'active:bg-muted/50',
              )}
              testID={`porcelain-review-view-${view}`}
              onPress={() => setActive(view)}
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  selected ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <PreviewView
        document={readerDocument(markdownToHtml(content), scheme)}
        testID={`porcelain-review-${active}`}
      />
    </View>
  )
}
