type TextMatch = { line: number; column: number };

export function findMatches(
  text: string,
  query: string,
  limit: number,
): TextMatch[] {
  if (query === '') return [];
  const needle = query.toLocaleLowerCase();
  const matches: TextMatch[] = [];
  const lines = text.split('\n');
  for (const [index, line] of lines.entries()) {
    const haystack = line.toLocaleLowerCase();
    let column = haystack.indexOf(needle);
    while (column !== -1) {
      if (matches.length === limit) return matches;
      matches.push({ line: index + 1, column });
      column = haystack.indexOf(needle, column + needle.length);
    }
  }
  return matches;
}

export function currentMatch(index: number, count: number) {
  return Math.max(0, Math.min(index, count - 1));
}

export function stepMatch(index: number, count: number, step: 1 | -1) {
  return count === 0 ? 0 : (currentMatch(index, count) + step + count) % count;
}

export function matchCountLabel(index: number, count: number, limit: number) {
  if (count === 0) return 'No results';
  const more = count === limit ? '+' : '';
  return `${currentMatch(index, count) + 1} of ${count}${more}`;
}
