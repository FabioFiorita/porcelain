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

type Credit = 'credited' | 'neutral' | 'unknown';

const phaseLabels: Record<Phase, string> = {
  setup: 'setup request',
  request: 'request',
  'follow-up': 'follow-up request',
};

function contents(): Contents {
  return { leaves: new Set(), texts: [] };
}

function holds(part: Contents, value: unknown): boolean {
  if (part.leaves.has(value)) return true;
  return (
    typeof value === 'string' &&
    value !== '' &&
    part.texts.some((entry) => entry.includes(value))
  );
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
    this.index(value, this.observation(label, undefined), 'value');
  }

  judge(actual: unknown): Judgement {
    const touched = this.touched;
    this.touched = [];
    const sources = new Set<string>();
    const evidence: (() => void)[] = [];
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
      sources.add(
        part === 'value' ? observation.label : `${observation.label} ${part}`,
      );
      return true;
    };
    const primitive = (value: unknown): boolean => {
      const exact = touched.findLast(
        (entry) => !entry.consumed && Object.is(entry.value, value),
      );
      if (exact) {
        exact.consumed = true;
        return credit(exact.observation, exact.part);
      }
      if (value === undefined || typeof value === 'boolean') return false;
      for (const entry of [...touched].reverse()) {
        const part = entry.observation.parts.get(entry.part);
        if (part && holds(part, value))
          return credit(entry.observation, entry.part);
      }
      for (const observation of [...this.observations].reverse())
        for (const [name, part] of observation.parts)
          if (name !== 'status' && holds(part, value))
            return credit(observation, name);
      return false;
    };
    const visit = (value: unknown, top: boolean): Credit => {
      if (typeof value !== 'object' || value === null) {
        if (primitive(value)) return 'credited';
        return !top && (value === undefined || typeof value === 'boolean')
          ? 'neutral'
          : 'unknown';
      }
      const node = this.nodes.get(value);
      if (node)
        return credit(node.observation, node.part) ? 'credited' : 'unknown';
      const children = (
        Array.isArray(value) ? value : Object.values(value)
      ).map((child) => visit(child, false));
      if (children.includes('unknown')) return 'unknown';
      if (children.includes('credited')) return 'credited';
      return top ? 'unknown' : 'neutral';
    };
    const count = () => {
      for (const apply of evidence) apply();
    };
    if (visit(actual, true) === 'credited')
      return { sources: [...sources], count };
    return {
      sources: [...sources],
      weak: 'its actual value was not taken from a response, a notice, Git or a file',
      count: () => undefined,
    };
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
    const observation: Observation = { label, exchange, parts: new Map() };
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
