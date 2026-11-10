import type { DiffFile, WalkthroughContent } from '../models/walkthrough.ts';

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

export function qualifyWalkthrough(
  content: WalkthroughContent,
  files: readonly DiffFile[],
  assets: readonly string[],
): WalkthroughContent {
  if (content.outcome === 'nothing')
    return { ...content, stops: [], stillUnclear: [] };
  const claimed = new Set<string>();
  const stops = content.stops.map((stop) => {
    const excerpts = stop.excerpts
      .filter((excerpt) => {
        const file = files.find(
          (item) =>
            (excerpt.side === 'old'
              ? (item.oldPath ?? item.path)
              : item.path) === excerpt.path,
        );
        return (
          file !== undefined &&
          excerpt.start > 0 &&
          excerpt.end >= excerpt.start &&
          file.hunks.some(
            (hunk) =>
              excerpt.start >=
                (excerpt.side === 'old' ? hunk.oldStart : hunk.newStart) &&
              excerpt.end <=
                (excerpt.side === 'old' ? hunk.oldEnd : hunk.newEnd),
          )
        );
      })
      .filter((excerpt) => {
        const file = files.find(
          (item) =>
            (excerpt.side === 'old'
              ? (item.oldPath ?? item.path)
              : item.path) === excerpt.path,
        );
        return file !== undefined && !claimed.has(file.path);
      });
    const paths = new Set(
      excerpts.map(
        (excerpt) =>
          files.find(
            (item) =>
              (excerpt.side === 'old'
                ? (item.oldPath ?? item.path)
                : item.path) === excerpt.path,
          )?.path,
      ),
    );
    const owned = stop.files.filter(
      (file) =>
        files.some((item) => item.path === file.path) &&
        !claimed.has(file.path) &&
        !paths.has(file.path),
    );
    for (const path of paths) if (path !== undefined) claimed.add(path);
    for (const file of owned) claimed.add(file.path);
    return {
      ...stop,
      excerpts,
      files: owned,
      evidence: stop.evidence.filter((item) => assets.includes(item.assetId)),
    };
  });
  const remaining = files.filter((file) => !claimed.has(file.path));
  const leftovers = remaining.map((file) => ({
    path: file.path,
    note: 'Supporting change',
  }));
  const existing = stops.findIndex((stop) => stop.title === LEFTOVER_TITLE);
  const covered =
    leftovers.length === 0
      ? stops
      : existing === -1
        ? [
            ...stops,
            {
              title: LEFTOVER_TITLE,
              explanation: 'These changed files complete the change.',
              attention: undefined,
              excerpts: [],
              evidence: [],
              files: leftovers,
            },
          ]
        : stops.map((stop, index) =>
            index === existing
              ? { ...stop, files: [...stop.files, ...leftovers] }
              : stop,
          );
  return {
    ...content,
    stops: withUniqueTitles(covered),
    stillUnclear: content.stillUnclear.slice(0, 8),
  };
}
