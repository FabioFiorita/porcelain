const CONTINUE_MATCH = 1;
const SPACE_WORD_JUMP = 0.9;
const WORD_JUMP = 0.8;
const CHARACTER_JUMP = 0.17;
const TRANSPOSITION = 0.1;
const SKIPPED = 0.999;
const CASE_MISMATCH = 0.9999;
const INCOMPLETE = 0.99;
const wordBreak = /[\\/_+.#"@[({&]/;
const wordBreaks = /[\\/_+.#"@[({&]/g;
const space = /[\s-]/;
const spaces = /[\s-]/g;

function normalize(text: string) {
  return text.toLowerCase().replace(spaces, ' ');
}

function jumpScore(text: string, from: number, at: number) {
  const before = text.charAt(at - 1);
  if (at === from) return CONTINUE_MATCH;
  if (wordBreak.test(before)) {
    const skippedBreaks = text.slice(from, at - 1).match(wordBreaks);
    return (
      WORD_JUMP *
      (skippedBreaks && from > 0 ? SKIPPED ** skippedBreaks.length : 1)
    );
  }
  if (space.test(before)) {
    const skippedSpaces = text.slice(from, at - 1).match(spaces);
    return (
      SPACE_WORD_JUMP *
      (skippedSpaces && from > 0 ? SKIPPED ** skippedSpaces.length : 1)
    );
  }
  return CHARACTER_JUMP * (from > 0 ? SKIPPED ** (at - from) : 1);
}

function scoreFrom(
  text: string,
  query: string,
  lowerText: string,
  lowerQuery: string,
  from: number,
  position: number,
  memo: Map<string, number>,
): number {
  if (position === query.length)
    return from === text.length ? CONTINUE_MATCH : INCOMPLETE;
  const key = `${from},${position}`;
  const known = memo.get(key);
  if (known !== undefined) return known;
  const wanted = lowerQuery.charAt(position);
  let best = 0;
  for (
    let at = lowerText.indexOf(wanted, from);
    at >= 0;
    at = lowerText.indexOf(wanted, at + 1)
  ) {
    let score = scoreFrom(
      text,
      query,
      lowerText,
      lowerQuery,
      at + 1,
      position + 1,
      memo,
    );
    if (score > best) {
      score *= jumpScore(text, from, at);
      if (text.charAt(at) !== query.charAt(position)) score *= CASE_MISMATCH;
    }
    const next = lowerQuery.charAt(position + 1);
    if (
      (score < TRANSPOSITION && lowerText.charAt(at - 1) === next) ||
      (next === wanted && lowerText.charAt(at - 1) !== wanted)
    ) {
      const swapped = scoreFrom(
        text,
        query,
        lowerText,
        lowerQuery,
        at + 1,
        position + 2,
        memo,
      );
      if (swapped * TRANSPOSITION > score) score = swapped * TRANSPOSITION;
    }
    if (score > best) best = score;
  }
  memo.set(key, best);
  return best;
}

function branchSearchScore(name: string, query: string): number {
  return scoreFrom(
    name,
    query,
    normalize(name),
    normalize(query),
    0,
    0,
    new Map(),
  );
}

function prefixes(query: string): string[] {
  return Array.from(query, (_, index) => query.slice(0, index + 1));
}

function rankedByTyping<Entry>(
  entries: readonly Entry[],
  query: string,
  score: (entry: Entry, typed: string) => number,
): Entry[] {
  return prefixes(query).reduce(
    (order, typed) =>
      order
        .map((entry) => ({ entry, score: score(entry, typed) }))
        .filter((ranked) => ranked.score > 0)
        .sort((left, right) => right.score - left.score)
        .map(({ entry }) => entry),
    [...entries],
  );
}

export function branchSearchMatches<Entry>(
  entries: readonly Entry[],
  query: string,
  name: (entry: Entry) => string,
): Entry[] {
  return rankedByTyping(entries, query, (entry, typed) =>
    branchSearchScore(name(entry), typed),
  );
}

export function branchSearchGroups<Entry extends { name: string }>(
  groups: readonly { heading: string; entries: readonly Entry[] }[],
  query: string,
): { heading: string; entries: Entry[] }[] {
  const best = (entries: readonly Entry[], typed: string) =>
    Math.max(
      0,
      ...entries.map((entry) => branchSearchScore(entry.name, typed)),
    );
  return rankedByTyping(groups, query, (group, typed) =>
    best(group.entries, typed),
  )
    .map(({ heading, entries }) => ({
      heading,
      entries: branchSearchMatches(entries, query, (entry) => entry.name),
    }))
    .filter((group) => group.entries.length > 0);
}
