import type {
  Area,
  AreaId,
  AreaTestSummary,
  Flow,
  SpecAudit,
} from '../map/types';
import type { Trace } from './lab';

// Curated from the server code; absent files simply render as empty.
const modules = import.meta.glob<Record<string, unknown>>('../map/*.ts', {
  eager: true,
});
const exported = <T>(name: string): T[] =>
  Object.values(modules).flatMap(
    (module) => (module[name] as T[] | undefined) ?? [],
  );

export const areas: Area[] = exported<Area>('areas');
export const specAudits: SpecAudit[] = [
  ...exported<SpecAudit>('serverSpecAudits'),
  ...exported<SpecAudit>('coreSpecAudits'),
];
const summaries = [
  ...exported<AreaTestSummary>('serverAreaSummaries'),
  ...exported<AreaTestSummary>('coreAreaSummaries'),
];

const rank = { misleading: 0, weak: 1, adequate: 2, strong: 3 } as const;

/** Both audits cover different specs; the weaker verdict wins for an area. */
export function areaTests(area: AreaId) {
  const parts = summaries.filter((summary) => summary.area === area);
  const specs = specAudits.filter((spec) => spec.areas.includes(area));
  const verdict = parts.reduce<AreaTestSummary['verdict'] | undefined>(
    (worst, part) =>
      worst === undefined || rank[part.verdict] < rank[worst]
        ? part.verdict
        : worst,
    undefined,
  );
  return {
    verdict,
    summaries: parts,
    missing: parts.flatMap((part) => part.missing),
    specs,
  };
}

export const areaById = (id: string | undefined) =>
  areas.find((area) => area.id === id);

export function flowById(id: string | undefined) {
  for (const area of areas)
    for (const flow of area.flows) if (flow.id === id) return { area, flow };
  return undefined;
}

export function flowForTrace(
  trace: Trace,
): { area: Area; flow: Flow } | undefined {
  if (!trace.route) return undefined;
  for (const area of areas)
    for (const flow of area.flows)
      if (
        flow.endpoint &&
        flow.endpoint.path === trace.route &&
        flow.endpoint.method === trace.method
      )
        return { area, flow };
  return undefined;
}

export function tracesForFlow(flow: Flow, traces: Trace[]) {
  if (!flow.endpoint) return [];
  const { method, path } = flow.endpoint;
  return traces.filter(
    (trace) => trace.route === path && trace.method === method,
  );
}

export const verdictTone: Record<string, string> = {
  strong: 'text-[var(--lab-ok)]',
  adequate: 'text-muted-foreground',
  weak: 'text-[var(--lab-warn)]',
  misleading: 'text-[var(--lab-danger)]',
};
