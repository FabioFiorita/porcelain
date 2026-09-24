import { isDeepStrictEqual } from 'node:util';
import {
  isRecord,
  type HttpRequest,
  type HttpResponse,
  type Phase,
} from './feature.ts';

type Part = 'status' | 'body' | 'header' | 'value';

type Exchange = {
  label: string;
  phase: Phase;
  request: string;
  viaRead: boolean;
  evidence: { status: boolean; body: boolean };
};

type Contents = { leaves: Set<unknown>; texts: string[] };

type Observation = {
  label: string;
  order: number;
  exchange: Exchange | undefined;
  parts: Map<Part, Contents>;
};

type Touch = {
  observation: Observation;
  part: Part;
  value: unknown;
  consumed: boolean;
};

export type Judgement = {
  sources: string[];
  weak?: string;
  count(): void;
};

export type Claim =
  | { kind: 'exact' | 'partial'; expected: unknown }
  | { kind: 'differs'; baseline: unknown }
  | { kind: 'contract'; exported: boolean }
  | { kind: 'match' };

type Credit = 'credited' | 'neutral' | 'unknown';

export const weakness = {
  contract: 'its schema is not one exported from @porcelain/contracts',
  copied: 'its expected value was taken from the response it checks',
  baseline:
    'the value it must differ from was not observed in an earlier exchange',
  computed: 'a boolean inside its actual value was computed by the case',
  fragment:
    'its actual value is only part of an observed text; assert the whole value or use checkMatch',
  unobserved:
    'its actual value was not taken from a response, a notice, Git or a file',
};

const phaseLabels: Record<Phase, string> = {
  setup: 'setup request',
  request: 'request',
  'follow-up': 'follow-up request',
};

function contents(): Contents {
  return { leaves: new Set(), texts: [] };
}

function fragmentOf(part: Contents, value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value !== '' &&
    part.texts.some((entry) => entry.includes(value))
  );
}

function textLeaves(value: string): string[] {
  return [value.trim(), ...value.split('\n')];
}

function emptyPartial(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(emptyPartial);
  if (!isRecord(value)) return false;
  const entries = Object.values(value);
  return entries.length === 0 || entries.some(emptyPartial);
}

export function expectedWeakness(
  expected: unknown,
  kind: 'exact' | 'partial' | 'differs',
): string | undefined {
  if (kind === 'differs')
    return isRecord(expected) &&
      expected.differsFrom !== undefined &&
      typeof expected.differsFrom !== 'boolean'
      ? undefined
      : 'the value it must differ from is undefined or a boolean';
  const partial = kind === 'partial';
  if (typeof expected === 'boolean')
    return 'its expected value is a bare boolean';
  if (isRecord(expected) && Object.keys(expected).length === 0)
    return 'its expected value is {}';
  if (partial && emptyPartial(expected))
    return 'its partial holds {}, which matches anything';
  return undefined;
}

export class Provenance {
  private readonly nodes = new WeakMap<
    object,
    { observation: Observation; part: Part }
  >();
  private readonly observations: Observation[] = [];
  private readonly exchanges: Exchange[] = [];
  private touched: Touch[] = [];
  private readonly counts: Record<Phase, number> = {
    setup: 0,
    request: 0,
    'follow-up': 0,
  };

  exchange(
    phase: Phase,
    request: HttpRequest,
    response: HttpResponse,
    viaRead: boolean,
  ): HttpResponse {
    this.counts[phase] += 1;
    const exchange: Exchange = {
      label: `${phaseLabels[phase]} ${this.counts[phase]}`,
      phase,
      request: `${request.method} ${request.path}`,
      viaRead,
      evidence: { status: false, body: false },
    };
    this.exchanges.push(exchange);
    const observation = this.observation(exchange.label, exchange);
    this.index(response.body, observation, 'body');
    this.index(response.headers, observation, 'header');
    const touch = (part: Part, value: unknown) => {
      this.touched.push({ observation, part, value, consumed: false });
      return value;
    };
    const headers = new Proxy(response.headers, {
      get: (target, key) =>
        typeof key === 'string' ? touch('header', target[key]) : undefined,
    });
    this.nodes.set(headers, { observation, part: 'header' });
    return {
      headers,
      get status() {
        touch('status', response.status);
        return response.status;
      },
      get body() {
        touch('body', response.body);
        return response.body;
      },
    };
  }

