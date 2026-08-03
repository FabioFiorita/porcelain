import { List, Section, VStack } from '@expo/ui/swift-ui'
import { ObserveInteractiveMarker } from 'expo-observe'
import { useEffect, useState } from 'react'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHeader } from '@/components/screen-header'
import { ScreenHost } from '@/components/screen-host'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { QueryNotice } from '@/features/changes/components/query-notice'
import { GlanceScreen } from '@/features/glance/glance-screen'

import { EvidenceFace } from './evidence-face'
import { ExecutionFace } from './execution-face'
import { FaceSwitcher, type ReviewFace } from './face-switcher'
import { useFeatureReading } from './hooks/use-feature-reading'
import { useFeatureView } from './hooks/use-feature-view'
import { useReviewedPaths } from './hooks/use-reviewed'
import { IntentFace } from './intent-face'

export function ReviewScreen(): React.JSX.Element {
  useSurfaceFocus('review')

  return (
    <>
      <DaemonGate requires="repo">
        <ReviewBody />
      </DaemonGate>
      {/* Board is the tab face alternate — re-tap the tab bar; no header switcher. */}
      <ScreenHeader title="Review" />
      <ObserveInteractiveMarker />
    </>
  )
}

function ReviewBody(): React.JSX.Element {
  const view = useFeatureView()
  const reading = useFeatureReading()
  const reviewed = useReviewedPaths()
  const [face, setFace] = useState<ReviewFace>('intent')

  useEffect(() => {
    if (reading.data?.evidence === null && face === 'evidence') setFace('intent')
  }, [face, reading.data?.evidence])

  const error = view.error ?? reading.error ?? reviewed.error
  if (view.data === undefined || reading.data === undefined) {
    return (
      <ScreenHost>
        <List>
          <Section>
            <QueryNotice
              description="Reading the agent's published Review from the daemon."
              error={error}
              isPending
              onRetry={(): void => {
                view.refetch()
                reading.refetch()
                reviewed.refetch()
              }}
              symbol="checkmark.seal"
              title="Review is loading"
            />
          </Section>
        </List>
      </ScreenHost>
    )
  }

  if (error !== null && error !== undefined) {
    return (
      <ScreenHost>
        <List>
          <Section>
            <QueryNotice
              description="The daemon could not return this Review."
              error={error}
              isPending={false}
              onRetry={(): void => {
                view.refetch()
                reading.refetch()
                reviewed.refetch()
              }}
              symbol="checkmark.seal"
              title="Review unavailable"
            />
          </Section>
        </List>
      </ScreenHost>
    )
  }

  // Empty unit of work → Glance (what’s in flight), not a dead-end card.
  if (view.data === null || reading.data === null) return <GlanceScreen />

  const evidenceEnabled = reading.data.evidence !== null
  return (
    <ScreenHost>
      <VStack spacing={8}>
        <FaceSwitcher evidenceEnabled={evidenceEnabled} face={face} onChange={setFace} />
        {face === 'intent' ? (
          <IntentFace reading={reading.data} reviewedPaths={reviewed.data ?? []} />
        ) : face === 'execution' ? (
          <ExecutionFace reading={reading.data} reviewedPaths={reviewed.data ?? []} />
        ) : (
          <EvidenceFace reading={reading.data} />
        )}
      </VStack>
    </ScreenHost>
  )
}
