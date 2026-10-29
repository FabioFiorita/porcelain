import {
  ArrowUpRightIcon,
  CheckIcon,
  CircleDotIcon,
  PauseIcon,
} from 'lucide-react';
import {
  verdictSections,
  type ReviewRevision,
} from '@porcelain/client/reviews/rules';
import { cn } from '@/shared/lib/utils';

export function ReviewVerdict({ revision }: { revision: ReviewRevision }) {
  const sections = verdictSections(revision);
  const { recommendation } = sections;
  const merge = recommendation.value === 'merge';
  const RecommendationIcon = merge ? CheckIcon : PauseIcon;
  return (
    <section aria-label="Verdict" className="flex min-w-0 flex-col gap-6">
      <section aria-label="You asked" className="flex flex-col items-start">
        <p className="text-lead whitespace-pre-wrap wrap-anywhere text-foreground-2">
          <span className="text-muted-foreground">You asked: </span>“
          {sections.asked.text}”
        </p>
        {sections.asked.links.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-x-3">
            {sections.asked.links.map((link) => (
              <li key={link.url} className="min-w-0">
                <a
                  className="-ml-1.5 inline-flex h-6.5 max-w-full items-center gap-1.5 rounded-md pr-2 pl-1.5 text-ui leading-4 font-medium wrap-anywhere hover:bg-accent"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CircleDotIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">{link.title}</span>
                  <ArrowUpRightIcon className="size-3 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Recommendation" className="flex min-w-0 flex-col">
        <h3
          aria-label={`Recommendation: ${recommendation.label}`}
          className="flex flex-wrap items-center gap-x-2.5 gap-y-1"
        >
          <span
            className={`inline-flex h-7 items-center gap-1.5 rounded-full border pr-3 pl-2.5 text-ui leading-6.5 font-semibold ${
              merge
                ? 'border-brand-soft bg-brand-soft text-brand'
                : 'border-warn-border bg-warn-soft text-warn'
            }`}
          >
            <RecommendationIcon
              aria-hidden="true"
              className={cn('size-3', !merge && 'fill-current stroke-0')}
            />
            {recommendation.label}
          </span>
          <span className="text-reading leading-5 font-medium">
            The agent recommends {merge ? 'merging' : 'holding'} this change
          </span>
        </h3>
        {recommendation.reasons.length > 0 && (
          <ol className="mt-3 flex flex-col border-b">
            {recommendation.reasons.map((reason, index) => (
              <li
                key={index}
                className="flex min-w-0 border-t py-1 text-reading"
              >
                <span className="w-5.5 shrink-0 text-xs leading-5.5 font-medium text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <span className="min-w-0 wrap-anywhere">{reason}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
