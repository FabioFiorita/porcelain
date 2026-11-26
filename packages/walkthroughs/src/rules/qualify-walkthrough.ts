import type {
  WalkthroughBlock,
  WalkthroughBlockRequest,
} from '../models/blocks.ts';
import type {
  WalkthroughContent,
  WalkthroughDraft,
  WalkthroughEvidence,
  WalkthroughJob,
} from '../models/walkthrough.ts';
import { capturedDiffHunk } from './captured-excerpt.ts';

const LEFTOVER_TITLE = 'Everything else';

function withUniqueTitles<Stop extends { readonly title: string }>(
  stops: readonly Stop[],
): Stop[] {
  const taken = new Set(stops.map((stop) => stop.title));
  const seen = new Set<string>();
  return stops.map((stop) => {
    if (!seen.has(stop.title)) {
      seen.add(stop.title);
      return stop;
    }
    let number = 2;
    while (taken.has(`${stop.title} (${number})`)) number += 1;
    const title = `${stop.title} (${number})`;
    taken.add(title);
    return { ...stop, title };
  });
}

function qualifyBlock(
  block: WalkthroughBlockRequest,
  job: WalkthroughJob,
  evidence: WalkthroughEvidence,
  covered: ReadonlySet<string>,
  excerpted: ReadonlySet<string>,
): { block: WalkthroughBlock; paths: readonly string[] } | undefined {
  switch (block.kind) {
    case 'diff_excerpt': {
      const file = job.files.find(
        (item) =>
          (block.side === 'old' ? (item.oldPath ?? item.path) : item.path) ===
          block.path,
      );
      if (
        file === undefined ||
        excerpted.has(file.path) ||
        !capturedDiffHunk(job.patch, block)
      )
        return undefined;
      return {
        block: {
          ...block,
          headOid: job.run.headOid,
          contentTreeOid: job.run.contentTreeOid,
        },
        paths: [file.path],
      };
    }
    case 'before_after':
      if (
        evidence.unavailable !== undefined ||
        block.before.assetId === block.after.assetId ||
        ![block.before, block.after].every((image) =>
          evidence.assets.some((asset) => asset.id === image.assetId),
        )
      )
        return undefined;
      return { block, paths: [] };
    case 'files': {
      const [first, ...rest] = block.files.filter(
        ({ path }) =>
          !covered.has(path) && job.files.some((file) => file.path === path),
      );
      if (first === undefined) return undefined;
      return {
        block: { ...block, files: [first, ...rest] },
        paths: [first.path, ...rest.map((file) => file.path)],
      };
    }
    case 'checks':
      if (
        block.headOid !== job.run.headOid ||
        evidence.unavailable !== undefined ||
        evidence.checks === undefined
      )
        return undefined;
      return { block: { ...block, ...evidence.checks }, paths: [] };
    case 'callout': {
      const { attention, comparison } = block;
      if (
        !attention.question.trim() ||
        !attention.note.trim() ||
        (comparison !== undefined &&
          (comparison.columns.length !== 2 ||
            comparison.rows.length === 0 ||
            comparison.rows.length > 6 ||
            comparison.rows.some((row) => row.length !== 2)))
      )
        return undefined;
      if (
        comparison?.implemented === undefined ||
        comparison.columns.includes(comparison.implemented)
      )
        return { block, paths: [] };
      const { implemented: _, ...shown } = comparison;
      return { block: { ...block, comparison: shown }, paths: [] };
    }
    case 'diagram': {
      const diagram = qualifyDiagram(block, job);
      return diagram === undefined ? undefined : { block: diagram, paths: [] };
    }
  }
}

type Diagram = Extract<WalkthroughBlockRequest, { kind: 'diagram' }>;
type DiagramAnchor = NonNullable<Diagram['nodes'][number]['anchor']>;

