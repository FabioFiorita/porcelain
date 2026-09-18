import { Button } from '@/components/ui/button';
import type { ReviewGuide } from '../../domain/guided-review';
import { MarkdownView } from './markdown-view';

type Step = ReviewGuide['steps'][number];
type Related = NonNullable<Step['related']>[number];

export function GuideStepHeader({
  guide,
  step,
  hasRelatedSource,
  onSelect,
  onRelated,
}: {
  guide: ReviewGuide;
  step: Step;
  hasRelatedSource: boolean;
  onSelect: (id: string) => void;
  onRelated: (source: Related | null) => void;
}) {
  return (
    <div className="max-h-[45%] shrink-0 overflow-auto border-b px-4 py-3">
      <p className="text-[11px] text-muted-foreground">Agent-authored guide</p>
      <p className="mt-1 max-w-[78ch] text-sm">{guide.purpose}</p>
      <nav aria-label="Review path" className="mt-3 overflow-x-auto">
        <ol className="flex w-max gap-1">
          {guide.steps.map((item, index) => (
            <li key={item.id}>
              <Button
                size="sm"
                variant={item.id === step.id ? 'secondary' : 'ghost'}
                aria-current={item.id === step.id ? 'step' : undefined}
                onClick={() => onSelect(item.id)}
              >
                {index + 1}. {item.title}
              </Button>
            </li>
          ))}
        </ol>
      </nav>
      <h2 className="mt-3 text-sm font-medium">{step.question}</h2>
      {step.note && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer">Why this matters</summary>
          <MarkdownView text={step.note} className="max-w-[78ch]" />
        </details>
      )}
      {(step.related?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">Related source:</span>
          {step.related?.map((item) => (
            <Button
              key={JSON.stringify([item.title, item.source])}
              size="xs"
              variant="ghost"
              onClick={() => onRelated(item)}
            >
              {item.title}
            </Button>
          ))}
          {hasRelatedSource && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => onRelated(null)}
            >
              Back to {step.title}
            </Button>
          )}
        </div>
      )}
      {step.verification && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer">Verification notes</summary>
          <p className="mt-2 text-muted-foreground">
            Agent-provided. Not independently verified by Porcelain.
          </p>
          <MarkdownView text={step.verification} className="max-w-[78ch]" />
        </details>
      )}
    </div>
  );
}
