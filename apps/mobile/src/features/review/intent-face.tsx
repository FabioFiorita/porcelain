import { Button, HStack, Image, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import {
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'

import type { FeatureReading } from '@/lib/daemon/procedures/review'
import { footnote, secondary } from '@/theme/modifiers'

import { lifecycleBadgeLabel, lifecycleDetail, reviewLifecyclePhase } from './lifecycle'
import { reviewChapters } from './review-outline'
import { SandboxedHtml } from './sandboxed-html'

const readyStyle = foregroundStyle({ color: '#34C759', type: 'color' })

export function IntentFace({
  reading,
  reviewedPaths,
}: {
  reading: FeatureReading
  reviewedPaths: readonly string[]
}): React.JSX.Element {
  const phase = reviewLifecyclePhase(reading, reviewedPaths)
  const chapters = reviewChapters(reading)
  const hasDocument = reading.thesis?.trim() !== '' || reading.sections.length > 0

  return (
    <List>
      <Section>
        <VStack alignment="leading" spacing={8}>
          <HStack spacing={8}>
            <VStack alignment="leading" spacing={2}>
              <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), lineLimit(2)]}>
                {reading.name}
              </Text>
              <Text modifiers={[footnote, secondary]}>
                {lifecycleDetail(reading, phase === 'empty' ? 'in_progress' : phase)}
              </Text>
            </VStack>
            <Spacer />
            {lifecycleBadgeLabel(phase) === null ? null : (
              <Text modifiers={[footnote, phase === 'ready_to_close' ? readyStyle : secondary]}>
                {lifecycleBadgeLabel(phase)}
              </Text>
            )}
          </HStack>
          {phase === 'ready_to_close' ? (
            <Button
              label="Open Changes"
              modifiers={[buttonStyle('bordered')]}
              onPress={(): void => router.push('/(tabs)/(changes)')}
              systemImage="arrow.triangle.branch"
            />
          ) : null}
        </VStack>
      </Section>
      {reading.thesis?.trim() === '' || reading.thesis === undefined ? null : (
        <Section title="Why">
          <Text modifiers={[padding({ vertical: 4 })]}>{reading.thesis}</Text>
        </Section>
      )}
      {chapters.length === 0 && !hasDocument ? (
        <Section>
          <Text modifiers={[secondary]}>
            No Intent narrative yet. The agent can publish a thesis and walkthrough chapters as the
            unit grows.
          </Text>
        </Section>
      ) : null}
      {chapters.length === 0 ? null : (
        <Section title="Chapters">
          {chapters.map((chapter) => (
            <ChapterRow chapter={chapter} key={chapter.index} />
          ))}
        </Section>
      )}
      {reading.canvas === undefined ? null : (
        <Section title="Canvas">
          {reading.canvas.medium === 'html' ? (
            <SandboxedHtml html={reading.canvas.html} height={448} scrollEnabled={false} />
          ) : (
            <Text modifiers={[secondary]}>Board canvas — open on the desktop app.</Text>
          )}
        </Section>
      )}
    </List>
  )
}

function ChapterRow({
  chapter,
}: {
  chapter: ReturnType<typeof reviewChapters>[number]
}): React.JSX.Element {
  const detail = chapter.moreFiles
    ? `${chapter.files.length} file${chapter.files.length === 1 ? '' : 's'}`
    : `${chapter.files.length} file${chapter.files.length === 1 ? '' : 's'}`
  return (
    <Button
      modifiers={[
        buttonStyle('plain'),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
      ]}
      onPress={(): void =>
        router.push({
          params: { index: String(chapter.index) },
          pathname: '/(tabs)/(review)/chapter',
        })
      }
    >
      <HStack modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]} spacing={10}>
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[font({ weight: 'semibold' })]}
          >{`${chapter.index + 1}. ${chapter.title}`}</Text>
          <Text modifiers={[footnote, secondary]}>{detail}</Text>
        </VStack>
        <Spacer />
        <Image modifiers={[secondary]} size={13} systemName="chevron.right" />
      </HStack>
    </Button>
  )
}
