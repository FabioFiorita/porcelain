import { useState } from 'react'
import { View } from 'react-native'

import { SURFACE_TOOLBAR } from '@/components/surface-layout'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { SurfaceScroll } from '@/components/surface-scroll'
import { useSurfaceOpen } from '@/features/shell/use-surface-open'
import { cn } from '@/lib/utils'

import { FileTimelineCard } from './history-companion'
import { HistoryList } from './history-list'
import { useHistoryStore } from './history-store'

type HistoryFace = 'history' | 'timeline'

/**
 * The History surface as a tab of the tablet's Surfaces panel.
 *
 * Two faces behind a toggle, which is the web client's `HistorySurface` verbatim — the branch's
 * commits, or the timeline of the file you last opened inside one. The phone reaches the
 * timeline through the companion bolt instead, because a phone screen has no room to carry a
 * second list under a toggle; on a panel there is, and the web client already proved which
 * shape reads.
 */
export function HistorySurfacePanel({ active }: { active: boolean }): React.JSX.Element {
  const [face, setFace] = useState<HistoryFace>('history')
  const select = useHistoryStore((state) => state.openCommit)
  const open = useSurfaceOpen()

  return (
    <View className="flex-1" testID="porcelain-history-surface-panel">
      <View className={cn(SURFACE_TOOLBAR, 'pb-0')}>
        <SegmentedControl<HistoryFace>
          options={[
            { value: 'history', label: 'History', testID: 'porcelain-history-face-history' },
            {
              value: 'timeline',
              label: 'File timeline',
              testID: 'porcelain-history-face-timeline',
            },
          ]}
          testID="porcelain-history-face"
          value={face}
          onChange={setFace}
        />
      </View>
      {face === 'history' ? (
        <HistoryList
          active={active}
          onOpenCommit={(hash) => {
            select(hash)
            open.commit(hash)
          }}
        />
      ) : (
        <SurfaceScroll paddingTop={12} testID="porcelain-history-timeline-panel">
          <FileTimelineCard active={active} />
        </SurfaceScroll>
      )}
    </View>
  )
}
