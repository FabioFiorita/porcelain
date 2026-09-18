import { cn } from 'cn';
import { Empty, Section } from '@/components/lab/bits';
import { SourceLink } from '@/components/lab/source';
import { Badge } from '@/components/ui/badge';
import { areas, areaTests, specAudits, verdictTone } from '@/lib/map';
import { href } from '@/lib/route';

export function TestsPage({
  area: areaId,
  spec: specPath,
}: {
  area?: string;
  spec?: string;
}) {
  const area = areas.find((candidate) => candidate.id === areaId);
  const specs = area
    ? specAudits.filter((spec) => spec.areas.includes(area.id))
    : specAudits;
  const spec = specAudits.find((candidate) => candidate.file === specPath);
  const counts = ['strong', 'adequate', 'weak', 'misleading'].map(
    (verdict) =>
      [
        verdict,
        specs.filter((item) => item.verdict === verdict).length,
      ] as const,
  );
  if (specAudits.length === 0)
    return (
      <div className="p-6">
        <Empty>
          The test audit isn't written yet
          (design/server-lab/src/map/tests-*.ts).
        </Empty>
      </div>
    );
  return (
    <div className="grid h-full grid-cols-[240px_minmax(0,1fr)_minmax(0,1.2fr)]">
      <aside className="min-h-0 overflow-auto border-r p-2">
        <a
          href={href('tests')}
          className={cn(
            'block rounded-lg px-2.5 py-1.5 text-sm hover:bg-muted',
            !area && 'bg-muted font-medium',
          )}
        >
          All specs ({specAudits.length})
        </a>
        {areas.map((candidate) => {
          const tests = areaTests(candidate.id);
          return (
            <a
              key={candidate.id}
              href={href('tests', candidate.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-muted',
                candidate.id === area?.id && 'bg-muted font-medium',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{candidate.title}</span>
              <span
                className={cn('text-[10px]', verdictTone[tests.verdict ?? ''])}
              >
                {tests.verdict}
              </span>
            </a>
          );
        })}
      </aside>
      <div className="min-h-0 overflow-auto border-r p-3">
        {area && (
          <div className="mb-4 space-y-2 px-1">
            <h1 className="font-semibold">{area.title}</h1>
            {areaTests(area.id).summaries.map((summary) => (
              <p
                key={summary.summary}
                className="text-sm text-muted-foreground"
              >
                {summary.summary}
              </p>
            ))}
            {areaTests(area.id).missing.length > 0 && (
              <details open className="text-sm">
                <summary className="cursor-pointer font-medium">
                  Tests that should exist
                </summary>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                  {areaTests(area.id).missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
        <div className="mb-2 flex flex-wrap gap-3 px-1 text-xs">
          {counts.map(([verdict, value]) => (
            <span key={verdict} className={verdictTone[verdict]}>
              {value} {verdict}
            </span>
          ))}
        </div>
        {specs.map((item) => (
          <a
            key={item.file}
            href={href('tests', area?.id ?? 'all', ...item.file.split('/'))}
            className={cn(
              'block rounded-lg px-2 py-1.5 hover:bg-muted',
              spec?.file === item.file && 'bg-muted ring-1 ring-border',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {item.file.replace(/^(apps|packages)\//, '')}
              </span>
              <span className={cn('text-[11px]', verdictTone[item.verdict])}>
                {item.verdict}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {item.kind} · {item.tests.length} tests · real:{' '}
              {item.real.join(', ') || 'nothing'}
            </div>
          </a>
        ))}
      </div>
      <div className="min-h-0 overflow-auto p-4">
        {spec ? (
          <div className="space-y-6">
            <div className="space-y-1">
              <SourceLink source={{ path: spec.file }} className="text-sm" />
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className={verdictTone[spec.verdict]}>
                  {spec.verdict}
                </Badge>
                <Badge variant="outline">{spec.kind}</Badge>
                {spec.areas.map((id) => (
                  <Badge key={id} variant="secondary">
                    {id}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Section title="Real">
                <p className="text-sm text-muted-foreground">
                  {spec.real.join(', ') || 'Nothing: everything is faked.'}
                </p>
              </Section>
              <Section title="Faked">
                <p className="text-sm text-muted-foreground">
                  {spec.fakes.join(', ') || 'Nothing.'}
                </p>
              </Section>
            </div>
            <Section
              title="Gaps"
              description="Plausible failures that would still pass."
            >
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {spec.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </Section>
            <Section title="Strengths">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {spec.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
            </Section>
            <Section title={`What each test asserts (${spec.tests.length})`}>
              <div className="space-y-2">
                {spec.tests.map((test) => (
                  <div key={test.name} className="text-sm">
                    <div className="font-medium">{test.name}</div>
                    <div className="text-muted-foreground">{test.asserts}</div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        ) : (
          <Empty>Pick a spec to see what it really checks.</Empty>
        )}
      </div>
    </div>
  );
}
