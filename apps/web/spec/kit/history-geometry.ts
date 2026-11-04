type GraphPoint = { x: number; y: number };
type GraphArea = {
  querySelector(selector: string): {
    querySelectorAll(selector: 'circle'): ArrayLike<{
      cx: { baseVal: { value: number } };
      cy: { baseVal: { value: number } };
    }>;
    querySelectorAll(selector: 'path'): ArrayLike<{
      getPointAtLength(length: number): GraphPoint;
      getTotalLength(): number;
    }>;
  } | null;
};

export function readHistoryGeometry(area: GraphArea) {
  const svg = area.querySelector('[data-testid="history-graph"]');
  if (!svg) throw new Error('History graph is missing');
  const point = (value: GraphPoint) => `${value.x},${value.y}`;
  const dots = Array.from(svg.querySelectorAll('circle')).map(
    (dot) => `${dot.cx.baseVal.value},${dot.cy.baseVal.value}`,
  );
  const edges = Array.from(svg.querySelectorAll('path')).map((path) => ({
    start: point(path.getPointAtLength(0)),
    end: point(path.getPointAtLength(path.getTotalLength())),
  }));
  const dangling = edges
    .filter(
      ({ end }) =>
        !dots.includes(end) && !edges.some((edge) => edge.start === end),
    )
    .map(({ end }) => end);
  const parents = dots.map((dot) => {
    const found = new Set<number>();
    const visited = new Set<string>();
    const visit = (start: string) => {
      if (visited.has(start)) return;
      visited.add(start);
      for (const edge of edges.filter((edge) => edge.start === start)) {
        const index = dots.indexOf(edge.end);
        if (index !== -1) found.add(index);
        else visit(edge.end);
      }
    };
    visit(dot);
    return [...found].sort((left, right) => left - right);
  });
  return { dangling, parents };
}
