import { Button, List, Section, Text, VStack } from '@expo/ui/swift-ui'
import { font, padding } from '@expo/ui/swift-ui/modifiers'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHost } from '@/components/screen-host'

import { useEvidenceHtml } from './hooks/use-evidence-html'
import { SandboxedHtml } from './sandboxed-html'

export function EvidenceScreen(): React.JSX.Element {
  return (
    <DaemonGate requires="repo">
      <EvidenceBody />
    </DaemonGate>
  )
}

function EvidenceBody(): React.JSX.Element {
  const query = useEvidenceHtml(true)

  if (query.data === undefined) {
    return (
      <ScreenHost>
        <List>
          <Section>
            <Text>{query.error?.message ?? 'Loading proof from the daemon…'}</Text>
            {query.error === null ? null : (
              <Button
                label="Retry"
                onPress={(): void => {
                  query.refetch()
                }}
                systemImage="arrow.clockwise"
              />
            )}
          </Section>
        </List>
      </ScreenHost>
    )
  }

  if (query.data === null) {
    return (
      <ScreenHost>
        <VStack modifiers={[padding({ all: 24 })]} spacing={10}>
          <Text modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>Proof cleared</Text>
          <Text modifiers={[font({ textStyle: 'body' })]}>
            This Review no longer has an evidence pack. Return to Evidence after the agent publishes
            proof again.
          </Text>
        </VStack>
      </ScreenHost>
    )
  }

  if (query.data.htmlUnavailable !== undefined) {
    return (
      <ScreenHost>
        <VStack modifiers={[padding({ all: 24 })]} spacing={10}>
          <Text modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>
            Proof is too large
          </Text>
          <Text modifiers={[font({ textStyle: 'body' })]}>
            Proof is too large for the app — open it on the desktop.
          </Text>
        </VStack>
      </ScreenHost>
    )
  }

  if (query.data.html === undefined) {
    return (
      <ScreenHost>
        <VStack modifiers={[padding({ all: 24 })]} spacing={10}>
          <Text modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>No proof body</Text>
          <Text modifiers={[font({ textStyle: 'body' })]}>
            The evidence checks are available, but the HTML proof could not be read.
          </Text>
        </VStack>
      </ScreenHost>
    )
  }

  return (
    <ScreenHost>
      <SandboxedHtml html={query.data.html} scrollEnabled />
    </ScreenHost>
  )
}
