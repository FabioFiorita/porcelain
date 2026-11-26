import type {
  WalkthroughBlock,
  walkthroughContentSchema,
} from '@porcelain/contracts/walkthroughs';
type WireContent = typeof walkthroughContentSchema.Type;
type WireStop = WireContent['stops'][number];
type Excerpt = Extract<WalkthroughBlock, { kind: 'diff_excerpt' }>;
type Images = Extract<WalkthroughBlock, { kind: 'before_after' }>;
type Checks = Extract<WalkthroughBlock, { kind: 'checks' }>;
type Callout = Extract<WalkthroughBlock, { kind: 'callout' }>;
type Diagram = Extract<WalkthroughBlock, { kind: 'diagram' }>;

export type WalkthroughEvidence = Images['before'];
export type WalkthroughScreenshot = WalkthroughEvidence & {
  readonly label: 'Before' | 'After';
  readonly enlarge: string;
};

export type WalkthroughExcerpt = Pick<
  Excerpt,
  'path' | 'side' | 'start' | 'end' | 'caption'
> & {
  readonly position: number;
  readonly lines: string;
  readonly span: { readonly startLine: number; readonly endLine: number };
  readonly node?: string | undefined;
};

export type DiagramNode = Omit<Diagram['nodes'][number], 'anchor'> & {
  readonly anchor:
    | { readonly kind: 'lines'; readonly excerpt: WalkthroughExcerpt }
    | { readonly kind: 'file'; readonly path: string }
    | undefined;
};
export type DiagramEdge = Diagram['edges'][number];
export type StepDiagram = {
  readonly title: string | undefined;
  readonly layout: Diagram['layout'];
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
};

export type WalkthroughComparison = NonNullable<Callout['comparison']>;

type WalkthroughCallout = {
  readonly attention: Callout['attention'];
  readonly comparison: WalkthroughComparison | undefined;
};

export type StepBlock =
  | { readonly kind: 'excerpt'; readonly excerpt: WalkthroughExcerpt }
  | {
      readonly kind: 'images';
      readonly screenshots: readonly WalkthroughScreenshot[];
      readonly first: number;
    }
  | {
      readonly kind: 'files';
      readonly files: readonly {
        readonly path: string;
        readonly note: string;
      }[];
    }
  | {
      readonly kind: 'checks';
      readonly checks: Omit<Checks, 'kind'>;
    }
  | { readonly kind: 'diagram'; readonly diagram: StepDiagram };

export type WalkthroughStop = {
  readonly title: string;
  readonly explanation: string;
  readonly blocks: readonly StepBlock[];
  readonly callouts: readonly WalkthroughCallout[];
};

function excerptLines(excerpt: Pick<Excerpt, 'side' | 'start' | 'end'>) {
  const side = excerpt.side === 'old' ? 'Old' : 'New';
  return excerpt.start === excerpt.end
    ? `${side} line ${excerpt.start}`
    : `${side} lines ${excerpt.start}–${excerpt.end}`;
}

function readDiagram(block: Diagram, position: number): StepDiagram {
  return {
    title: block.title,
    layout: block.layout,
    edges: block.edges,
    nodes: block.nodes.map(({ anchor, ...node }) => ({
      ...node,
      anchor:
        anchor === undefined
          ? undefined
          : anchor.lines === undefined
            ? { kind: 'file', path: anchor.path }
            : {
                kind: 'lines',
                excerpt: {
                  path: anchor.path,
                  ...anchor.lines,
                  caption: node.note ?? '',
                  position,
                  node: node.id,
                  lines: excerptLines(anchor.lines),
                  span: {
                    startLine: anchor.lines.start,
                    endLine: anchor.lines.end,
                  },
                },
              },
    })),
  };
}

export function readStop({
  title,
  explanation,
  blocks,
}: WireStop): WalkthroughStop {
  const shown: StepBlock[] = [];
  const callouts: WalkthroughCallout[] = [];
  let screenshots = 0;
  blocks.forEach((block, index) => {
    switch (block.kind) {
      case 'diff_excerpt':
        shown.push({
          kind: 'excerpt',
          excerpt: {
            path: block.path,
            side: block.side,
            start: block.start,
            end: block.end,
            caption: block.caption,
            position: index + 1,
            lines: excerptLines(block),
            span: { startLine: block.start, endLine: block.end },
          },
        });
        return;
      case 'before_after':
        shown.push({
          kind: 'images',
          screenshots: [
            {
              ...block.before,
              label: 'Before',
              enlarge: 'Enlarge before screenshot',
            },
            {
              ...block.after,
              label: 'After',
              enlarge: 'Enlarge after screenshot',
            },
          ],
          first: screenshots,
        });
        screenshots += 2;
        return;
      case 'files':
        if (block.files.length > 0)
          shown.push({ kind: 'files', files: block.files });
        return;
      case 'checks':
        if (block.results.length === 0 && !block.checksTruncated) return;
        shown.push({
          kind: 'checks',
          checks: {
            headOid: block.headOid,
            state: block.state,
            checksTruncated: block.checksTruncated,
            results: block.results,
          },
        });
        return;
      case 'diagram':
        shown.push({ kind: 'diagram', diagram: readDiagram(block, index + 1) });
        return;
      case 'callout':
        callouts.push({
          attention: block.attention,
          comparison: block.comparison,
        });
        return;
    }
  });
  return {
    title,
    explanation,
    blocks: shown,
    callouts,
  };
}

export function stepScreenshots(
  stop: WalkthroughStop,
): readonly WalkthroughScreenshot[] {
  return stop.blocks.flatMap((block) =>
    block.kind === 'images' ? block.screenshots : [],
  );
}

export function stepCitedPaths(stop: WalkthroughStop): readonly string[] {
  return stop.blocks.flatMap((block) =>
    block.kind === 'excerpt'
      ? [block.excerpt.path]
      : block.kind === 'files'
        ? block.files.map((file) => file.path)
        : [],
  );
}
