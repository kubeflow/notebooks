export interface RedirectOption {
  id: string;
  redirect?: { to: string };
}

interface RedirectEdge {
  sourceId: string;
  targetId: string;
}

interface RedirectTrace {
  edges: RedirectEdge[];
  cycle?: string[];
  missingTarget?: RedirectEdge;
}

export const traceRedirects = ({
  startId,
  options,
}: {
  startId: string;
  options: ReadonlyMap<string, RedirectOption>;
}): RedirectTrace => {
  const path: string[] = [];
  const positions = new Map<string, number>();
  const edges: RedirectEdge[] = [];
  let current = options.get(startId);
  while (current?.redirect) {
    positions.set(current.id, path.length);
    path.push(current.id);
    const targetId = current.redirect.to;
    const cycleStart = positions.get(targetId);
    if (cycleStart !== undefined) {
      return { edges, cycle: [...path.slice(cycleStart), targetId] };
    }
    const edge = { sourceId: current.id, targetId };
    edges.push(edge);
    current = options.get(targetId);
    if (!current) {
      return { edges, missingTarget: edge };
    }
  }
  return { edges };
};
