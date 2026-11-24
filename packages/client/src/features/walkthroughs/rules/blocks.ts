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
};

export type WalkthroughComparison = {
  readonly columns: readonly [string, string];
  readonly rows: readonly (readonly [string, string])[];
};

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
    };

export type WalkthroughStop = {
  readonly title: string;
  readonly explanation: string;
  readonly blocks: readonly StepBlock[];
  readonly callouts: readonly WalkthroughCallout[];
  readonly unsupportedBlocksNotice: string | undefined;
};

const UNSUPPORTED = 'Part of this step needs a newer Porcelain to show.';
const MAX_COMPARISON_ROWS = 6;

function excerptLines(excerpt: Excerpt) {
  const side = excerpt.side === 'old' ? 'Old' : 'New';
  return excerpt.start === excerpt.end
    ? `${side} line ${excerpt.start}`
    : `${side} lines ${excerpt.start}–${excerpt.end}`;
}

function pair(
  values: readonly string[],
): readonly [string, string] | undefined {
  const [left, right] = values;
  return values.length === 2 && left !== undefined && right !== undefined
    ? [left, right]
    : undefined;
}

function readComparison(
  comparison: Callout['comparison'],
): WalkthroughComparison | undefined | 'unsupported' {
  if (comparison === undefined) return undefined;
  const columns = pair(comparison.columns);
  const rows = comparison.rows.map(pair);
  if (
    columns === undefined ||
    rows.length === 0 ||
    rows.length > MAX_COMPARISON_ROWS ||
    rows.some((row) => row === undefined)
  )
    return 'unsupported';
  return { columns, rows: rows.filter((row) => row !== undefined) };
}

export function readStop({
  title,
  explanation,
  blocks,
}: WireStop): WalkthroughStop {
  const shown: StepBlock[] = [];
  const callouts: WalkthroughCallout[] = [];
  let unsupported = false;
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
      case 'callout': {
        const comparison = readComparison(block.comparison);
        if (comparison === 'unsupported') unsupported = true;
        callouts.push({
          attention: block.attention,
          comparison: comparison === 'unsupported' ? undefined : comparison,
        });
        return;
      }
      case 'unknown':
        unsupported = true;
        return;
    }
  });
  return {
    title,
    explanation,
    blocks: shown,
    callouts,
    unsupportedBlocksNotice: unsupported ? UNSUPPORTED : undefined,
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
