import type {
  CanvasFileReference,
  DecisionCanvasDocument,
  DecisionOption,
} from '@porcelain/contracts/projects'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { SurfaceScroll } from '@/components/surface-scroll'
import { PANEL_CARD, SURFACE_GUTTER } from '@/components/surface-layout'
import { useSurfaceOpen } from '@/features/shell/use-surface-open'
import { cn } from '@/lib/utils'

type DecisionView = 'summary' | 'compare' | 'recommendation' | `option:${string}`

function Card({
  children,
  testID,
}: {
  children: React.ReactNode
  testID?: string
}): React.JSX.Element {
  return (
    <View className={cn(PANEL_CARD, 'gap-3 p-4')} testID={testID}>
      {children}
    </View>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <View className="gap-3">
      <Text className="text-base font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  )
}

function List({ items, empty }: { items: readonly string[]; empty: string }): React.JSX.Element {
  return items.length === 0 ? (
    <Text className="text-sm text-muted-foreground">{empty}</Text>
  ) : (
    <View className="gap-2">
      {items.map((item) => (
        <View key={item} className="flex-row gap-2">
          <Text className="text-sm text-muted-foreground">•</Text>
          <Text className="min-w-0 flex-1 text-sm leading-6 text-foreground">{item}</Text>
        </View>
      ))}
    </View>
  )
}

function References({
  references,
  onOpen,
}: {
  references: readonly CanvasFileReference[]
  onOpen: (reference: CanvasFileReference) => void
}): React.JSX.Element | null {
  if (references.length === 0) return null
  return (
    <View accessibilityLabel="Repository references" className="flex-row flex-wrap gap-2">
      {references.map((reference) => (
        <Pressable
          key={`${reference.path}:${reference.line ?? ''}`}
          accessibilityLabel={`Open ${reference.label ?? reference.path}${
            reference.line === undefined ? '' : ` at line ${reference.line}`
          }`}
          accessibilityRole="button"
          className="max-w-full rounded-xl border border-border bg-muted/40 px-3 py-2"
          onPress={() => onOpen(reference)}
        >
          <Text className="font-mono text-xs text-foreground" numberOfLines={1}>
            {reference.label ?? reference.path}
            {reference.line === undefined ? '' : `:${reference.line}`}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

function Summary({
  document,
  onOpen,
}: {
  document: DecisionCanvasDocument
  onOpen: (reference: CanvasFileReference) => void
}): React.JSX.Element {
  return (
    <SurfaceScroll gap={6} testID="porcelain-decision-summary">
      <View className="gap-3">
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Decision / RFC
        </Text>
        <Text className="text-3xl font-semibold leading-9 text-foreground">{document.title}</Text>
        <Text className="text-base leading-7 text-muted-foreground">{document.summary}</Text>
        <References references={document.references} onOpen={onOpen} />
      </View>
      {document.context === undefined ? null : (
        <Section title="Context">
          <Text className="text-sm leading-6 text-foreground">{document.context}</Text>
        </Section>
      )}
      <Section title="Options at a glance">
        {document.options.map((option) => (
          <Card key={option.id}>
            <Text className="font-semibold text-foreground">{option.name}</Text>
            <Text className="text-sm leading-6 text-muted-foreground">{option.summary}</Text>
          </Card>
        ))}
      </Section>
    </SurfaceScroll>
  )
}

function Option({
  option,
  onOpen,
}: {
  option: DecisionOption
  onOpen: (reference: CanvasFileReference) => void
}): React.JSX.Element {
  return (
    <SurfaceScroll gap={6} testID={`porcelain-decision-option-${option.id}`}>
      <View className="gap-3">
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Option
        </Text>
        <Text className="text-3xl font-semibold leading-9 text-foreground">{option.name}</Text>
        <Text className="text-base leading-7 text-muted-foreground">{option.summary}</Text>
        <References references={option.references} onOpen={onOpen} />
      </View>
      <Card>
        <Section title="Pros">
          <List items={option.pros} empty="No advantages recorded." />
        </Section>
      </Card>
      <Card>
        <Section title="Cons">
          <List items={option.cons} empty="No disadvantages recorded." />
        </Section>
      </Card>
      <Section title="Risks">
        {option.risks.length === 0 ? (
          <Text className="text-sm text-muted-foreground">No risks recorded.</Text>
        ) : (
          option.risks.map((risk) => (
            <Card key={risk.summary}>
              <View className="flex-row items-start justify-between gap-3">
                <Text className="min-w-0 flex-1 text-sm font-medium text-foreground">
                  {risk.summary}
                </Text>
                {risk.severity === undefined ? null : (
                  <Text className="text-xs font-semibold uppercase text-muted-foreground">
                    {risk.severity}
                  </Text>
                )}
              </View>
              {risk.mitigation === undefined ? null : (
                <Text className="text-sm leading-6 text-muted-foreground">
                  Mitigation: {risk.mitigation}
                </Text>
              )}
            </Card>
          ))
        )}
      </Section>
      <Section title="Effort">
        <Card>
          <Text className="text-sm leading-6 text-foreground">
            {option.effort ?? 'No effort assessment recorded.'}
          </Text>
        </Card>
      </Section>
    </SurfaceScroll>
  )
}

function Comparison({ document }: { document: DecisionCanvasDocument }): React.JSX.Element {
  return (
    <SurfaceScroll gap={5} testID="porcelain-decision-compare">
      <View className="gap-2">
        <Text className="text-2xl font-semibold text-foreground">Compare the options</Text>
        <Text className="text-sm leading-6 text-muted-foreground">
          Assessments explain the choice. Changes remains the source of code truth.
        </Text>
      </View>
      {document.criteria.map((criterion) => (
        <Card key={criterion.id} testID={`porcelain-decision-criterion-${criterion.id}`}>
          <Text className="font-semibold text-foreground">{criterion.label}</Text>
          {criterion.description === undefined ? null : (
            <Text className="text-sm leading-6 text-muted-foreground">{criterion.description}</Text>
          )}
          {document.options.map((option) => {
            const assessment = document.assessments.find(
              (item) => item.optionId === option.id && item.criterionId === criterion.id,
            )
            return (
              <View key={option.id} className="gap-1 border-t border-border pt-3">
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                    {option.name}
                  </Text>
                  <Text className="text-xs font-semibold uppercase text-muted-foreground">
                    {assessment?.rating ?? 'Not assessed'}
                  </Text>
                </View>
                {assessment === undefined ? null : (
                  <Text className="text-sm leading-6 text-foreground">{assessment.note}</Text>
                )}
              </View>
            )
          })}
        </Card>
      ))}
    </SurfaceScroll>
  )
}

function Recommendation({
  document,
  onOpen,
}: {
  document: DecisionCanvasDocument
  onOpen: (reference: CanvasFileReference) => void
}): React.JSX.Element {
  const label = document.decision === undefined ? 'Recommendation' : 'Decision'
  return (
    <SurfaceScroll gap={6} testID="porcelain-decision-recommendation">
      <View className="gap-3">
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Text>
        <Text className="text-2xl font-semibold leading-8 text-foreground">
          {document.recommendation.summary}
        </Text>
        <Text className="text-sm font-semibold capitalize text-muted-foreground">
          {document.recommendation.confidence} confidence
        </Text>
      </View>
      <Section title="Rationale">
        <List items={document.recommendation.rationale} empty="No rationale recorded." />
      </Section>
      <Card>
        <Section title="Assumptions">
          <List items={document.recommendation.assumptions} empty="No assumptions recorded." />
        </Section>
      </Card>
      <Card>
        <Section title="What would change this">
          <List
            items={document.recommendation.changeConditions}
            empty="No change conditions recorded."
          />
        </Section>
      </Card>
      <References references={document.recommendation.references} onOpen={onOpen} />
      {document.decision === undefined ? null : (
        <Card testID="porcelain-decision-recorded">
          <Section title="Recorded final decision">
            <Text className="text-base leading-7 text-foreground">{document.decision.summary}</Text>
            <List items={document.decision.rationale} empty="No additional rationale recorded." />
            <References references={document.decision.references} onOpen={onOpen} />
          </Section>
        </Card>
      )}
    </SurfaceScroll>
  )
}

export function DecisionCanvasView({
  document,
}: {
  document: DecisionCanvasDocument
}): React.JSX.Element {
  const [active, setActive] = useState<DecisionView>('summary')
  const open = useSurfaceOpen()
  const openReference = (reference: CanvasFileReference): void => {
    open.file(reference.path, reference.line)
  }
  const finalLabel = document.decision === undefined ? 'Recommendation' : 'Decision'
  const views: readonly { id: DecisionView; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    ...document.options.map((option) => ({
      id: `option:${option.id}` as const,
      label: option.name,
    })),
    { id: 'compare', label: 'Compare' },
    { id: 'recommendation', label: finalLabel },
  ]
  const option = active.startsWith('option:')
    ? document.options.find((item) => item.id === active.slice('option:'.length))
    : undefined

  return (
    <View className="flex-1" testID="porcelain-decision-canvas">
      <ScrollView
        horizontal
        accessibilityRole="tablist"
        className="max-h-14 shrink-0 border-b border-border"
        contentContainerClassName={cn('items-center gap-2 py-2', SURFACE_GUTTER)}
        showsHorizontalScrollIndicator={false}
      >
        {views.map((view) => {
          const selected = view.id === active
          return (
            <Pressable
              key={view.id}
              accessibilityLabel={view.label}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={cn(
                'min-h-9 justify-center rounded-2xl px-3 will-change-pressable',
                selected ? 'bg-muted' : 'active:bg-muted/50',
              )}
              testID={`porcelain-decision-view-${view.id.replace(':', '-')}`}
              onPress={() => setActive(view.id)}
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  selected ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {view.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
      {active === 'summary' ? <Summary document={document} onOpen={openReference} /> : null}
      {active === 'compare' ? <Comparison document={document} /> : null}
      {active === 'recommendation' ? (
        <Recommendation document={document} onOpen={openReference} />
      ) : null}
      {option === undefined ? null : <Option option={option} onOpen={openReference} />}
    </View>
  )
}