  enter() {
    this.touched = [];
  }

  observe(label: string, value: unknown) {
    const observation = this.observation(label, undefined);
    this.index(value, observation, 'value');
    if (typeof value === 'string')
      for (const line of textLeaves(value))
        observation.parts.get('value')?.leaves.add(line);
  }

  judge(actual: unknown, claim: Claim): Judgement {
    const touched = this.touched;
    this.touched = [];
    const sources = new Set<string>();
    const credited = new Set<Observation>();
    const evidence: (() => void)[] = [];
    const booleans: boolean[] = [];
    let fragment = false;
    const credit = (observation: Observation, part: Part) => {
      const exchange = observation.exchange;
      if (exchange && part === 'status')
        evidence.push(() => {
          exchange.evidence.status = true;
        });
      if (exchange && part === 'body')
        evidence.push(() => {
          exchange.evidence.body = true;
        });
      credited.add(observation);
      sources.add(
        part === 'value' ? observation.label : `${observation.label} ${part}`,
      );
      return true;
    };
    const consume = (value: unknown) => {
      const exact = touched.findLast(
        (entry) => !entry.consumed && Object.is(entry.value, value),
      );
      if (exact) exact.consumed = true;
      return exact;
    };
    const primitive = (value: unknown): boolean => {
      const exact = consume(value);
      if (exact) return credit(exact.observation, exact.part);
      if (value === undefined || typeof value === 'boolean') return false;
      for (const entry of [...touched].reverse()) {
        const part = entry.observation.parts.get(entry.part);
        if (part?.leaves.has(value))
          return credit(entry.observation, entry.part);
      }
      for (const observation of [...this.observations].reverse())
        for (const [name, part] of observation.parts)
          if (name !== 'status' && part.leaves.has(value))
            return credit(observation, name);
      fragment ||= this.observations.some((observation) =>
        [...observation.parts.values()].some((part) => fragmentOf(part, value)),
      );
      return false;
    };
    const visit = (value: unknown, top: boolean): Credit => {
      if (typeof value !== 'object' || value === null) {
        if (primitive(value)) return 'credited';
        if (top) return 'unknown';
        if (typeof value === 'boolean') booleans.push(value);
        return value === undefined || typeof value === 'boolean'
          ? 'neutral'
          : 'unknown';
      }
      const node = this.nodes.get(value);
      if (node) {
        consume(value);
        return credit(node.observation, node.part) ? 'credited' : 'unknown';
      }
      const children = (
        Array.isArray(value) ? value : Object.values(value)
      ).map((child) => visit(child, false));
      if (children.includes('unknown')) return 'unknown';
      if (children.includes('credited')) return 'credited';
      return top ? 'unknown' : 'neutral';
    };
    const observed = visit(actual, true) === 'credited';
    const weak =
      this.claimWeakness(claim, credited, touched) ??
      (observed
        ? booleans.some((value) => !this.heldBy(credited, value))
          ? weakness.computed
          : undefined
        : fragment
          ? weakness.fragment
          : weakness.unobserved);
    if (weak === undefined)
      return {
        sources: [...sources],
        count: () => {
          for (const apply of evidence) apply();
        },
      };
    return { sources: [...sources], weak, count: () => undefined };
  }

