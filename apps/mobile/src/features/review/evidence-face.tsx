import { Button, HStack, Image, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'

import type { FeatureReading } from '@/lib/daemon/procedures/review'

import { useEvidenceMeta } from './hooks/use-evidence-meta'

type CheckStatus = 'pass' | 'fail' | 'skip'

function overallStatus(checks: readonly { status: CheckStatus }[]): 'pass' | 'fail' | null {
  if (checks.some((check) => check.status === 'fail')) return 'fail'
  if (checks.some((check) => check.status === 'pass')) return 'pass'
  return null
}

const checkSymbols = {
  fail: 'xmark.circle.fill',
  pass: 'checkmark.circle.fill',
  skip: 'minus.circle.fill',
} as const

const checkColors: Record<CheckStatus, string> = {
  fail: '#FF3B30',
  pass: '#34C759',
  skip: '#8E8E93',
}

export function EvidenceFace({ reading }: { reading: FeatureReading }): React.JSX.Element {
  const metaQuery = useEvidenceMeta()
  const evidence = metaQuery.data ?? reading.evidence
  if (evidence === null) {
    return (
      <List>
        <Section>
          <Text>Evidence is disabled until the agent publishes a proof pack.</Text>
        </Section>
      </List>
    )
  }

  const overall = overallStatus(evidence.checks)
  return (
    <List>
      <Section>
        <HStack spacing={8}>
          <VStack alignment="leading" spacing={3}>
            <Text modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>
              {evidence.title}
            </Text>
            <Text
              modifiers={[font({ textStyle: 'footnote' })]}
            >{`Updated ${evidence.updatedAt}`}</Text>
          </VStack>
          <Spacer />
          {overall === null ? null : (
            <Text modifiers={[foregroundStyle({ color: checkColors[overall], type: 'color' })]}>
              {overall === 'pass' ? 'Pass' : 'Fail'}
            </Text>
          )}
        </HStack>
        <Button
          label="Open proof"
          onPress={(): void => router.push('/evidence')}
          systemImage="doc.richtext"
        />
      </Section>
      <Section title="Checks">
        {evidence.checks.length === 0 ? <Text>No structured checks yet.</Text> : null}
        {evidence.checks.map((check) => (
          <CheckRow check={check} key={`${check.label}-${check.status}-${check.detail ?? ''}`} />
        ))}
      </Section>
    </List>
  )
}

function CheckRow({
  check,
}: {
  check: { label: string; status: CheckStatus; detail?: string }
}): React.JSX.Element {
  return (
    <HStack alignment="top" spacing={8}>
      <Image color={checkColors[check.status]} size={17} systemName={checkSymbols[check.status]} />
      <VStack alignment="leading" spacing={2}>
        <Text>{check.label}</Text>
        {check.detail === undefined ? null : (
          <Text modifiers={[font({ textStyle: 'footnote' })]}>{check.detail}</Text>
        )}
      </VStack>
    </HStack>
  )
}
