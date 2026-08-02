import { Button, HStack, Image, ScrollView, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import {
  buttonStyle,
  contentShape,
  disabled,
  font,
  frame,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers'
import { router, Stack, useLocalSearchParams } from 'expo-router'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHost } from '@/components/screen-host'
import type { ReadingFile } from '@/lib/daemon/procedures/review'
import { openDiff, openFile } from '@/lib/surface-handoffs'
import { footnote, monospace, secondary } from '@/theme/modifiers'

import { useFeatureReading } from './hooks/use-feature-reading'
import { reviewChapters } from './review-outline'
import { SandboxedHtml } from './sandboxed-html'

export function ChapterScreen(): React.JSX.Element {
  return (
    <DaemonGate requires="repo">
      <ChapterBody />
    </DaemonGate>
  )
}

function ChapterBody(): React.JSX.Element {
  const params = useLocalSearchParams<{ index?: string }>()
  const query = useFeatureReading()
  const requestedIndex = Number.parseInt(typeof params.index === 'string' ? params.index : '0', 10)

  if (query.data === undefined) return <ChapterMessage message="Loading chapter…" />
  if (query.data === null) return <ChapterMessage message="This Review has been cleared." />

  const chapters = reviewChapters(query.data)
  const index = Number.isFinite(requestedIndex)
    ? Math.min(Math.max(requestedIndex, 0), Math.max(chapters.length - 1, 0))
    : 0
  const chapter = chapters[index]
  if (chapter === undefined) return <ChapterMessage message="No Intent chapters yet." />

  return (
    <>
      <Stack.Screen options={{ title: chapter.title }} />
      <ScreenHost>
        <ScrollView>
          <VStack alignment="leading" modifiers={[padding({ all: 20 })]} spacing={16}>
            {chapter.prose === '' ? null : (
              <Text modifiers={[font({ textStyle: 'body' })]}>{chapter.prose}</Text>
            )}
            {chapter.diagram === undefined ? null : (
              <SandboxedHtml
                height={320}
                html={`<html><body>${chapter.diagram}</body></html>`}
                scrollEnabled={false}
              />
            )}
            {chapter.html === undefined ? null : (
              <SandboxedHtml
                height={chapter.htmlHeight ?? 448}
                html={chapter.html}
                scrollEnabled={false}
              />
            )}
            {chapter.files.length === 0 ? null : (
              <VStack alignment="leading" spacing={8}>
                <Text modifiers={[font({ textStyle: 'headline' })]}>Files in this chapter</Text>
                {chapter.files.map((file) => (
                  <ChapterFileRow file={file} key={file.path} />
                ))}
              </VStack>
            )}
            <HStack spacing={10}>
              <Button
                label="Previous"
                onPress={(): void => moveToChapter(index - 1, chapters.length)}
                modifiers={[
                  buttonStyle('bordered'),
                  frame({ maxWidth: Infinity }),
                  disabled(index === 0),
                ]}
              />
              <Button
                label="Next"
                onPress={(): void => moveToChapter(index + 1, chapters.length)}
                modifiers={[
                  buttonStyle('bordered'),
                  frame({ maxWidth: Infinity }),
                  disabled(index >= chapters.length - 1),
                ]}
              />
            </HStack>
          </VStack>
        </ScrollView>
      </ScreenHost>
    </>
  )
}

function moveToChapter(next: number, count: number): void {
  if (next < 0 || next >= count) return
  router.replace({
    params: { index: String(next) },
    pathname: '/(tabs)/(review)/chapter',
  })
}

function ChapterFileRow({ file }: { file: ReadingFile }): React.JSX.Element {
  const name = file.path.split('/').at(-1) ?? file.path
  const directory = file.path.split('/').slice(0, -1).join('/')
  return (
    <Button
      modifiers={[
        buttonStyle('plain'),
        contentShape(shapes.rectangle()),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
      ]}
      onPress={(): void => {
        if (file.source === 'changed') openDiff(file.path)
        else openFile(file.path)
      }}
    >
      <HStack modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]} spacing={8}>
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[monospace]}>{name}</Text>
          {directory === '' ? null : <Text modifiers={[footnote, secondary]}>{directory}</Text>}
        </VStack>
        <Spacer />
        <Image modifiers={[secondary]} size={12} systemName="chevron.right" />
      </HStack>
    </Button>
  )
}

function ChapterMessage({ message }: { message: string }): React.JSX.Element {
  return (
    <ScreenHost>
      <VStack modifiers={[padding({ all: 24 })]} spacing={8}>
        <Text modifiers={[font({ textStyle: 'body' })]}>{message}</Text>
      </VStack>
    </ScreenHost>
  )
}