  private claimWeakness(
    claim: Claim,
    credited: ReadonlySet<Observation>,
    touched: readonly Touch[],
  ): string | undefined {
    if (claim.kind === 'exact' || claim.kind === 'partial')
      return this.copiedFrom(claim.expected, credited) ||
        touched.some(
          (entry) =>
            !entry.consumed &&
            credited.has(entry.observation) &&
            (Object.is(entry.value, claim.expected) ||
              (typeof claim.expected === 'object' &&
                claim.expected !== null &&
                isDeepStrictEqual(entry.value, claim.expected))),
        )
        ? weakness.copied
        : undefined;
    if (claim.kind === 'contract')
      return claim.exported ? undefined : weakness.contract;
    if (claim.kind !== 'differs') return undefined;
    const earliest = Math.min(
      ...[...credited].map((observation) => observation.order),
    );
    const node =
      typeof claim.baseline === 'object' && claim.baseline !== null
        ? this.nodes.get(claim.baseline)
        : undefined;
    const origins = node
      ? [node.observation]
      : this.observations.filter((observation) =>
          this.heldBy(new Set([observation]), claim.baseline),
        );
    return origins.some(
      (observation) =>
        observation.exchange !== undefined && observation.order < earliest,
    )
      ? undefined
      : weakness.baseline;
  }

  private copiedFrom(
    value: unknown,
    credited: ReadonlySet<Observation>,
  ): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const node = this.nodes.get(value);
    if (node && credited.has(node.observation)) return true;
    return (Array.isArray(value) ? value : Object.values(value)).some((child) =>
      this.copiedFrom(child, credited),
    );
  }

  private heldBy(
    observations: ReadonlySet<Observation>,
    value: unknown,
  ): boolean {
    return [...observations].some((observation) =>
      [...observation.parts].some(
        ([name, part]) => name !== 'status' && part.leaves.has(value),
      ),
    );
  }

  problems(): string[] {
    return this.exchanges.flatMap((exchange) => {
      const described = `${exchange.label} (${exchange.request})`;
      if (exchange.phase === 'request') {
        const missing = [
          ...(exchange.evidence.status ? [] : ['status']),
          ...(exchange.evidence.body ? [] : ['body']),
        ];
        return missing.length === 0
          ? []
          : [`${described} left its ${missing.join(' and ')} unasserted`];
      }
      if (
        exchange.phase === 'follow-up' &&
        !exchange.viaRead &&
        !exchange.evidence.status
      )
        return [
          `${described} left its status unasserted; read it with read() or assert it`,
        ];
      return [];
    });
  }

  private observation(
    label: string,
    exchange: Exchange | undefined,
  ): Observation {
    const observation: Observation = {
      label,
      order: this.observations.length,
      exchange,
      parts: new Map(),
    };
    this.observations.push(observation);
    return observation;
  }

  private index(value: unknown, observation: Observation, part: Part) {
    const target = observation.parts.get(part) ?? contents();
    observation.parts.set(part, target);
    const walk = (entry: unknown) => {
      if (typeof entry === 'string') {
        target.texts.push(entry);
        const embedded = embeddedJson(entry);
        if (embedded !== undefined) walkLeaves(embedded);
      }
      if (typeof entry !== 'object' || entry === null) {
        target.leaves.add(entry);
        return;
      }
      this.nodes.set(entry, { observation, part });
      if (Array.isArray(entry)) {
        target.leaves.add(entry.length);
        for (const child of entry) walk(child);
        return;
      }
      for (const [key, child] of Object.entries(entry)) {
        target.leaves.add(key);
        walk(child);
      }
    };
    const walkLeaves = (entry: unknown) => {
      if (typeof entry !== 'object' || entry === null) {
        target.leaves.add(entry);
        if (typeof entry === 'string') target.texts.push(entry);
        return;
      }
      if (Array.isArray(entry)) target.leaves.add(entry.length);
      for (const [key, child] of Object.entries(entry)) {
        if (!Array.isArray(entry)) target.leaves.add(key);
        walkLeaves(child);
      }
    };
    walk(value);
  }
}

function embeddedJson(value: string): unknown {
  if (!/^\s*[[{]/.test(value)) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed;
  } catch {
    return undefined;
  }
}
