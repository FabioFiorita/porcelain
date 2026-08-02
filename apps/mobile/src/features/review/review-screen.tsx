import { Button, List, Section, Text, VStack } from '@expo/ui/swift-ui'
import { font, padding } from '@expo/ui/swift-ui/modifiers'
import { ObserveInteractiveMarker } from 'expo-observe'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHeader } from '@/components/screen-header'
import { ScreenHost } from '@/components/screen-host'
import { QueryNotice } from '@/features/changes/components/query-notice'

import { EvidenceFace } from './evidence-face'
import { ExecutionFace } from './execution-face'
import { FaceSwitcher, type ReviewFace } from './face-switcher'
import { useFeatureReading } from './hooks/use-feature-reading'
import { useFeatureView } from './hooks/use-feature-view'
import { useReviewedPaths } from './hooks/use-reviewed'
import { IntentFace } from './intent-face'

export function ReviewScreen(): React.JSX.Element {
  return (
    <>
      <DaemonGate requires="repo">
        <ReviewBody />
      </DaemonGate>
      <ScreenHeader
        actions={[
          { href: '/comments', icon: 'comment', label: 'Comments' },
          { href: '/(tabs)/(board)', icon: 'board', label: 'Board' },
        ]}
        title="Review"
      />
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

  if (view.data === null || reading.data === null) return <BeginUnit />

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

function BeginUnit(): React.JSX.Element {
  return (
    <ScreenHost>
      <List>
        <Section>
          <VStack alignment="leading" modifiers={[padding({ all: 12 })]} spacing={10}>
            <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>No review yet</Text>
            <Text modifiers={[font({ textStyle: 'body' })]}>
              This is the start of a unit of work, not a dead end. Ask the agent to publish Intent
              first; Execution and Evidence grow from there.
            </Text>
            <Button
              label="Open Board"
              onPress={(): void => router.push('/(tabs)/(board)')}
              systemImage="rectangle.3.group.fill"
            />
          </VStack>
        </Section>
      </List>
    </ScreenHost>
  )
}
