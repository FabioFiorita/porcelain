import {
  verdictSections,
  type ReviewRevision,
} from '@porcelain/client/reviews/rules';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/shared/lib/utils';

export function ReviewVerdict({ revision }: { revision: ReviewRevision }) {
  const sections = verdictSections(revision);
  return (
    <section aria-label="Verdict" className="flex min-w-0 flex-col gap-6">
      <section aria-label="You asked" className="flex flex-col gap-2">
        <p className="text-lg leading-7 whitespace-pre-wrap wrap-anywhere text-foreground-2">
          <span className="text-muted-foreground">You asked: </span>
          {sections.asked.text}
        </p>
        {sections.asked.links.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {sections.asked.links.map((link) => (
              <li key={link.url} className="min-w-0">
                <a
                  className="text-sm font-medium wrap-anywhere underline underline-offset-2"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section
        aria-label="Recommendation"
        className={cn(
          'flex flex-col gap-2 rounded-xl border bg-muted px-4 py-3',
          sections.recommendation.value === 'hold' &&
            'border-warn-border bg-warn-soft',
        )}
      >
        <h3
          aria-label={`Recommendation: ${sections.recommendation.label}`}
          className="flex flex-wrap items-center gap-2 text-sm font-medium"
        >
          <Badge variant="outline">{sections.recommendation.label}</Badge>
          Recommendation: {sections.recommendation.label}
        </h3>
        <ol className="flex list-outside list-decimal flex-col gap-1 pl-5 text-sm">
          {sections.recommendation.reasons.map((reason, index) => (
            <li key={index} className="pl-1 wrap-anywhere">
              {reason}
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
