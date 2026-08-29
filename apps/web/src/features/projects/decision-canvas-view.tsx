import type {
  CanvasFileReference,
  DecisionOption,
  StructuredCanvasV2Document,
} from '@porcelain/contracts/projects'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { fileName } from '@renderer/lib/paths'
import { activeTabTarget, targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'
import { Check, CircleAlert, FileCode2, Gauge, Lightbulb, Scale, X } from 'lucide-react'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

function TextList({
  items,
  empty,
}: {
  items: readonly string[]
  empty: string
}): React.JSX.Element {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="space-y-2 text-sm leading-6">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function FileReferences({
  references,
  onOpen,
}: {
  references: readonly CanvasFileReference[]
  onOpen: (reference: CanvasFileReference) => void
}): React.JSX.Element | null {
  if (references.length === 0) return null
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Repository references</legend>
      {references.map((reference) => (
        <Button
          key={`${reference.path}:${reference.line ?? ''}`}
          type="button"
          variant="outline"
          size="sm"
          className="h-auto min-h-8 max-w-full justify-start gap-2 py-1.5 font-mono text-xs"
          onClick={() => onOpen(reference)}
        >
          <FileCode2 className="size-3.5 shrink-0" />
          <span className="truncate">
            {reference.label ?? reference.path}
            {reference.line === undefined ? '' : `:${reference.line}`}
          </span>
        </Button>
      ))}
    </fieldset>
  )
}

function OptionView({
  option,
  onOpen,
}: {
  option: DecisionOption
  onOpen: (reference: CanvasFileReference) => void
}): React.JSX.Element {
  return (
    <article className="mx-auto w-full max-w-5xl space-y-8 p-5 sm:p-8">
      <header className="space-y-3">
        <Badge variant="secondary">Option</Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{option.name}</h1>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">{option.summary}</p>
        <FileReferences references={option.references} onOpen={onOpen} />
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            <Check className="size-4 text-emerald-600 dark:text-emerald-400" /> Pros
          </h2>
          <TextList items={option.pros} empty="No advantages recorded." />
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            <X className="size-4 text-rose-600 dark:text-rose-400" /> Cons
          </h2>
          <TextList items={option.cons} empty="No disadvantages recorded." />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Risks">
          {option.risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No risks recorded.</p>
          ) : (
            <div className="space-y-3">
              {option.risks.map((risk) => (
                <div key={risk.summary} className="rounded-lg border bg-muted/20 p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{risk.summary}</p>
                    {risk.severity === undefined ? null : (
                      <Badge variant="outline" className="capitalize">
                        {risk.severity}
                      </Badge>
                    )}
                  </div>
                  {risk.mitigation === undefined ? null : (
                    <p className="mt-2 leading-6 text-muted-foreground">
                      Mitigation: {risk.mitigation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section title="Effort">
          <p className="rounded-lg border bg-muted/20 p-4 text-sm leading-6">
            {option.effort ?? 'No effort assessment recorded.'}
          </p>
        </Section>
      </div>
    </article>
  )
}

const ratingTone = {
  poor: 'border-rose-500/30 bg-rose-500/10',
  fair: 'border-amber-500/30 bg-amber-500/10',
  good: 'border-sky-500/30 bg-sky-500/10',
  strong: 'border-emerald-500/30 bg-emerald-500/10',
} as const

function ComparisonView({ document }: { document: StructuredCanvasV2Document }): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 p-5 sm:p-8">
      <header className="space-y-2">
        <Badge variant="secondary" className="gap-1.5">
          <Scale className="size-3.5" /> Comparison
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Compare the options</h1>
        <p className="text-sm text-muted-foreground">
          Assessments are explanatory signals, not code truth or review state.
        </p>
      </header>
      {document.criteria.map((criterion) => (
        <section key={criterion.id} className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
          <div>
            <h2 className="font-semibold">{criterion.label}</h2>
            {criterion.description === undefined ? null : (
              <p className="mt-1 text-sm text-muted-foreground">{criterion.description}</p>
            )}
          </div>
          <div
            data-testid={`decision-comparison-${criterion.id}`}
            className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
          >
            {document.options.map((option) => {
              const assessment = document.assessments.find(
                (item) => item.optionId === option.id && item.criterionId === criterion.id,
              )
              return (
                <article
                  key={option.id}
                  className={`min-w-0 rounded-lg border p-4 ${
                    assessment === undefined ? 'bg-muted/20' : ratingTone[assessment.rating]
                  }`}
                >
                  <h3 className="truncate text-sm font-semibold">{option.name}</h3>
                  {assessment === undefined ? (
                    <p className="mt-2 text-sm text-muted-foreground">Not assessed</p>
                  ) : (
                    <>
                      <Badge variant="outline" className="mt-2 capitalize">
                        {assessment.rating}
                      </Badge>
                      <p className="mt-3 text-sm leading-6">{assessment.note}</p>
                    </>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export function DecisionCanvasView({
  document,
  repoPath,
}: {
  document: StructuredCanvasV2Document
  repoPath?: string
}): React.JSX.Element {
  const openTab = useTabsStore((state) => state.openTab)
  const openReference = (reference: CanvasFileReference): void => {
    if (repoPath === undefined) return
    openTab(
      targetedTab(
        'file',
        `${repoPath}/${reference.path}`,
        {
          title: fileName(reference.path),
          ...(reference.line === undefined ? {} : { line: reference.line }),
        },
        activeTabTarget(),
      ),
    )
  }
  const finalLabel = document.decision === undefined ? 'Recommendation' : 'Decision'

  return (
    <Tabs defaultValue="summary" className="flex h-full min-h-0 flex-col gap-0">
      <div className="shrink-0 overflow-x-auto border-b px-3 py-2 sm:px-5">
        <TabsList
          variant="line"
          aria-label="Decision Canvas views"
          className="w-max min-w-full justify-start"
        >
          <TabsTrigger value="summary">Summary</TabsTrigger>
          {document.options.map((option) => (
            <TabsTrigger key={option.id} value={`option-${option.id}`}>
              {option.name}
            </TabsTrigger>
          ))}
          <TabsTrigger value="compare">Compare</TabsTrigger>
          <TabsTrigger value="recommendation">{finalLabel}</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="summary" className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto w-full max-w-5xl space-y-8 p-5 sm:p-8">
          <header className="space-y-4">
            <Badge variant="secondary" className="gap-1.5">
              <Lightbulb className="size-3.5" /> Decision / RFC
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{document.title}</h1>
            <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{document.summary}</p>
            <FileReferences references={document.references} onOpen={openReference} />
          </header>
          {document.context === undefined ? null : (
            <Section title="Context">
              <p className="max-w-3xl whitespace-pre-wrap text-sm leading-7">{document.context}</p>
            </Section>
          )}
          <Section title="Options at a glance">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {document.options.map((option) => (
                <div key={option.id} className="rounded-xl border bg-card p-4">
                  <h3 className="font-semibold">{option.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{option.summary}</p>
                </div>
              ))}
            </div>
          </Section>
        </article>
      </TabsContent>
      {document.options.map((option) => (
        <TabsContent
          key={option.id}
          value={`option-${option.id}`}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <OptionView option={option} onOpen={openReference} />
        </TabsContent>
      ))}
      <TabsContent value="compare" className="min-h-0 flex-1 overflow-y-auto">
        <ComparisonView document={document} />
      </TabsContent>
      <TabsContent value="recommendation" className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto w-full max-w-5xl space-y-8 p-5 sm:p-8">
          <header className="space-y-3">
            <Badge variant="secondary" className="gap-1.5">
              <Gauge className="size-3.5" /> {finalLabel}
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {document.recommendation.summary}
            </h1>
            <Badge variant="outline" className="capitalize">
              {document.recommendation.confidence} confidence
            </Badge>
          </header>
          <Section title="Rationale">
            <TextList items={document.recommendation.rationale} empty="No rationale recorded." />
          </Section>
          <div className="grid gap-6 md:grid-cols-2">
            <Section title="Assumptions">
              <TextList
                items={document.recommendation.assumptions}
                empty="No assumptions recorded."
              />
            </Section>
            <Section title="What would change this">
              <TextList
                items={document.recommendation.changeConditions}
                empty="No change conditions recorded."
              />
            </Section>
          </div>
          <FileReferences references={document.recommendation.references} onOpen={openReference} />
          {document.decision === undefined ? null : (
            <section className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CircleAlert className="size-5" /> Recorded final decision
              </h2>
              <p className="text-base leading-7">{document.decision.summary}</p>
              <TextList
                items={document.decision.rationale}
                empty="No additional rationale recorded."
              />
              <FileReferences references={document.decision.references} onOpen={openReference} />
            </section>
          )}
        </article>
      </TabsContent>
    </Tabs>
  )
}