function capturedAnchor(
  anchor: DiagramAnchor,
  job: WalkthroughJob,
): DiagramAnchor | undefined {
  const side = anchor.lines?.side ?? 'new';
  const changed = job.files.some(
    (file) =>
      (side === 'old' ? (file.oldPath ?? file.path) : file.path) ===
      anchor.path,
  );
  if (!changed) return undefined;
  if (anchor.lines === undefined) return { path: anchor.path };
  return capturedDiffHunk(job.patch, { path: anchor.path, ...anchor.lines })
    ? { path: anchor.path, lines: anchor.lines }
    : { path: anchor.path };
}

const DIAGRAM_LIMITS = {
  nodes: 12,
  edges: 20,
  id: 24,
  label: 28,
  note: 80,
  edgeLabel: 24,
  title: 80,
} as const;

const fits = (text: string | undefined, maximum: number) =>
  text === undefined || (text.trim() !== '' && text.length <= maximum);

function withinDiagramLimits(block: Diagram) {
  return (
    block.nodes.length >= 2 &&
    block.nodes.length <= DIAGRAM_LIMITS.nodes &&
    block.edges.length >= 1 &&
    block.edges.length <= DIAGRAM_LIMITS.edges &&
    fits(block.title, DIAGRAM_LIMITS.title) &&
    block.nodes.every(
      (node) =>
        fits(node.id, DIAGRAM_LIMITS.id) &&
        fits(node.label, DIAGRAM_LIMITS.label) &&
        fits(node.note, DIAGRAM_LIMITS.note) &&
        (node.anchor?.lines === undefined ||
          (node.anchor.lines.start >= 1 &&
            node.anchor.lines.end >= node.anchor.lines.start)),
    ) &&
    block.edges.every((edge) => fits(edge.label, DIAGRAM_LIMITS.edgeLabel))
  );
}

function qualifyDiagram(
  block: Diagram,
  job: WalkthroughJob,
): Diagram | undefined {
  const ids = new Set(block.nodes.map((node) => node.id));
  if (
    !withinDiagramLimits(block) ||
    ids.size !== block.nodes.length ||
    block.edges.some(
      (edge) =>
        edge.from === edge.to || !ids.has(edge.from) || !ids.has(edge.to),
    )
  )
    return undefined;
  return {
    ...block,
    nodes: block.nodes.map(({ anchor, ...node }) => {
      const kept =
        anchor === undefined ? undefined : capturedAnchor(anchor, job);
      return kept === undefined ? node : { ...node, anchor: kept };
    }),
  };
}

export function qualifyWalkthrough(
  content: WalkthroughDraft,
  job: WalkthroughJob,
  evidence: WalkthroughEvidence,
): WalkthroughContent {
  if (content.outcome === 'nothing')
    return { ...content, stops: [], stillUnclear: [] };
  const covered = new Set<string>();
  const excerpted = new Set<string>();
  const stops = content.stops.map((stop) => {
    const qualified = stop.blocks.flatMap((block) => {
      const match = qualifyBlock(block, job, evidence, covered, excerpted);
      return match === undefined ? [] : [match];
    });
    for (const item of qualified) {
      for (const path of item.paths) {
        covered.add(path);
        if (item.block.kind === 'diff_excerpt') excerpted.add(path);
      }
    }
    return { ...stop, blocks: qualified.map((item) => item.block) };
  });
  const [first, ...rest] = job.files
    .filter((file) => !covered.has(file.path))
    .map((file) => ({ path: file.path, note: 'Supporting change' }));
  if (first !== undefined) {
    const block: WalkthroughBlock = { kind: 'files', files: [first, ...rest] };
    const leftover = stops.find((stop) => stop.title === LEFTOVER_TITLE);
    if (leftover) leftover.blocks.push(block);
    else
      stops.push({
        title: LEFTOVER_TITLE,
        explanation: 'These changed files complete the change.',
        blocks: [block],
      });
  }
  return {
    ...content,
    outcome:
      content.outcome === 'needs_you' &&
      !stops.some((stop) =>
        stop.blocks.some((block) => block.kind === 'callout'),
      )
        ? 'worth_knowing'
        : content.outcome,
    stops: withUniqueTitles(stops),
    stillUnclear: content.stillUnclear.slice(0, 8),
  };
}
